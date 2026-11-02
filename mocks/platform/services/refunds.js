// Refunds with the invariants of STATE-MACHINES.md section 8: no duplicates (scope_key / idempotency key), cumulative
// cap against the captured amount (including in-flight refunds), item and delivery-fee caps, approval limits,
// four-eyes, and immutable terminal states. Gateway calls are idempotent by refund id.

import { PlatformError, commitThenFail } from "../errors.js";
import { SYSTEM, assertCan, isSystem, hasRole, refundLimit, roleNames, can } from "../policy/permissions.js";
import { REFUND_MACHINE, LIVE_REFUND_STATES } from "../machines/refund.js";
import { REFUNDABLE_PAYMENT_STATES } from "../machines/payment.js";
import { step } from "../machines/util.js";
import { audit, queueNotification, usersWithRole, actorId } from "../core.js";
import { prorate } from "../money.js";

const REASONS = ["order_cancelled", "payment_late_capture", "short_pick", "missing_item", "damaged_item", "wrong_item", "late_delivery", "failed_delivery_return", "goodwill", "other"];
const bad = (fields, message = "Check the highlighted fields.", extra = {}) => new PlatformError("VALIDATION_FAILED", message, { fields, ...extra });

export function install(ctx, exec) {
  const P = ctx.policies;
  const fn = ctx.fn;
  const gw = () => ctx.gateways.payment;

  const liveRefunds = (tx, payment_id) => tx.list("refunds", { where: { payment_id } }).filter((r) => LIVE_REFUND_STATES.includes(r.status));
  const refundable = (tx, pay) => pay.captured_amount - liveRefunds(tx, pay.id).reduce((s, r) => s + r.amount, 0);

  function itemUsage(tx, order_id) {
    const usage = new Map();
    for (const r of tx.list("refunds", { where: { order_id } })) {
      if (!LIVE_REFUND_STATES.includes(r.status)) continue;
      for (const it of r.items || []) {
        const u = usage.get(it.order_item_id) || { qty: 0, amount: 0, nonShortQty: 0 };
        u.qty += it.qty; u.amount += it.amount;
        if (r.reason !== "short_pick") u.nonShortQty += it.qty;
        usage.set(it.order_item_id, u);
      }
    }
    return usage;
  }

  // ---- state helpers ------------------------------------------------------------------------------------------------
  function markSucceeded(tx, actor, refund, { provider_refund_id, event_id } = {}) {
    step(REFUND_MACHINE, refund.status, "succeeded");
    const pay = tx.get("payments", refund.payment_id);
    const next = tx.update("refunds", refund.id, { status: "succeeded", provider_refund_id: provider_refund_id ?? refund.provider_refund_id ?? null });
    const refunded = pay.refunded_amount + refund.amount;
    if (refunded > pay.captured_amount) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Refunds would exceed the captured amount.", { refundable: pay.captured_amount - pay.refunded_amount });
    fn.payments.setStatus(tx, actor, pay, refunded === pay.captured_amount ? "refund_full" : "refund_partial", { refunded_amount: refunded });
    fn.payments.ptx(tx, pay, "refund", "success", refund.amount, { provider_event_id: event_id ?? null, provider_txn_id: provider_refund_id ?? null, raw: { refund_id: refund.id } });
    for (const it of refund.items || []) {
      const row = tx.get("order_items", it.order_item_id);
      if (row) tx.update("order_items", row.id, { refunded_qty: row.refunded_qty + it.qty });
    }
    const order = tx.get("orders", refund.order_id);
    queueNotification(tx, ctx, { user_id: order.user_id, template: "refund.succeeded", payload: { order_id: order.id, display_no: order.display_no, refund_id: refund.id }, dedupe: refund.id });
    audit(tx, ctx, actor, "refund.succeed", ["refund", refund.id], { before: { status: refund.status }, after: { status: "succeeded", amount: refund.amount }, store_id: order.store_id });
    return next;
  }

  function markFailed(tx, actor, refund, failure_code) {
    step(REFUND_MACHINE, refund.status, "failed");
    const pay = tx.get("payments", refund.payment_id);
    const next = tx.update("refunds", refund.id, { status: "failed", failure_code });
    fn.payments.ptx(tx, pay, "refund", "failure", refund.amount, { raw: { refund_id: refund.id, failure_code } });
    const order = tx.get("orders", refund.order_id);
    for (const uid of usersWithRole(tx, "finance_operator")) queueNotification(tx, ctx, { user_id: uid, template: "refund.failed", payload: { refund_id: refund.id, order_id: order.id }, dedupe: refund.id });
    queueNotification(tx, ctx, { user_id: order.user_id, template: "refund.delayed", payload: { order_id: order.id, display_no: order.display_no, refund_id: refund.id }, dedupe: refund.id });
    audit(tx, ctx, actor, "refund.fail", ["refund", refund.id], { after: { status: "failed", failure_code }, store_id: order.store_id });
    return next;
  }

  // approved|failed -> processing, then the gateway call (idempotent by refund id). Never creates a 2nd provider refund.
  function startProcessing(tx, actor, refund, event = "start_processing") {
    step(REFUND_MACHINE, refund.status, event);
    let cur = tx.update("refunds", refund.id, { status: "processing", failure_code: null });
    audit(tx, ctx, actor, event === "retry" ? "refund.retry" : "refund.process", ["refund", refund.id], { before: { status: refund.status }, after: { status: "processing" } });
    fn.payments.ptx(tx, tx.get("payments", cur.payment_id), "refund", "pending", cur.amount, { raw: { refund_id: cur.id } });
    if (cur.method !== "original") return cur; // manual payout: finance confirms
    let res;
    try { res = gw().refund({ idempotency_key: cur.id, amount: cur.amount }); } catch (e) {
      if (e instanceof PlatformError && e.code === "UPSTREAM_UNAVAILABLE") return cur; // stays processing; the poller finalizes
      throw e;
    }
    if (res.status === "succeeded") return markSucceeded(tx, actor, cur, { provider_refund_id: res.provider_refund_id });
    if (res.status === "failed") return markFailed(tx, actor, cur, res.failure_code || "failed");
    return tx.update("refunds", cur.id, { provider_refund_id: res.provider_refund_id });
  }

  // ---- creation (R1) ------------------------------------------------------------------------------------------------
  function create(tx, actor, spec) {
    const { order, payment, reason } = spec;
    if (!REASONS.includes(reason)) throw bad({ reason: `one of ${REASONS.join(", ")}` });
    const pay = tx.get("payments", payment.id); // always re-read inside the transaction
    if (!REFUNDABLE_PAYMENT_STATES.includes(pay.status)) throw new PlatformError("VALIDATION_FAILED", "This payment has nothing to refund.", { code: "PAYMENT_NOT_REFUNDABLE", status: pay.status, fields: {} });
    const method = spec.method || (pay.method === "cod" ? "manual_bank_transfer" : "original");
    if (pay.method === "cod" && method !== "manual_bank_transfer") throw bad({ method: "COD refunds are paid out manually" });
    if (pay.method !== "cod" && method === "manual_bank_transfer") throw bad({ method: "not valid for prepaid payments" });
    const items = spec.items || null;
    const scope = spec.scope || (items ? "partial" : "full");
    const nth = tx.list("refunds", { where: { order_id: order.id, reason } }).length + 1;
    const scope_key = spec.scope_key || (items && items.length === 1 ? `item:${items[0].order_item_id}:${reason}` : reason === "goodwill" ? `goodwill:${spec.ticket_id || order.id}:${nth}` : scope === "full" ? `full:${order.id}` : `${reason}:${order.id}:${nth}`);
    const idempotency_key = spec.idempotency_key || scope_key;
    const existing = tx.list("refunds", { where: { payment_id: pay.id } });
    const dupe = existing.find((r) => r.idempotency_key === idempotency_key) || existing.find((r) => r.scope_key === scope_key && !["rejected", "cancelled", "failed"].includes(r.status));
    if (dupe) return { refund: dupe, duplicate: true };

    // amount and item / fee caps
    const usage = itemUsage(tx, order.id);
    let amount = 0;
    const normItems = [];
    if (items) {
      for (const it of items) {
        const row = tx.get("order_items", it.order_item_id);
        if (!row || row.order_id !== order.id) throw bad({ items: "item does not belong to this order" });
        if (!Number.isInteger(it.qty) || it.qty <= 0) throw bad({ items: "qty must be a positive integer" });
        const u = usage.get(row.id) || { qty: 0, amount: 0, nonShortQty: 0 };
        if (u.qty + it.qty > row.qty) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Refund quantity exceeds the ordered quantity.", { refundable: refundable(tx, pay), order_item_id: row.id });
        if (reason !== "short_pick" && row.delivered_qty != null && u.nonShortQty + it.qty > row.delivered_qty) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Refund quantity exceeds the delivered quantity.", { refundable: refundable(tx, pay), order_item_id: row.id });
        const last = u.qty + it.qty === row.qty;
        const calc = last ? row.line_total - u.amount : prorate(row.line_total, it.qty, row.qty);
        const itemAmount = it.amount ?? calc;
        if (!Number.isInteger(itemAmount) || itemAmount < 0 || u.amount + itemAmount > row.line_total) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Refund exceeds the line total.", { refundable: refundable(tx, pay), order_item_id: row.id });
        normItems.push({ order_item_id: row.id, qty: it.qty, amount: itemAmount });
        amount += itemAmount;
      }
    }
    const fee = spec.delivery_fee_amount || 0;
    if (fee) {
      const usedFee = existing.filter((r) => LIVE_REFUND_STATES.includes(r.status)).reduce((s, r) => s + (r.delivery_fee_amount || 0), 0);
      if (!Number.isInteger(fee) || fee < 0 || usedFee + fee > order.delivery_fee) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Delivery fee can be refunded once.", { refundable: refundable(tx, pay) });
      amount += fee;
    }
    if (!items && !fee) amount = spec.amount ?? (scope === "full" ? refundable(tx, pay) : 0);
    if (items && spec.amount != null && spec.amount !== amount) throw bad({ amount: "must equal the sum of items and delivery fee" });
    if (!Number.isInteger(amount) || amount <= 0) throw bad({ amount: "must be a positive integer (paise)" });
    const room = refundable(tx, pay);
    if (amount > room) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Refund exceeds what can still be refunded.", { refundable: room, requested: amount });

    const system = isSystem(actor);
    let refund = tx.insert("refunds", {
      id: tx.nextId("rfd"), order_id: order.id, payment_id: pay.id, ticket_id: spec.ticket_id ?? null, status: "requested", reason, scope, scope_key,
      amount, items: normItems.length ? normItems : null, delivery_fee_amount: fee, method, requested_by: actorId(actor), approved_by: null, approved_at: null,
      approved_role: null, approvals: [], approval_note: null, needs_higher_approval: false, provider_refund_id: null, idempotency_key, failure_code: null, version: 1,
    });
    audit(tx, ctx, actor, "refund.request", ["refund", refund.id], { after: { amount, reason, scope_key, status: "requested" }, store_id: order.store_id });
    if (spec.ticket_id && fn.tickets) fn.tickets.refundEvent(tx, spec.ticket_id, { amount, status: "requested", refund_id: refund.id });
    if (system && P.system_refund_reasons.includes(reason)) {
      refund = tx.update("refunds", refund.id, { status: "approved", approved_at: ctx.clock.iso(), approved_role: "system", approval_note: "auto-approved by policy" });
      audit(tx, ctx, actor, "refund.approve", ["refund", refund.id], { after: { status: "approved", by: "system" }, store_id: order.store_id });
      refund = startProcessing(tx, actor, refund);
    }
    return { refund: tx.get("refunds", refund.id), duplicate: false };
  }

  const loadRefund = (tx, id) => { const r = id ? tx.get("refunds", id) : null; if (!r) throw new PlatformError("NOT_FOUND", "Refund not found."); return r; };

  // Which approval limit applies to this actor for this refund (store managers only for their own store and reasons).
  function effectiveLimit(tx, a, refund, order) {
    let limit = 0, role = null;
    const consider = (r, l) => { if (l > limit || (l === Infinity && limit !== Infinity)) { limit = l; role = r; } };
    for (const r of a.roles) {
      const spec = P.refund_limits[r.role];
      if (!spec || r.role === "customer") continue;
      if (r.role === "store_manager") {
        if (r.store_id !== order.store_id || !P.store_manager_refund_reasons.includes(refund.reason)) continue;
        const since = ctx.clock.now() - P.sm_recent_edit_block_hours * 3600000;
        const edited = tx.list("order_status_history", { where: { order_id: order.id, actor_id: a.userId } }).some((h) => Date.parse(h.created_at) >= since);
        if (edited) continue;
      }
      if (r.role === "support_agent" && refund.reason === "goodwill") continue; // goodwill always needs a supervisor or above
      consider(r.role, spec.per_refund === null ? Infinity : spec.per_refund);
    }
    return { limit, role };
  }

  const api = {
    // Human-initiated request. System-initiated refunds come from cancel / short pick / return / late capture.
    request(actor, { order_id, payment_id, reason, scope, scope_key, amount, items, delivery_fee_amount, method, ticket_id, idempotency_key }) {
      return exec(actor, { action: "refund.request", entity: ["order", order_id || ""], idem: { key: idempotency_key, payload: { order_id, reason, scope_key, amount, items, delivery_fee_amount } } }, (tx, a) => {
        const order = tx.get("orders", order_id);
        if (!order) throw new PlatformError("NOT_FOUND", "Order not found.");
        assertCan(a, "refund.request", { store_id: order.store_id });
        const smOnly = !isSystem(a) && !a.roles.some((r) => ["super_admin", "support_agent", "support_supervisor", "finance_operator"].includes(r.role));
        if (smOnly && !P.store_manager_refund_reasons.includes(reason)) throw new PlatformError("FORBIDDEN", "Store managers can only request item-related refunds.", { action: "refund.request" });
        const pays = tx.list("payments", { where: { order_id } });
        const pay = payment_id ? pays.find((p) => p.id === payment_id) : pays.filter((p) => REFUNDABLE_PAYMENT_STATES.includes(p.status))[0] || pays[pays.length - 1];
        if (!pay) throw new PlatformError("NOT_FOUND", "Payment not found.");
        if (ticket_id) {
          const t = tx.get("tickets", ticket_id);
          if (!t || t.order_id !== order_id) throw bad({ ticket_id: "ticket does not belong to this order" });
        }
        return create(tx, a, { order, payment: pay, reason, scope, scope_key, amount, items, delivery_fee_amount, method, ticket_id, idempotency_key });
      });
    },

    approve(actor, { refund_id, note, expected_version }) {
      return exec(actor, { action: "refund.approve", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        const order = tx.get("orders", refund.order_id);
        assertCan(a, "refund.approve", { store_id: order.store_id });
        if (expected_version != null && refund.version !== expected_version) throw new PlatformError("VERSION_CONFLICT", "The refund changed.", { current_version: refund.version });
        step(REFUND_MACHINE, refund.status, "approve");
        if (!isSystem(a) && refund.requested_by === a.userId) throw new PlatformError("FORBIDDEN", "You cannot approve your own request.", { action: "refund.approve", reason: "self_approval" });
        if (refund.approvals.some((x) => x.user_id === a.userId)) throw new PlatformError("FORBIDDEN", "You already approved this refund.", { action: "refund.approve", reason: "duplicate_approver" });
        const threshold = P.refund_limits.second_approver_above;
        const needsTwo = refund.amount > threshold;
        const { limit, role } = effectiveLimit(tx, a, refund, order);
        const coSigner = needsTwo && refund.approvals.length === 1 && a.roles.some((r) => ["finance_operator", "super_admin"].includes(r.role)) && refund.approvals[0].user_id !== a.userId;
        if (!coSigner && refund.amount > limit) {
          tx.update("refunds", refund.id, { needs_higher_approval: true });
          return commitThenFail(new PlatformError("FORBIDDEN_LIMIT", "This refund is above your approval limit.", { limit: limit === Infinity ? null : limit, amount: refund.amount, needs_higher_approval: true, action: "refund.approve" }));
        }
        if (needsTwo && refund.approvals.length === 0 && !hasRole(a, "super_admin")) {
          tx.update("refunds", refund.id, { needs_higher_approval: true });
          return commitThenFail(new PlatformError("FORBIDDEN_LIMIT", "Amounts above the second-approver threshold start with a super admin.", { limit: null, amount: refund.amount, needs_higher_approval: true, action: "refund.approve" }));
        }
        const limitFail = (message, details) => { tx.update("refunds", refund.id, { needs_higher_approval: true }); return commitThenFail(new PlatformError("FORBIDDEN_LIMIT", message, { ...details, amount: refund.amount, needs_higher_approval: true, action: "refund.approve" })); };
        const agentLimit = P.refund_limits.support_agent.per_refund;
        if (refund.amount > agentLimit && !(note && note.trim())) throw bad({ approval_note: "required above the support agent limit" }, "An approval note is required.");
        const spec = P.refund_limits[role] || {};
        const todayStart = ctx.clock.iso().slice(0, 10);
        if (spec.daily != null && !coSigner) {
          const used = tx.list("refunds", { where: { approved_by: a.userId } }).filter((r) => (r.approved_at || "").slice(0, 10) === todayStart).reduce((s, r) => s + r.amount, 0);
          if (used + refund.amount > spec.daily) return limitFail("Daily approval limit reached.", { daily_limit: spec.daily, used });
        }
        if (role && !coSigner && limit !== Infinity) {
          const onOrder = tx.list("refunds", { where: { order_id: order.id, approved_role: role } }).filter((r) => ["approved", "processing", "succeeded"].includes(r.status)).reduce((s, r) => s + r.amount, 0);
          if (onOrder + refund.amount > limit) return limitFail("Cumulative approvals for this order exceed your limit.", { limit, used: onOrder });
        }
        const approvals = [...refund.approvals, { user_id: actorId(a), role: role || roleNames(a)[0], at: ctx.clock.iso() }];
        if (needsTwo && approvals.length < 2) {
          const next = tx.update("refunds", refund.id, { approvals, approval_note: note ?? refund.approval_note, needs_higher_approval: true });
          audit(tx, ctx, a, "refund.approve.first", ["refund", refund.id], { after: { approvals: approvals.length }, store_id: order.store_id });
          return { refund: next, needs_second_approver: true };
        }
        let next = tx.update("refunds", refund.id, { status: "approved", approvals, approved_by: actorId(a), approved_at: ctx.clock.iso(), approved_role: role || "super_admin", approval_note: note ?? null, needs_higher_approval: false });
        audit(tx, ctx, a, "refund.approve", ["refund", refund.id], { before: { status: "requested" }, after: { status: "approved", amount: refund.amount }, reason: note, store_id: order.store_id });
        next = startProcessing(tx, a, next);
        return { refund: tx.get("refunds", refund.id) };
      });
    },

    reject(actor, { refund_id, reason }) {
      return exec(actor, { action: "refund.reject", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        const order = tx.get("orders", refund.order_id);
        assertCan(a, "refund.reject", { store_id: order.store_id });
        if (!(reason && reason.trim())) throw bad({ reason: "required" });
        step(REFUND_MACHINE, refund.status, "reject");
        const wide = !isSystem(a) && a.roles.some((r) => ["support_supervisor", "finance_operator", "super_admin"].includes(r.role));
        if (!isSystem(a) && !wide && refund.requested_by !== a.userId) throw new PlatformError("FORBIDDEN", "You can only reject your own requests.", { action: "refund.reject" });
        const next = tx.update("refunds", refund.id, { status: "rejected", approval_note: reason });
        queueNotification(tx, ctx, { user_id: order.user_id, template: "refund.rejected", payload: { order_id: order.id, display_no: order.display_no, refund_id: refund.id }, dedupe: refund.id });
        audit(tx, ctx, a, "refund.reject", ["refund", refund.id], { before: { status: "requested" }, after: { status: "rejected" }, reason, store_id: order.store_id });
        return next;
      });
    },

    cancelRequest(actor, { refund_id }) {
      return exec(actor, { action: "refund.cancel", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        const order = tx.get("orders", refund.order_id);
        step(REFUND_MACHINE, refund.status, "cancel_request");
        const privileged = isSystem(a) || a.roles.some((r) => ["support_supervisor", "finance_operator", "super_admin"].includes(r.role));
        if (!privileged && refund.requested_by !== a.userId) throw new PlatformError("FORBIDDEN", "Only the requester or a supervisor can cancel this.", { action: "refund.cancel" });
        const next = tx.update("refunds", refund.id, { status: "cancelled" });
        audit(tx, ctx, a, "refund.cancel", ["refund", refund.id], { before: { status: refund.status }, after: { status: "cancelled" }, store_id: order.store_id });
        return next;
      });
    },

    // Finance can push an approved refund (or retry a failed one) through the gateway.
    process(actor, { refund_id }) {
      return exec(actor, { action: "refund.process", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        assertCan(a, "refund.retry");
        return startProcessing(tx, a, refund);
      });
    },
    retry(actor, { refund_id }) {
      return exec(actor, { action: "refund.retry", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        assertCan(a, "refund.retry");
        if (refund.status !== "failed") throw new PlatformError("INVALID_TRANSITION", "Only failed refunds can be retried.", { from: refund.status, event: "retry", allowed_events: [] });
        const pay = tx.get("payments", refund.payment_id);
        const others = liveRefunds(tx, pay.id).filter((r) => r.id !== refund.id).reduce((s, r) => s + r.amount, 0);
        if (others + refund.amount > pay.captured_amount) throw new PlatformError("REFUND_EXCEEDS_CAPTURED", "Retrying would exceed the captured amount.", { refundable: pay.captured_amount - others });
        return startProcessing(tx, a, refund, "retry");
      });
    },
    confirmPayout(actor, { refund_id, reference }) {
      return exec(actor, { action: "refund.confirm_payout", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const refund = loadRefund(tx, refund_id);
        assertCan(a, "refund.retry");
        if (refund.method !== "manual_bank_transfer") throw bad({ method: "only manual payouts are confirmed by hand" });
        return markSucceeded(tx, a, refund, { provider_refund_id: reference || `manual_${refund.id}` });
      });
    },

    get(actor, refund_id) {
      return exec(actor, { action: "refund.read", entity: ["refund", refund_id || ""] }, (tx, a) => {
        const r = loadRefund(tx, refund_id);
        const order = tx.get("orders", r.order_id);
        assertCan(a, "refund.read", { user_id: order.user_id, store_id: order.store_id });
        return r;
      });
    },
    list(actor, { status, order_id, needs_higher_approval } = {}) {
      return exec(actor, { action: "refund.list" }, (tx, a) => {
        let rows = tx.list("refunds", { where: { ...(status ? { status } : {}), ...(order_id ? { order_id } : {}) }, orderBy: "created_at" });
        rows = rows.filter((r) => { const o = tx.get("orders", r.order_id); return can(a, "refund.read", { user_id: o.user_id, store_id: o.store_id }); });
        if (needs_higher_approval) rows = rows.filter((r) => r.needs_higher_approval && r.status === "requested");
        return rows;
      });
    },
    refundable(actor, payment_id) {
      return exec(actor, { action: "refund.refundable", entity: ["payment", payment_id || ""] }, (tx, a) => {
        const pay = tx.get("payments", payment_id);
        if (!pay) throw new PlatformError("NOT_FOUND", "Payment not found.");
        const order = tx.get("orders", pay.order_id);
        assertCan(a, "refund.read", { user_id: order.user_id, store_id: order.store_id });
        return { captured: pay.captured_amount, refunded: pay.refunded_amount, refundable: refundable(tx, pay) };
      });
    },

    // Job: approved refunds that were not processed, processing refunds whose gateway answer was lost.
    processDue() {
      const ids = ctx.repo.read((tx) => tx.list("refunds", { where: { status: { in: ["approved", "processing"] } } })).filter((r) => r.method === "original").map((r) => r.id);
      const out = [];
      for (const id of ids) {
        const res = exec(SYSTEM, { action: "refund.poll", entity: ["refund", id] }, (tx, a) => {
          const r = tx.get("refunds", id);
          if (r.status === "approved") return startProcessing(tx, a, r);
          const g = gw().getRefund(r.id);
          if (g && g.status === "succeeded") return markSucceeded(tx, a, r, { provider_refund_id: g.provider_refund_id });
          if (g && g.status === "failed") return markFailed(tx, a, r, g.failure_code || "failed");
          if (!g) {
            try { const res2 = gw().refund({ idempotency_key: r.id, amount: r.amount }); if (res2.status === "succeeded") return markSucceeded(tx, a, r, { provider_refund_id: res2.provider_refund_id }); } catch { /* still down */ }
          }
          return r;
        });
        out.push({ id, ok: res.ok, status: res.ok ? res.data.status : res.error.code });
      }
      return out;
    },
  };

  fn.refunds = { create, refundable, markSucceeded, markFailed, startProcessing };
  return api;
}
