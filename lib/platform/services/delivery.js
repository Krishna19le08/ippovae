// Delivery: rider offers, accept / reject / expiry / drop with reassignment, pickup (consumes stock), OTP-verified
// handover, failed attempts, return to store. Assignments are never edited back: a new row (attempt_no + 1) is created
// for each new offer, and the unique "one live assignment per order" index prevents two riders holding one order.

import { PlatformError, commitThenFail } from "../errors.js";
import { SYSTEM, assertCan, isSystem, can } from "../policy/permissions.js";
import { ASSIGNMENT_MACHINE } from "../machines/assignment.js";
import { step } from "../machines/util.js";
import { audit, queueNotification, storeStaffIds, actorId } from "../core.js";
import { addMs } from "../clock.js";
import { sha256 } from "../crypto.js";

export const FAILURE_REASONS = ["customer_unreachable", "wrong_address", "customer_refused", "premises_closed", "unsafe", "other"];
const bad = (fields, message = "Check the highlighted fields.", extra = {}) => new PlatformError("VALIDATION_FAILED", message, { fields, ...extra });

export function install(ctx, exec) {
  const P = ctx.policies;
  const fn = ctx.fn;

  const event = (tx, asg, type, actor, note = null) =>
    tx.insert("delivery_events", { id: tx.nextId("dev"), assignment_id: asg.id, order_id: asg.order_id, type, lat: null, lng: null, note, actor_id: actorId(actor), created_at: ctx.clock.iso() });

  const setAsg = (tx, actor, asg, ev, patch = {}) => {
    const to = step(ASSIGNMENT_MACHINE, asg.status, ev);
    const next = tx.update("assignments", asg.id, { status: to, ...patch });
    audit(tx, ctx, actor, `assignment.${ev}`, ["assignment", asg.id], { before: { status: asg.status }, after: { status: to }, store_id: tx.get("orders", asg.order_id)?.store_id });
    return next;
  };
  const setPartner = (tx, partnerId, status, extra = {}) => {
    const p = tx.get("delivery_partners", partnerId);
    if (p && p.status !== "suspended") tx.update("delivery_partners", partnerId, { status, last_seen_at: ctx.clock.iso(), ...extra });
  };
  const partnerUser = (tx, partnerId) => tx.get("delivery_partners", partnerId)?.user_id;
  const loadAsg = (tx, id) => { const a = id ? tx.get("assignments", id) : null; if (!a) throw new PlatformError("NOT_FOUND", "Assignment not found."); return a; };
  const liveFor = (tx, order_id) => tx.list("assignments", { where: { order_id, status: { in: ["offered", "accepted", "picked_up"] } } })[0] || null;

  function ownAssignment(tx, a, asg, action) {
    const p = tx.get("delivery_partners", asg.partner_id);
    assertCan(a, action, { assigned_user_ids: p ? [p.user_id] : [] });
    if (!isSystem(a) && a.partnerId !== asg.partner_id) throw new PlatformError("FORBIDDEN", "This job is assigned to someone else.", { action });
  }

  function alertStore(tx, order, template, dedupe) {
    for (const uid of storeStaffIds(tx, order.store_id)) queueNotification(tx, ctx, { user_id: uid, template, payload: { order_id: order.id, display_no: order.display_no }, dedupe, channels: ["in_app"] });
  }

  function candidates(tx, order) {
    const prior = tx.list("assignments", { where: { order_id: order.id } });
    const excluded = new Set(prior.filter((x) => ["rejected", "expired", "cancelled"].includes(x.status)).map((x) => x.partner_id));
    const live = tx.list("assignments", { where: { status: { in: ["accepted", "picked_up"] } } });
    return tx.list("delivery_partners", { where: { status: "available" }, orderBy: "id" })
      .filter((p) => (!p.store_id || p.store_id === order.store_id) && !excluded.has(p.id) && live.filter((x) => x.partner_id === p.id).length < p.max_concurrent);
  }

  function createOffer(tx, actor, order, partner, attemptNo) {
    const now = ctx.clock.iso();
    const asg = tx.insert("assignments", {
      id: tx.nextId("asg"), order_id: order.id, partner_id: partner.id, status: "offered", attempt_no: attemptNo, offered_at: now,
      offer_expires_at: addMs(now, P.rider_offer_timeout_seconds * 1000), accepted_at: null, picked_up_at: null, completed_at: null,
      reject_reason: null, failure_reason: null, cod_amount_collected: 0, version: 1,
    });
    event(tx, asg, "offered", actor);
    audit(tx, ctx, actor, "assignment.offer", ["assignment", asg.id], { after: { partner_id: partner.id, attempt_no: attemptNo }, store_id: order.store_id });
    fn.applyTransition(tx, isSystem(actor) ? SYSTEM : actor, order, "assign_rider", { force: false, reason: "rider offered" });
    queueNotification(tx, ctx, { user_id: partner.user_id, template: "delivery.offer", payload: { order_id: order.id, display_no: order.display_no, assignment_id: asg.id }, dedupe: asg.id });
    return asg;
  }

  // Dispatcher: offer to the next eligible rider, or raise the store alert (never loops forever).
  function offerNext(tx, actor, order) {
    const o = tx.get("orders", order.id);
    if (o.internal_state !== "ready_for_pickup") return null;
    const prior = tx.list("assignments", { where: { order_id: o.id } });
    const failedOffers = prior.filter((x) => ["rejected", "expired", "cancelled"].includes(x.status)).length;
    if (failedOffers >= P.max_rider_offers) { tx.update("orders", o.id, { dispatch_alert: "no_rider" }); alertStore(tx, o, "dispatch.no_rider", `${o.id}:exhausted`); return null; }
    const list = candidates(tx, o);
    if (!list.length) { tx.update("orders", o.id, { dispatch_alert: "no_rider" }); alertStore(tx, o, "dispatch.no_rider", `${o.id}:${prior.length}`); return null; }
    if (o.dispatch_alert) tx.update("orders", o.id, { dispatch_alert: null });
    return createOffer(tx, actor, tx.get("orders", o.id), list[0], prior.length + 1);
  }

  function cancelLive(tx, actor, order, why) {
    const live = liveFor(tx, order.id);
    if (!live || live.status === "picked_up") return null;
    const wasAccepted = live.status === "accepted";
    const next = setAsg(tx, actor, live, "cancel", { reject_reason: why, completed_at: ctx.clock.iso() });
    event(tx, next, "cancelled", actor, why);
    if (wasAccepted) setPartner(tx, live.partner_id, "available");
    const uid = partnerUser(tx, live.partner_id);
    queueNotification(tx, ctx, { user_id: uid, template: "delivery.cancelled", payload: { order_id: order.id, display_no: order.display_no }, dedupe: live.id });
    return next;
  }

  function completeReturn(tx, actor, order) {
    const asg = tx.list("assignments", { where: { order_id: order.id, status: "failed" } })[0];
    if (!asg) return;
    const next = setAsg(tx, actor, asg, "return_complete", { completed_at: ctx.clock.iso() });
    event(tx, next, "returned", actor);
    setPartner(tx, asg.partner_id, "available");
  }

  // mark_failed_delivery / start_return arrive here from orders.transition and forceTransition
  function storeSideEvent(tx, actor, order, ev, { expectedVersion, payload, reason, force }) {
    const asg = tx.list("assignments", { where: { order_id: order.id, status: { in: ["picked_up", "failed"] } } })[0];
    if (ev === "mark_failed_delivery") {
      const terminal = P.terminal_failure_reasons.includes(order.last_failure_reason);
      if (!force && !(order.delivery_attempts >= P.max_delivery_attempts || terminal)) throw new PlatformError("INVALID_TRANSITION", "More delivery attempts are still allowed.", { from: order.internal_state, event: ev, allowed_events: ["attempt_failed"], reason: "attempts_remaining" });
      const next = fn.applyTransition(tx, actor, order, ev, { expectedVersion, reason, force });
      if (asg) {
        const done = setAsg(tx, actor, asg, "fail", { failure_reason: order.last_failure_reason || "other" });
        event(tx, done, "failed", actor, order.last_failure_reason);
      }
      queueNotification(tx, ctx, { user_id: order.user_id, template: "delivery.failed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      alertStore(tx, order, "dispatch.delivery_failed", `${order.id}:failed`);
      return tx.get("orders", next.id);
    }
    // start_return
    const next = fn.applyTransition(tx, actor, order, ev, { expectedVersion, reason, force });
    if (asg) event(tx, asg, "returning", actor);
    return tx.get("orders", next.id);
  }

  fn.delivery = { offerNext, cancelLive, completeReturn, storeSideEvent, candidates };

  const view = (tx, a, id) => fn.orders.view(tx, a, tx.get("orders", id));

  const api = {
    setAvailability(actor, { status }) {
      return exec(actor, { action: "partner.set_availability" }, (tx, a) => {
        assertCan(a, "partner.set_availability", { owner_id: a.userId });
        const p = a.partnerId && tx.get("delivery_partners", a.partnerId);
        if (!p) throw new PlatformError("NOT_FOUND", "No rider profile.");
        if (!["available", "offline"].includes(status)) throw bad({ status: "available or offline" });
        if (p.status === "suspended") throw new PlatformError("FORBIDDEN", "Your rider account is suspended.", { reason: "suspended" });
        if (p.status === "busy") throw new PlatformError("INVALID_TRANSITION", "Finish your current delivery first.", { from: "busy", event: "set_availability", allowed_events: [] });
        const next = tx.update("delivery_partners", p.id, { status, last_seen_at: ctx.clock.iso() });
        audit(tx, ctx, a, "partner.availability", ["partner", p.id], { before: { status: p.status }, after: { status } });
        return next;
      });
    },

    // SM / SA suspend or reinstate a rider (SM only for riders of their store).
    setPartnerStatus(actor, { partner_id, status }) {
      return exec(actor, { action: "partner.manage", entity: ["partner", partner_id || ""] }, (tx, a) => {
        const p = tx.get("delivery_partners", partner_id);
        if (!p) throw new PlatformError("NOT_FOUND", "Rider not found.");
        assertCan(a, "partner.manage", { store_id: p.store_id });
        if (!["suspended", "offline"].includes(status)) throw bad({ status: "suspended or offline" });
        const next = tx.update("delivery_partners", p.id, { status });
        audit(tx, ctx, a, "partner.status", ["partner", p.id], { before: { status: p.status }, after: { status }, store_id: p.store_id });
        return next;
      });
    },

    // Manual assignment by the store manager (also used when automatic offers are exhausted).
    assign(actor, { order_id, partner_id }) {
      return exec(actor, { action: "assignment.create", entity: ["order", order_id || ""] }, (tx, a) => {
        const order = fn.orders.loadOrder(tx, order_id);
        assertCan(a, "assignment.create", { store_id: order.store_id });
        const partner = tx.get("delivery_partners", partner_id);
        if (!partner || partner.status !== "available") throw new PlatformError("VALIDATION_FAILED", "Rider is not available.", { fields: { partner_id: "not available" } });
        if (partner.store_id && partner.store_id !== order.store_id) throw bad({ partner_id: "rider belongs to another store" });
        if (order.internal_state !== "ready_for_pickup") throw new PlatformError("INVALID_TRANSITION", "The order is not waiting for a rider.", { from: order.internal_state, event: "assign_rider", allowed_events: [] });
        const prior = tx.list("assignments", { where: { order_id } }).length;
        const asg = createOffer(tx, a, order, partner, prior + 1);
        tx.update("orders", order_id, { dispatch_alert: null });
        return asg;
      });
    },

    accept(actor, { assignment_id, expected_version }) {
      return exec(actor, { action: "assignment.accept", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.respond");
        const order = fn.orders.loadOrder(tx, asg.order_id);
        if (asg.status !== "offered") throw new PlatformError(order.internal_state === "cancelled" ? "ORDER_CANCELLED" : "INVALID_TRANSITION", "This offer is no longer open.", { from: asg.status, event: "accept", allowed_events: [] });
        if (Date.parse(asg.offer_expires_at) <= ctx.clock.now()) throw new PlatformError("OFFER_EXPIRED", "This offer has expired.", { offer_expires_at: asg.offer_expires_at });
        const p = tx.get("delivery_partners", asg.partner_id);
        if (p.status !== "available") throw new PlatformError("VALIDATION_FAILED", "You cannot accept a job right now.", { fields: { status: p.status } });
        fn.applyTransition(tx, a, order, "rider_accept", { expectedVersion: expected_version });
        const next = setAsg(tx, a, asg, "accept", { accepted_at: ctx.clock.iso() });
        event(tx, next, "accepted", a);
        setPartner(tx, asg.partner_id, "busy");
        const u = tx.get("users", p.user_id);
        queueNotification(tx, ctx, { user_id: order.user_id, template: "delivery.rider_assigned", payload: { order_id: order.id, display_no: order.display_no, rider_first_name: u.name.split(" ")[0] }, dedupe: order.id });
        return { assignment: next, order: view(tx, a, order.id) };
      });
    },

    reject(actor, { assignment_id, reason }) {
      return exec(actor, { action: "assignment.reject", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.respond");
        if (!(reason && reason.trim())) throw bad({ reason: "required" });
        const order = fn.orders.loadOrder(tx, asg.order_id);
        if (asg.status !== "offered") throw new PlatformError(order.internal_state === "cancelled" ? "ORDER_CANCELLED" : "INVALID_TRANSITION", "This offer is no longer open.", { from: asg.status, event: "reject", allowed_events: [] });
        fn.applyTransition(tx, a, order, "rider_reject", { reason });
        const next = setAsg(tx, a, asg, "reject", { reject_reason: reason, completed_at: ctx.clock.iso() });
        event(tx, next, "rejected", a, reason);
        const nextOffer = offerNext(tx, SYSTEM, tx.get("orders", order.id));
        return { assignment: next, next_offer: nextOffer };
      });
    },

    // Rider (or the store manager) gives the job back before pickup.
    drop(actor, { assignment_id, reason }) {
      return exec(actor, { action: "assignment.drop", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        const order = fn.orders.loadOrder(tx, asg.order_id);
        const p = tx.get("delivery_partners", asg.partner_id);
        assertCan(a, "assignment.drop", { store_id: order.store_id, assigned_user_ids: [p.user_id] });
        if (!(reason && reason.trim())) throw bad({ reason: "required" });
        if (asg.status !== "accepted") throw new PlatformError("INVALID_TRANSITION", "Only an accepted, not yet collected job can be dropped.", { from: asg.status, event: "drop", allowed_events: [] });
        fn.applyTransition(tx, a, order, "rider_drop", { reason });
        const next = setAsg(tx, a, asg, "cancel", { reject_reason: `rider_dropped: ${reason}`, completed_at: ctx.clock.iso() });
        event(tx, next, "cancelled", a, "rider_dropped");
        setPartner(tx, asg.partner_id, "available");
        alertStore(tx, order, "dispatch.rider_dropped", `${order.id}:${asg.id}`);
        const nextOffer = offerNext(tx, SYSTEM, tx.get("orders", order.id));
        return { assignment: next, next_offer: nextOffer };
      });
    },

    pickup(actor, { assignment_id, expected_version, physically_collected = false }) {
      let orderRef = null;
      return exec(actor, {
        action: "assignment.pickup", entity: ["assignment", assignment_id || ""],
        onFail: (tx, err) => {
          if (err.code === "ORDER_CANCELLED" && physically_collected && orderRef) alertStore(tx, orderRef, "dispatch.parcel_with_rider", `${orderRef.id}:parcel`);
        },
      }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.progress");
        const order = fn.orders.loadOrder(tx, asg.order_id);
        orderRef = order;
        if (order.internal_state === "cancelled") throw new PlatformError("ORDER_CANCELLED", "Order cancelled. Do not collect.", { order_id: order.id, return_to_store: true, current_version: order.version });
        if (asg.status !== "accepted") throw new PlatformError("INVALID_TRANSITION", "This job cannot be collected.", { from: asg.status, event: "pickup", allowed_events: [] });
        const next = fn.applyTransition(tx, a, order, "pickup", {
          expectedVersion: expected_version,
          effects: (o) => ({ patch: o.cancel_request_status === "requested" ? { cancel_request_status: "denied", cancel_deny_reason: "already_dispatched" } : {} }),
        });
        fn.inventory.consumeReservations(tx, ctx, a, order.id);
        const sa = setAsg(tx, a, asg, "pickup", { picked_up_at: ctx.clock.iso() });
        event(tx, sa, "picked_up", a);
        queueNotification(tx, ctx, { user_id: order.user_id, template: "delivery.out_for_delivery", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
        return { assignment: sa, order: view(tx, a, next.id) };
      });
    },

    deliver(actor, { assignment_id, otp, cod_amount_collected = 0, expected_version }) {
      return exec(actor, { action: "assignment.deliver", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.progress");
        let order = fn.orders.loadOrder(tx, asg.order_id);
        if (order.internal_state === "cancelled") throw new PlatformError("ORDER_CANCELLED", "Order cancelled.", { order_id: order.id });
        if (asg.status !== "picked_up") throw new PlatformError("INVALID_TRANSITION", "This job is not out for delivery.", { from: asg.status, event: "deliver", allowed_events: [] });
        if (!["picked_up", "delivery_attempted"].includes(order.internal_state)) throw new PlatformError("INVALID_TRANSITION", "Order is not out for delivery.", { from: order.internal_state, event: "deliver", allowed_events: [] });
        if (order.otp_locked) return commitThenFail(new PlatformError("FORBIDDEN", "The delivery code is locked. Contact support.", { code: "OTP_LOCKED", reason: "otp_locked" }));
        if (sha256(`${String(otp ?? "")}:${order.id}`) !== order.delivery_otp_hash) {
          const n = (order.otp_failed_count || 0) + 1;
          const locked = n >= P.otp_max_wrong_attempts;
          tx.update("orders", order.id, { otp_failed_count: n, otp_locked: locked });
          audit(tx, ctx, a, "order.deliver.otp_failed", ["order", order.id], { result: "denied", reason: "wrong_otp", after: { attempts: n, locked }, store_id: order.store_id });
          event(tx, asg, "delivery_attempted", a, "wrong_otp");
          return commitThenFail(new PlatformError("VALIDATION_FAILED", "That delivery code is not correct.", { code: "INVALID_OTP", attempts_left: Math.max(0, P.otp_max_wrong_attempts - n), locked, fields: { otp: "incorrect" } }));
        }
        const pay = fn.orders.activePayment(tx, order.id);
        if (pay && pay.status === "cod_due") {
          const paid = fn.paymentsApi.collectCod(tx, a, pay, cod_amount_collected);
          const p = tx.get("delivery_partners", asg.partner_id);
          tx.update("delivery_partners", p.id, { cash_in_hand: p.cash_in_hand + paid.amount });
        }
        const next = fn.applyTransition(tx, a, order, "deliver", { expectedVersion: expected_version, effects: () => ({ patch: { delivered_at: ctx.clock.iso() } }) });
        for (const it of fn.orders.itemsOf(tx, order.id)) tx.update("order_items", it.id, { delivered_qty: it.picked_qty ?? it.qty, fulfilment_status: "delivered" });
        const done = setAsg(tx, a, asg, "deliver", { completed_at: ctx.clock.iso(), cod_amount_collected: pay && pay.status === "cod_due" ? cod_amount_collected : 0 });
        event(tx, done, "delivered", a);
        setPartner(tx, asg.partner_id, "available");
        queueNotification(tx, ctx, { user_id: order.user_id, template: "order.delivered", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
        return { assignment: done, order: view(tx, a, next.id) };
      });
    },

    attemptFailed(actor, { assignment_id, failure_reason, note, expected_version }) {
      return exec(actor, { action: "assignment.attempt_failed", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.progress");
        const order = fn.orders.loadOrder(tx, asg.order_id);
        if (!FAILURE_REASONS.includes(failure_reason)) throw bad({ failure_reason: `one of ${FAILURE_REASONS.join(", ")}` });
        if (asg.status !== "picked_up" && order.internal_state !== "cancelled") throw new PlatformError("INVALID_TRANSITION", "This job is not out for delivery.", { from: asg.status, event: "attempt_failed", allowed_events: [] });
        if (order.internal_state !== "cancelled" && order.delivery_attempts >= P.max_delivery_attempts) throw new PlatformError("INVALID_TRANSITION", "The maximum number of delivery attempts was reached.", { from: order.internal_state, event: "attempt_failed", allowed_events: ["mark_failed_delivery"], reason: "max_attempts" });
        const next = fn.applyTransition(tx, a, order, "attempt_failed", {
          expectedVersion: expected_version, reason: failure_reason,
          effects: (o) => ({ patch: { delivery_attempts: o.delivery_attempts + 1, last_failure_reason: failure_reason }, metadata: { failure_reason, note: note ?? null } }),
        });
        event(tx, asg, "delivery_attempted", a, `${failure_reason}${note ? `: ${note}` : ""}`);
        queueNotification(tx, ctx, { user_id: order.user_id, template: "delivery.attempt_failed", payload: { order_id: order.id, display_no: order.display_no, reason: failure_reason }, dedupe: `${order.id}:${next.delivery_attempts}` });
        return { order: view(tx, a, next.id) };
      });
    },

    // Rider-facing wrapper (riders have no order.* permissions).
    markFailedDelivery(actor, { assignment_id, expected_version }) {
      return exec(actor, { action: "order.mark_failed_delivery", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.mark_failed");
        const order = fn.orders.loadOrder(tx, asg.order_id);
        return view(tx, a, storeSideEvent(tx, a, order, "mark_failed_delivery", { expectedVersion: expected_version }).id);
      });
    },
    startReturn(actor, { assignment_id, expected_version }) {
      return exec(actor, { action: "order.start_return", entity: ["assignment", assignment_id || ""] }, (tx, a) => {
        const asg = loadAsg(tx, assignment_id);
        ownAssignment(tx, a, asg, "assignment.progress");
        const order = fn.orders.loadOrder(tx, asg.order_id);
        return view(tx, a, storeSideEvent(tx, a, order, "start_return", { expectedVersion: expected_version }).id);
      });
    },

    // Job: offers whose 60 seconds ran out (D4 / O15), then the next rider is offered.
    expireOffers() {
      const now = ctx.clock.now();
      const due = ctx.repo.read((tx) => tx.list("assignments", { where: { status: "offered" } })).filter((x) => Date.parse(x.offer_expires_at) <= now);
      const out = [];
      for (const d of due) {
        const res = exec(SYSTEM, { action: "assignment.expire", entity: ["assignment", d.id] }, (tx, a) => {
          const asg = tx.get("assignments", d.id);
          if (!asg || asg.status !== "offered") return { skipped: true };
          const order = tx.get("orders", asg.order_id);
          fn.applyTransition(tx, a, order, "rider_expire", { reason: "offer expired" });
          const next = setAsg(tx, a, asg, "expire", { completed_at: ctx.clock.iso() });
          event(tx, next, "expired", a);
          offerNext(tx, a, tx.get("orders", order.id));
          return { expired: true };
        });
        out.push({ id: d.id, ok: res.ok });
      }
      return out;
    },

    list(actor, { status, order_id } = {}) {
      return exec(actor, { action: "assignment.list" }, (tx, a) => {
        let rows = tx.list("assignments", { where: { ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}), ...(order_id ? { order_id } : {}) }, orderBy: "created_at" });
        if (!isSystem(a)) {
          rows = rows.filter((r) => {
            const o = tx.get("orders", r.order_id);
            const p = tx.get("delivery_partners", r.partner_id);
            return can(a, "assignment.read", { user_id: o.user_id, store_id: o.store_id, assigned_user_ids: [p.user_id] });
          });
        }
        return rows;
      });
    },
    events(actor, order_id) {
      return exec(actor, { action: "delivery_event.read", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = fn.orders.loadOrder(tx, order_id);
        const asgs = tx.list("assignments", { where: { order_id } });
        const ids = asgs.map((x) => tx.get("delivery_partners", x.partner_id)?.user_id);
        assertCan(a, "delivery_event.read", { user_id: o.user_id, store_id: o.store_id, assigned_user_ids: ids });
        const rows = tx.list("delivery_events", { where: { order_id }, orderBy: "created_at" });
        const customer = !isSystem(a) && o.user_id === a.userId && a.roles.every((r) => r.role === "customer");
        return customer ? rows.filter((r) => ["accepted", "picked_up", "delivered", "delivery_attempted", "failed", "returned"].includes(r.type)).map(({ id, type, created_at }) => ({ id, type, created_at })) : rows;
      });
    },

    recordCodDeposit(actor, { partner_id, amount }) {
      return exec(actor, { action: "cod.settle", entity: ["partner", partner_id || ""] }, (tx, a) => {
        const p = tx.get("delivery_partners", partner_id);
        if (!p) throw new PlatformError("NOT_FOUND", "Rider not found.");
        assertCan(a, "cod.settle", { store_id: p.store_id });
        if (!Number.isInteger(amount) || amount <= 0 || amount > p.cash_in_hand) throw bad({ amount: "must be between 1 and the cash in hand" });
        const next = tx.update("delivery_partners", p.id, { cash_in_hand: p.cash_in_hand - amount });
        audit(tx, ctx, a, "cod.deposit", ["partner", p.id], { before: { cash_in_hand: p.cash_in_hand }, after: { cash_in_hand: next.cash_in_hand }, store_id: p.store_id });
        return next;
      });
    },
  };
  return api;
}
