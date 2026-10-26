// Orders: placement (price snapshot, stock reservation, idempotency), the only legal way to change order state
// (applyTransition), cancellation (direct / request / duplicate-safe) and role-masked reads.
// Callers never set `status` or `internal_state`: they send events, and the transition table decides.

import { PlatformError } from "../errors.js";
import { hmacSha256, sha256 } from "../crypto.js";
import { SYSTEM, assertCan, can, isSystem, roleNames, scopeFilter, inScope, fieldMask, applyMask, hasRole, PP_VISIBLE_STATES } from "../policy/permissions.js";
import { ORDER_MACHINE, STATUS_OF } from "../machines/order.js";
import { allowedEvents, step } from "../machines/util.js";
import { eligibility, REQUEST_GROUP } from "../policy/cancellation.js";
import { applyCoupon, computeTotals } from "../policy/pricing.js";
import { audit, changedFields, queueNotification, recordHistory, storeStaffIds, actorId } from "../core.js";
import { addMs } from "../clock.js";
import { prorate } from "../money.js";
import { nextPaymentState } from "../machines/payment.js";

export const STORE_EVENTS = ["accept", "start_picking", "finish_picking", "start_packing", "finish_packing", "mark_ready", "reopen_picking", "reopen_packing", "complete_return", "start_return", "mark_failed_delivery"];
const FORCE_BY_ROLE = {
  store_manager: ["accept", "start_picking", "finish_picking", "start_packing", "finish_packing", "mark_ready", "reopen_picking", "reopen_packing"],
  support_supervisor: ["mark_failed_delivery", "start_return"],
};
const bad = (fields, message = "Check the highlighted fields.") => new PlatformError("VALIDATION_FAILED", message, { fields });

const isIstOpen = (store, nowMs) => {
  if (!store.opens_at || !store.closes_at) return true;
  const mins = Math.floor(((nowMs + 330 * 60000) % 86400000) / 60000);
  const [oh, om] = store.opens_at.split(":").map(Number);
  const [ch, cm] = store.closes_at.split(":").map(Number);
  const o = oh * 60 + om, c = ch * 60 + cm;
  return o <= c ? mins >= o && mins < c : mins >= o || mins < c;
};

export function install(ctx, exec) {
  const P = ctx.policies;
  const fn = ctx.fn;

  const loadOrder = (tx, id) => {
    const o = id ? tx.get("orders", id) : null;
    if (!o) throw new PlatformError("NOT_FOUND", "Order not found.");
    return o;
  };
  const itemsOf = (tx, order_id) => tx.list("order_items", { where: { order_id } });
  const paymentsOf = (tx, order_id) => tx.list("payments", { where: { order_id }, orderBy: "created_at" });
  const activePayment = (tx, order_id) => { const p = paymentsOf(tx, order_id); return p[p.length - 1] || null; };

  const deriveOtp = (order) => {
    const h = hmacSha256(ctx.secrets.otp, `${order.id}:${order.placed_at}`);
    return String(parseInt(h.slice(0, 8), 16) % 10 ** P.otp_digits).padStart(P.otp_digits, "0");
  };
  const otpHash = (otp, order) => sha256(`${otp}:${order.id}`);

  function orderResource(tx, order) {
    const asg = tx.list("assignments", { where: { order_id: order.id } });
    const cutoff = ctx.clock.now() - 24 * 3600 * 1000;
    const partners = asg
      .filter((a) => ["offered", "accepted", "picked_up"].includes(a.status) || (a.completed_at && Date.parse(a.completed_at) >= cutoff) || (["delivered", "failed", "returned"].includes(a.status) && Date.parse(a.updated_at) >= cutoff))
      .map((a) => tx.get("delivery_partners", a.partner_id)?.user_id).filter(Boolean);
    return { user_id: order.user_id, store_id: order.store_id, internal_state: order.internal_state, assigned_user_ids: partners };
  }

  // Order not visible to the actor -> NOT_FOUND (do not confirm existence).
  function readable(tx, actor, order) {
    if (isSystem(actor)) return;
    if (!can(actor, "order.read", orderResource(tx, order))) throw new PlatformError("NOT_FOUND", "Order not found.", { action: "order.read" });
  }

  const refundStatusForCustomer = (s) => (s === "succeeded" ? "refunded" : s === "failed" ? "delayed" : s === "rejected" ? "rejected" : s === "cancelled" ? "cancelled" : "in_progress");

  function view(tx, actor, order) {
    const items = itemsOf(tx, order.id);
    const isCustomerView = !isSystem(actor) && order.user_id === actor.userId && !actor.roles.some((r) => r.role !== "customer");
    const hist = tx.list("order_status_history", { where: { order_id: order.id }, orderBy: "seq" });
    const payment = activePayment(tx, order.id);
    const asg = tx.list("assignments", { where: { order_id: order.id, status: { in: ["accepted", "picked_up"] } } })[0] || null;
    let rider = null;
    if (asg) {
      const partner = tx.get("delivery_partners", asg.partner_id);
      const u = partner && tx.get("users", partner.user_id);
      if (u) rider = { first_name: u.name.split(" ")[0], vehicle_type: partner.vehicle_type, phone_masked: `${"*".repeat(Math.max(0, u.phone.length - 4))}${u.phone.slice(-4)}`, assignment_status: asg.status };
    }
    const owner = tx.get("users", order.user_id);
    const { delivery_otp_hash, ...rest } = order;
    let out = {
      ...rest, user_email: owner ? owner.email : null, items,
      history: isCustomerView ? hist.map((h) => ({ seq: h.seq, status: h.customer_status, at: h.created_at, ...(["failed_delivery", "returning"].includes(h.to_state) ? { detail: h.to_state } : {}) })) : hist,
      payment: payment ? (isCustomerView ? { id: payment.id, method: payment.method, status: payment.status, amount: payment.amount, expires_at: payment.expires_at } : payment) : null,
      refunds: tx.list("refunds", { where: { order_id: order.id } }).map((r) => (isCustomerView ? { id: r.id, status: refundStatusForCustomer(r.status), amount: r.amount } : r)),
      rider,
    };
    if (isCustomerView && ["packed", "ready_for_pickup", "rider_assigned", "rider_accepted", "picked_up", "delivery_attempted"].includes(order.internal_state)) out.delivery_otp = deriveOtp(order);
    if (!isCustomerView) out = applyMask(fieldMask(actor, "orders"), out);
    if (isCustomerView) { delete out.cancel_requested_by; delete out.cancelled_by; }
    // riders only see contact data until the job is finished
    if (!isSystem(actor) && actor.roles.some((r) => r.role === "delivery_partner") && ["delivered", "failed_delivery", "returned"].includes(order.internal_state)) {
      if (out.shipping_address) out.shipping_address = { city: out.shipping_address.city, pincode: out.shipping_address.pincode };
    }
    return out;
  }
  fn.orderView = view;

  // ---- the single state-change function ----------------------------------------------------------------------------
  // opts: { expectedVersion, payload, force, reason, effects(order) -> { patch?, metadata? }, eventLabel }
  function applyTransition(tx, actor, order, event, opts = {}) {
    const def = ORDER_MACHINE.events[event];
    if (!def) throw new PlatformError("INVALID_TRANSITION", "Unknown event.", { from: order.internal_state, event, allowed_events: allowedEvents(ORDER_MACHINE, order.internal_state) });
    if (order.internal_state === "cancelled" && event !== "cancel") throw new PlatformError("ORDER_CANCELLED", "This order was cancelled.", { order_id: order.id, current_version: order.version });
    step(ORDER_MACHINE, order.internal_state, event); // from-state check
    if (!opts.force && !isSystem(actor)) {
      const ok = actor.roles.some((r) => {
        if (!def.actors.includes(r.role)) return false;
        if (r.role === "store_manager" || r.role === "picker_packer") return r.store_id === order.store_id;
        if (r.role === "customer") return order.user_id === actor.userId;
        return true;
      });
      if (!ok) throw new PlatformError("FORBIDDEN", "You are not allowed to do this.", { action: `order.${event}`, event });
    } else if (isSystem(actor) && !def.actors.includes("system") && !opts.force) {
      throw new PlatformError("FORBIDDEN", "The system cannot perform this event.", { event });
    }
    if (opts.expectedVersion !== undefined && opts.expectedVersion !== null && opts.expectedVersion !== order.version) {
      throw new PlatformError("VERSION_CONFLICT", "The order changed. Refresh and try again.", { order_id: order.id, current_version: order.version });
    }
    const eff = opts.effects ? opts.effects(order) || {} : {};
    const to = def.to === null ? order.internal_state : def.to;
    const patch = { ...(eff.patch || {}) };
    if (to !== order.internal_state) { patch.internal_state = to; patch.status = STATUS_OF[to]; }
    const next = Object.keys(patch).length ? tx.update("orders", order.id, patch, { expectedVersion: opts.expectedVersion ?? order.version }) : order;
    if (to !== order.internal_state) {
      recordHistory(tx, ctx, order, { from: order.internal_state, to, event, actor, reason: opts.reason, metadata: eff.metadata });
    }
    const ch = changedFields(order, next);
    audit(tx, ctx, actor, `order.${event}`, ["order", order.id], { before: ch.before, after: ch.after, reason: opts.reason, store_id: order.store_id });
    return next;
  }
  fn.applyTransition = applyTransition;

  // ---- cancellation core -------------------------------------------------------------------------------------------
  function cancelCore(tx, actor, order, { reason, event = "cancel", reasonText, expectedVersion }) {
    const wasPendingPayment = order.internal_state === "pending_payment";
    const next = applyTransition(tx, actor, order, event, {
      expectedVersion, reason: reasonText || reason, force: isSystem(actor),
      effects: () => ({ patch: { cancel_reason: reason, cancelled_at: ctx.clock.iso(), cancelled_by: actorId(actor), cancel_request_status: order.cancel_request_status === "requested" ? "approved" : order.cancel_request_status } }),
    });
    fn.inventory.releaseReservations(tx, ctx, actor, order.id, reason === "payment_timeout" ? "expired" : "released", `cancel: ${reason}`);
    fn.delivery.cancelLive(tx, actor, next, "order_cancelled");
    // payment effect (STATE-MACHINES.md 4.3)
    const pay = activePayment(tx, order.id);
    if (pay) {
      if (pay.status === "created" || pay.status === "pending" || pay.status === "cod_due") {
        if (pay.status === "pending" && pay.provider_order_id) { try { ctx.gateways.payment.cancelIntent(pay.provider_order_id); } catch { /* best effort */ } }
        fn.payments.setStatus(tx, actor, pay, "void");
      } else if (pay.status === "captured" || pay.status === "partially_refunded") {
        const r = fn.refunds.create(tx, SYSTEM, { order: next, payment: pay, reason: "order_cancelled", scope: "full", scope_key: `cancel:${order.id}` });
        void r;
      }
    }
    revertCoupon(tx, next);
    if (!wasPendingPayment || reason !== "payment_timeout") { /* customer always told */ }
    queueNotification(tx, ctx, { user_id: order.user_id, template: "order.cancelled", payload: { order_id: order.id, display_no: order.display_no, reason }, dedupe: order.id });
    return next;
  }
  fn.cancelCore = cancelCore;

  function revertCoupon(tx, order) {
    if (!order.coupon_id) return;
    const applied = tx.list("coupon_redemptions", { where: { order_id: order.id, coupon_id: order.coupon_id } });
    if (applied.some((r) => r.status === "applied") && !applied.some((r) => r.status === "reverted")) {
      const a = applied.find((r) => r.status === "applied");
      tx.insert("coupon_redemptions", { id: tx.nextId("cpr"), coupon_id: order.coupon_id, user_id: order.user_id, order_id: order.id, discount_amount: a.discount_amount, status: "reverted", created_at: ctx.clock.iso() });
    }
  }

  // ---- handlers for store-side events ------------------------------------------------------------------------------
  const HANDLERS = {
    accept: (tx, order) => { queueNotification(tx, ctx, { user_id: order.user_id, template: "order.confirmed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id }); return {}; },
    start_picking: (tx, order, actor) => ({ metadata: { picked_by: actorId(actor) } }),
    finish_picking: (tx, order, actor, payload) => {
      const items = itemsOf(tx, order.id);
      const lines = new Map((payload.lines || []).map((l) => [l.order_item_id, l]));
      const errs = {};
      for (const it of items) {
        const l = lines.get(it.id);
        if (!l || !Number.isInteger(l.picked_qty) || l.picked_qty < 0 || l.picked_qty > it.qty) errs[it.id] = "picked_qty must be between 0 and the ordered quantity";
        else if (l.picked_qty < it.qty && !(l.short_reason && String(l.short_reason).trim())) errs[it.id] = "short_reason required";
      }
      if (Object.keys(errs).length) throw bad(errs, "Every line needs a picked quantity.");
      if (items.every((it) => lines.get(it.id).picked_qty === 0)) throw new PlatformError("VALIDATION_FAILED", "Every line is short. Cancel the order with reason out_of_stock instead.", { code: "ALL_LINES_SHORT", fields: {} });
      let shortValue = 0;
      const payment = activePayment(tx, order.id);
      const shorts = [];
      for (const it of items) {
        const l = lines.get(it.id);
        const shortage = it.qty - l.picked_qty;
        tx.update("order_items", it.id, { picked_qty: l.picked_qty, fulfilment_status: shortage > 0 ? "short" : "picked" });
        if (shortage > 0) {
          const rsv = tx.list("reservations", { where: { order_item_id: it.id, status: "committed" } })[0];
          if (rsv) fn.inventory.shortPick(tx, ctx, actor, rsv, shortage, l.short_reason);
          const value = shortage * it.unit_price - prorate(it.discount_share, shortage, it.qty);
          shortValue += value;
          shorts.push({ item: it, shortage, value });
        }
      }
      if (shortValue > 0 && payment) {
        if (payment.status === "captured") {
          for (const s of shorts) fn.refunds.create(tx, SYSTEM, { order, payment, reason: "short_pick", scope: "partial", scope_key: `short:${s.item.id}`, items: [{ order_item_id: s.item.id, qty: s.shortage, amount: s.value }] });
        } else if (payment.status === "cod_due") tx.update("payments", payment.id, { amount: payment.amount - shortValue });
        queueNotification(tx, ctx, { user_id: order.user_id, template: "order.item_unavailable", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      }
      return { patch: { short_adjustment: shortValue }, metadata: { short_lines: shorts.length } };
    },
    start_packing: () => ({}),
    finish_packing: (tx, order) => {
      queueNotification(tx, ctx, { user_id: order.user_id, template: "order.packed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      return { patch: { delivery_otp_hash: otpHash(deriveOtp(order), order), otp_failed_count: 0, otp_locked: false } };
    },
    mark_ready: (tx, order) => {
      if (order.cancel_request_status === "requested") {
        throw new PlatformError("INVALID_TRANSITION", "Resolve the pending cancellation request first.", { from: order.internal_state, event: "mark_ready", allowed_events: [], reason: "cancel_request_pending" });
      }
      return {};
    },
    reopen_picking: () => ({}),
    reopen_packing: () => ({}),
    complete_return: (tx, order, actor, payload) => {
      const items = itemsOf(tx, order.id);
      const lines = new Map((payload.lines || []).map((l) => [l.order_item_id, l]));
      const errs = {};
      for (const it of items) {
        const l = lines.get(it.id);
        if (!l || !["sellable", "damaged"].includes(l.result)) errs[it.id] = "result must be sellable or damaged";
      }
      if (Object.keys(errs).length) throw bad(errs, "QC result needed for every line.");
      for (const it of items) {
        const l = lines.get(it.id);
        const qty = it.picked_qty ?? it.qty;
        if (qty > 0) fn.inventory.restock(tx, ctx, actor, { store_id: order.store_id, product_id: it.product_id, qty, sellable: l.result === "sellable", order_id: order.id, reason: l.reason || (l.result === "damaged" ? "damaged on return" : null) });
        tx.update("order_items", it.id, { fulfilment_status: "returned" });
      }
      const pay = activePayment(tx, order.id);
      if (pay) {
        if (pay.status === "captured" || pay.status === "partially_refunded") {
          const customerFault = P.customer_fault_failure_reasons.includes(order.last_failure_reason);
          const retained = P.retain_delivery_fee_on_customer_fault && customerFault ? order.delivery_fee : 0;
          const refundable = fn.refunds.refundable(tx, pay);
          const amount = Math.max(0, refundable - retained);
          if (amount > 0) fn.refunds.create(tx, SYSTEM, { order, payment: pay, reason: "failed_delivery_return", scope: "full", scope_key: `return:${order.id}`, amount });
        } else if (pay.status === "cod_due") fn.payments.setStatus(tx, actor, pay, "void");
      }
      fn.delivery.completeReturn(tx, actor, order);
      queueNotification(tx, ctx, { user_id: order.user_id, template: "order.returned", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      return {};
    },
  };

  function runStoreEvent(tx, actor, orderId, event, { expectedVersion, payload = {}, reason, force = false }) {
    const order = loadOrder(tx, orderId);
    // delivery-owned events keep their side effects in the delivery service
    if (event === "start_return" || event === "mark_failed_delivery") return fn.delivery.storeSideEvent(tx, actor, order, event, { expectedVersion, payload, reason, force });
    const next = applyTransition(tx, actor, order, event, {
      expectedVersion, reason, force,
      effects: (o) => HANDLERS[event](tx, o, actor, payload),
    });
    if (event === "mark_ready" && P.auto_dispatch && ctx.flags.autoDispatch !== false) fn.delivery.offerNext(tx, SYSTEM, loadOrder(tx, order.id));
    if (event === "accept" || event === "payment_captured") { /* nothing else */ }
    return loadOrder(tx, next.id);
  }

  // SYS auto-accept (policy) is applied right after the order becomes stock_reserved.
  fn.afterPaid = (tx, orderId) => {
    if (P.auto_accept) runStoreEvent(tx, SYSTEM, orderId, "accept", {});
  };

  // ---- placement --------------------------------------------------------------------------------------------------------
  function placeOrder(actor, input) {
    const idem = input && input.idempotency_key;
    return exec(actor, { action: "order.create", idem: { key: idem, payload: { ...input, idempotency_key: undefined } } }, (tx, a) => {
      assertCan(a, "order.create");
      if (!idem) throw bad({ idempotency_key: "required" }, "An idempotency key is required.");
      const { items: rawItems, address_id, address: inlineAddr, payment_method, coupon_code, customer_note, expected_total, legacy_id } = input;
      if (!["upi", "card", "netbanking", "cod"].includes(payment_method)) throw bad({ payment_method: "upi, card, netbanking or cod" });
      if (!Array.isArray(rawItems) || !rawItems.length) throw bad({ items: "cart is empty" }, "Your cart is empty.");
      // address
      let addr, addrId = null;
      if (address_id) {
        const row = tx.get("addresses", address_id);
        if (!row || row.deleted_at || row.user_id !== a.userId) throw new PlatformError("NOT_FOUND", "Address not found.");
        addr = row; addrId = row.id;
      } else if (inlineAddr) addr = inlineAddr;
      else throw bad({ address: "required" });
      const fe = {};
      for (const f of ["recipient_name", "phone", "line1", "city", "state"]) if (!addr[f] || !String(addr[f]).trim()) fe[f] = "required";
      if (!/^\d{6}$/.test(String(addr.pincode || ""))) fe.pincode = "Must be 6 digits";
      if (Object.keys(fe).length) throw bad(fe);
      const snapshot = { recipient_name: addr.recipient_name, phone: addr.phone, line1: addr.line1, line2: addr.line2 ?? null, landmark: addr.landmark ?? null, city: addr.city, state: addr.state, pincode: String(addr.pincode) };
      // service area and store
      const areas = tx.list("service_areas", { where: { pincode: snapshot.pincode, is_active: true }, orderBy: "-priority" });
      let area = null, store = null, closed = false;
      for (const s of areas) {
        const st = tx.get("stores", s.store_id);
        if (!st || st.deleted_at || !st.is_active) continue;
        if (!st.accepts_orders || !isIstOpen(st, ctx.clock.now())) { closed = true; continue; }
        area = s; store = st; break;
      }
      if (!area) throw new PlatformError("VALIDATION_FAILED", closed ? "The store is not taking orders right now." : "We do not deliver to this pincode yet.", { code: closed ? "STORE_CLOSED" : "NOT_SERVICEABLE", fields: { pincode: closed ? "store closed" : "not serviceable" } });
      // lines (price re-read from the catalogue)
      const merged = new Map();
      for (const r of rawItems) {
        const prod = r.product_id ? tx.get("products", r.product_id) : tx.list("products", { where: { slug: r.slug } })[0];
        if (!prod || prod.deleted_at || !prod.is_active) throw bad({ items: `unknown or inactive product ${r.slug || r.product_id}` });
        if (!Number.isInteger(r.qty) || r.qty <= 0) throw bad({ items: "qty must be a positive integer" });
        const cur = merged.get(prod.id) || { prod, qty: 0 };
        cur.qty += r.qty; merged.set(prod.id, cur);
      }
      const lines = [...merged.values()];
      for (const l of lines) if (l.prod.max_qty_per_order && l.qty > l.prod.max_qty_per_order) throw bad({ items: `max ${l.prod.max_qty_per_order} of ${l.prod.slug} per order` });
      const catLines = lines.map((l) => ({ category_id: l.prod.category_id, amount: l.prod.price * l.qty }));
      const subtotalRaw = catLines.reduce((s, l) => s + l.amount, 0);
      if (subtotalRaw < area.min_order_value) throw new PlatformError("VALIDATION_FAILED", "The order is below the minimum order value.", { code: "MIN_ORDER_NOT_MET", min_order_value: area.min_order_value, fields: { items: "below minimum order value" } });
      let cp = null;
      if (coupon_code) cp = applyCoupon(tx, ctx, { code: coupon_code, user_id: a.userId, subtotal: subtotalRaw, lines: catLines });
      const totals = computeTotals({ items: lines.map((l) => ({ unit_price: l.prod.price, qty: l.qty, tax_rate_bp: l.prod.tax_rate_bp })), discount: cp ? cp.discount : 0, area, freeDelivery: cp ? cp.free_delivery : false });
      if (totals.total <= 0) throw bad({ items: "order total must be positive" });
      if (expected_total !== undefined && expected_total !== null && expected_total !== totals.total) throw new PlatformError("PRICE_CHANGED", "Prices changed. Review your cart.", { new_total: totals.total, expected_total });
      if (payment_method === "cod" && (!P.cod_enabled || totals.total > P.cod_max_order_total)) throw new PlatformError("VALIDATION_FAILED", "Cash on delivery is not available for this order.", { code: "COD_NOT_AVAILABLE", fields: { payment_method: "cod not available" } });
      // order + items
      const now = ctx.clock.iso();
      const prepaid = payment_method !== "cod";
      const state = prepaid ? "pending_payment" : "stock_reserved";
      const orderId = tx.nextId("ord");
      const order = tx.insert("orders", {
        id: orderId, display_no: tx.nextNo("KN", "order"), legacy_id: legacy_id ?? null, user_id: a.userId, store_id: store.id,
        status: STATUS_OF[state], internal_state: state,
        subtotal: totals.subtotal, discount: totals.discount, delivery_fee: totals.delivery_fee, tax: totals.tax, total: totals.total, currency: "INR",
        coupon_id: cp ? cp.coupon.id : null, payment_method, shipping_address: snapshot, address_id: addrId, customer_note: customer_note ?? null,
        delivery_otp_hash: null, delivery_attempts: 0, otp_failed_count: 0, otp_locked: false, last_failure_reason: null, short_adjustment: 0,
        eta_at: addMs(now, area.eta_minutes * 60000), cancel_request_status: "none", cancel_requested_at: null, cancel_requested_by: null,
        cancel_reason: null, cancel_deny_reason: null, cancelled_at: null, cancelled_by: null, placed_at: now, delivered_at: null, idempotency_key: idem, version: 1,
      });
      const itemRows = lines.map((l, i) => tx.insert("order_items", {
        id: tx.nextId("oit"), order_id: order.id, product_id: l.prod.id, sku: l.prod.sku, name: l.prod.name, image_url: l.prod.image_url,
        unit_price: l.prod.price, mrp: l.prod.mrp, tax_rate_bp: l.prod.tax_rate_bp, qty: l.qty, picked_qty: null, delivered_qty: null,
        discount_share: totals.shares[i], line_total: totals.lineTotals[i], refunded_qty: 0, fulfilment_status: "pending", slug: l.prod.slug,
      }));
      // stock: all or nothing; throws INSUFFICIENT_STOCK and rolls everything back
      const expiresAt = addMs(now, P.reservation_ttl_minutes * 60000);
      fn.inventory.reserve(tx, ctx, a, { order, lines: itemRows.map((it) => ({ order_item_id: it.id, product_id: it.product_id, qty: it.qty, slug: it.slug })), status: prepaid ? "held" : "committed", expiresAt });
      recordHistory(tx, ctx, order, { from: null, to: state, event: "create", actor: a });
      if (cp) tx.insert("coupon_redemptions", { id: tx.nextId("cpr"), coupon_id: cp.coupon.id, user_id: a.userId, order_id: order.id, discount_amount: totals.discount, status: "applied", created_at: now });
      const { payment, warnings } = fn.payments.createForOrder(tx, a, order, prepaid ? { method: payment_method } : { method: "cod" });
      queueNotification(tx, ctx, { user_id: a.userId, template: prepaid ? "order.pending_payment" : "order.placed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      audit(tx, ctx, a, "order.create", ["order", order.id], { after: { internal_state: state, total: order.total, store_id: store.id }, store_id: store.id });
      if (!prepaid) fn.afterPaid(tx, order.id);
      return { order: view(tx, a, loadOrder(tx, order.id)), payment_id: payment.id, reservation_expires_at: prepaid ? expiresAt : null, warnings };
    });
  }

  // ---- public API -----------------------------------------------------------------------------------------------------------
  const api = {
    placeOrder,

    get(actor, order_id) {
      return exec(actor, { action: "order.read", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        readable(tx, a, o);
        return view(tx, a, o);
      });
    },

    // Summaries, scoped to the actor. filters: status, internal_state, store_id, user_id (staff), limit
    list(actor, { status, internal_state, store_id, user_id, limit } = {}) {
      return exec(actor, { action: "order.list" }, (tx, a) => {
        const frags = scopeFilter(a, "orders");
        let rows = tx.list("orders", { where: { ...(status ? { status } : {}), ...(internal_state ? { internal_state } : {}), ...(store_id ? { store_id } : {}), ...(user_id ? { user_id } : {}) }, orderBy: "-placed_at" });
        rows = rows.filter((o) => inScope(frags, o));
        if (!isSystem(a) && a.roles.some((r) => r.role === "delivery_partner") && a.partnerId) {
          const mine = tx.list("assignments", { where: { partner_id: a.partnerId } }).map((x) => x.order_id);
          const extra = tx.list("orders").filter((o) => mine.includes(o.id) && !rows.some((r) => r.id === o.id));
          rows = rows.concat(extra.filter((o) => can(a, "order.read", orderResource(tx, o))));
        }
        if (limit) rows = rows.slice(0, limit);
        return rows.map((o) => { const { delivery_otp_hash, ...r } = o; return r; });
      });
    },

    // Store-side events only. Cancel, payment and delivery events have their own entry points.
    transition(actor, { order_id, event, expected_version, payload, reason, idempotency_key }) {
      return exec(actor, { action: `order.${event}`, entity: ["order", order_id || ""], idem: { key: idempotency_key, payload: { order_id, event, payload } } }, (tx, a) => {
        if (!STORE_EVENTS.includes(event)) {
          const o = loadOrder(tx, order_id);
          throw new PlatformError("INVALID_TRANSITION", "That event cannot be sent directly.", { from: o.internal_state, event, allowed_events: allowedEvents(ORDER_MACHINE, o.internal_state).filter((e) => STORE_EVENTS.includes(e)) });
        }
        const o = loadOrder(tx, order_id);
        if (!isSystem(a) && !a.roles.some((r) => r.role !== "customer" && (r.store_id ? r.store_id === o.store_id : true))) throw new PlatformError("FORBIDDEN", "You are not allowed to do this.", { action: `order.${event}` });
        const next = runStoreEvent(tx, a, order_id, event, { expectedVersion: expected_version, payload: payload || {}, reason });
        return view(tx, a, next);
      });
    },

    // Override for stuck orders. Reason mandatory, always audited, limited by role (PERMISSIONS.md 3.3).
    forceTransition(actor, { order_id, event, reason, expected_version, payload }) {
      return exec(actor, { action: "order.force_transition", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        assertCan(a, "order.force_transition", { store_id: o.store_id });
        if (!(reason && reason.trim())) throw bad({ reason: "required" }, "A reason is required.");
        if (!isSystem(a) && !hasRole(a, "super_admin")) {
          const allowed = a.roles.flatMap((r) => (r.role === "store_manager" && r.store_id === o.store_id) || r.role === "support_supervisor" ? FORCE_BY_ROLE[r.role] : []);
          if (!allowed.includes(event)) throw new PlatformError("FORBIDDEN", "Your role cannot force this event.", { action: "order.force_transition", event });
        }
        if (["payment_captured", "cancel", "expire", "approve_cancel", "request_cancel", "deny_cancel"].includes(event)) throw new PlatformError("FORBIDDEN", "Use the dedicated flow for this event.", { event });
        const next = runStoreEvent(tx, a, order_id, event, { expectedVersion: expected_version, payload: payload || {}, reason: `forced: ${reason}`, force: true });
        return view(tx, a, next);
      });
    },

    cancel(actor, { order_id, reason, expected_version, idempotency_key }) {
      return exec(actor, { action: "order.cancel", entity: ["order", order_id || ""], idem: { key: idempotency_key, payload: { order_id, reason } } }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        readable(tx, a, o);
        if (!P.cancel_reasons.includes(reason)) throw bad({ reason: `one of ${P.cancel_reasons.join(", ")}` }, "A cancellation reason is required.");
        if (reason === "fraud_suspected" && !(isSystem(a) || a.roles.some((r) => ["store_manager", "support_supervisor", "super_admin"].includes(r.role)))) throw new PlatformError("FORBIDDEN", "That reason is for staff only.", { action: "order.cancel" });
        const owner = !isSystem(a) && o.user_id === a.userId;
        const el = eligibility(o, roleNames(a), owner);
        if (el.mode === "noop") {
          audit(tx, ctx, a, "order.cancel.duplicate", ["order", o.id], { reason: "already_cancelled", store_id: o.store_id });
          return { order: view(tx, a, o), already_cancelled: true };
        }
        if (!el.allowed) {
          if (el.code) throw new PlatformError(el.code, "This order can no longer be cancelled.", { reason: el.reason, next_actions: el.next_actions, internal_state: o.internal_state });
          throw new PlatformError("FORBIDDEN", "You are not allowed to cancel this order.", { action: "order.cancel" });
        }
        if (!isSystem(a)) {
          const staffDirect = a.roles.some((r) => (r.role === "store_manager" && r.store_id === o.store_id) || ["support_supervisor", "super_admin", "support_agent"].includes(r.role));
          if (!owner && !staffDirect) throw new PlatformError("FORBIDDEN", "You are not allowed to cancel this order.", { action: "order.cancel" });
        }
        if (el.mode === "request") return { order: requestCancelCore(tx, a, o, reason, expected_version), mode: "request" };
        const next = cancelCore(tx, a, o, { reason, expectedVersion: expected_version });
        return { order: view(tx, a, next), mode: "direct" };
      });
    },

    requestCancel(actor, { order_id, reason, expected_version, idempotency_key }) {
      return exec(actor, { action: "order.request_cancel", entity: ["order", order_id || ""], idem: { key: idempotency_key, payload: { order_id, reason } } }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        readable(tx, a, o);
        assertCan(a, "order.request_cancel", { user_id: o.user_id });
        if (!P.cancel_reasons.includes(reason) || reason === "fraud_suspected") throw bad({ reason: "invalid reason" });
        return { order: requestCancelCore(tx, a, o, reason, expected_version), mode: "request" };
      });
    },

    decideCancel(actor, { order_id, approve, note, expected_version }) {
      return exec(actor, { action: approve ? "order.approve_cancel" : "order.deny_cancel", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        assertCan(a, "order.decide_cancel", { store_id: o.store_id });
        if (o.cancel_request_status !== "requested") throw new PlatformError("INVALID_TRANSITION", "There is no pending cancellation request.", { from: o.internal_state, event: approve ? "approve_cancel" : "deny_cancel", allowed_events: [], reason: "no_pending_request" });
        if (approve) return view(tx, a, cancelCore(tx, a, o, { reason: o.cancel_reason || "other", event: "approve_cancel", expectedVersion: expected_version }));
        if (!(note && note.trim())) throw bad({ note: "deny reason required" });
        const next = applyTransition(tx, a, o, "deny_cancel", { expectedVersion: expected_version, reason: note, effects: () => ({ patch: { cancel_request_status: "denied", cancel_deny_reason: note } }) });
        queueNotification(tx, ctx, { user_id: o.user_id, template: "order.cancel_denied", payload: { order_id: o.id, display_no: o.display_no }, dedupe: o.id });
        return view(tx, a, next);
      });
    },

    addNote(actor, { order_id, note }) {
      return exec(actor, { action: "order.note", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        assertCan(a, "order.note", { store_id: o.store_id });
        if (!(note && note.trim())) throw bad({ note: "required" });
        audit(tx, ctx, a, "order.note", ["order", o.id], { after: { note }, store_id: o.store_id });
        return { ok: true };
      });
    },

    // Owner can read the handover code once the parcel is packed.
    getDeliveryOtp(actor, order_id) {
      return exec(actor, { action: "order.otp", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        if (isSystem(a) || o.user_id !== a.userId) throw new PlatformError("NOT_FOUND", "Order not found.");
        if (!o.delivery_otp_hash || ["delivered", "cancelled", "returned"].includes(o.internal_state)) throw new PlatformError("INVALID_TRANSITION", "No active delivery code.", { from: o.internal_state, event: "otp", allowed_events: [] });
        return { otp: deriveOtp(o) };
      });
    },

    // Support supervisor override after the OTP was locked by wrong attempts.
    resetDeliveryOtp(actor, { order_id, reason }) {
      return exec(actor, { action: "order.reset_otp", entity: ["order", order_id || ""] }, (tx, a) => {
        const o = loadOrder(tx, order_id);
        assertCan(a, "order.reset_otp", { store_id: o.store_id });
        if (!(reason && reason.trim())) throw bad({ reason: "required" });
        const next = tx.update("orders", o.id, { otp_failed_count: 0, otp_locked: false });
        audit(tx, ctx, a, "order.reset_otp", ["order", o.id], { reason, store_id: o.store_id });
        return view(tx, a, next);
      });
    },

    // Allowed next events for UI hints (pure helper, no actor checks beyond roles).
    nextEvents(order, actor) {
      return allowedEvents(ORDER_MACHINE, order.internal_state, null).filter((e) => !actor || isSystem(actor) || ORDER_MACHINE.events[e].actors.some((r) => roleNames(actor).includes(r)));
    },
  };

  function requestCancelCore(tx, a, o, reason, expectedVersion) {
    if (!REQUEST_GROUP.includes(o.internal_state)) throw new PlatformError("INVALID_TRANSITION", "A cancellation request is not possible in this state.", { from: o.internal_state, event: "request_cancel", allowed_events: allowedEvents(ORDER_MACHINE, o.internal_state) });
    if (o.cancel_request_status !== "none") throw new PlatformError("INVALID_TRANSITION", "A cancellation request was already made.", { from: o.internal_state, event: "request_cancel", allowed_events: [], reason: "already_requested" });
    const next = applyTransition(tx, a, o, "request_cancel", {
      expectedVersion, reason,
      effects: () => ({ patch: { cancel_request_status: "requested", cancel_requested_at: ctx.clock.iso(), cancel_requested_by: a.userId, cancel_reason: reason } }),
    });
    for (const uid of storeStaffIds(tx, o.store_id)) queueNotification(tx, ctx, { user_id: uid, template: "order.cancel_requested", payload: { order_id: o.id, display_no: o.display_no }, dedupe: o.id });
    queueNotification(tx, ctx, { user_id: o.user_id, template: "order.cancel_requested_ack", payload: { order_id: o.id, display_no: o.display_no }, dedupe: o.id });
    return view(tx, a, next);
  }

  fn.orders = { applyTransition, cancelCore, loadOrder, itemsOf, activePayment, paymentsOf, deriveOtp, otpHash, view, runStoreEvent };
  return api;
}

export { PP_VISIBLE_STATES, nextPaymentState };
