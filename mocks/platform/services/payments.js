// Payments: payment state machine, mock provider intent, signed webhook ingestion (idempotent), expiry, COD,
// reconciliation. Money moves only through these functions; orders react to payment events here.

import { PlatformError, commitThenFail } from "../errors.js";
import { SYSTEM, assertCan, isSystem, can } from "../policy/permissions.js";
import { PAYMENT_MACHINE, REFUNDABLE_PAYMENT_STATES } from "../machines/payment.js";
import { step } from "../machines/util.js";
import { audit, queueNotification, usersWithRole, actorId } from "../core.js";
import { addMs } from "../clock.js";
import { checkInventory } from "./inventory.js";

export function install(ctx, exec) {
  const P = ctx.policies;
  const fn = ctx.fn;
  const gw = () => ctx.gateways.payment;

  const ptx = (tx, payment, kind, status, amount, extra = {}) =>
    tx.insert("payment_transactions", {
      id: tx.nextId("ptx"), payment_id: payment.id, provider: payment.provider, kind, provider_txn_id: extra.provider_txn_id ?? null,
      provider_event_id: extra.provider_event_id ?? null, amount, status, raw: extra.raw ?? null, signature_valid: extra.signature_valid ?? null, created_at: ctx.clock.iso(),
    });

  // Applies one machine event to a payment row. Throws INVALID_TRANSITION for impossible moves.
  function setStatus(tx, actor, pay, event, patch = {}) {
    const to = step(PAYMENT_MACHINE, pay.status, event);
    const next = tx.update("payments", pay.id, { status: to, ...patch });
    audit(tx, ctx, actor, `payment.${event}`, ["payment", pay.id], { before: { status: pay.status }, after: { status: to }, store_id: null });
    return next;
  }

  function createForOrder(tx, actor, order, { method }) {
    const now = ctx.clock.iso();
    const warnings = [];
    if (method === "cod") {
      const pay = tx.insert("payments", {
        id: tx.nextId("pay"), order_id: order.id, method: "cod", provider: "cash", provider_order_id: null, status: "cod_due", amount: order.total,
        captured_amount: 0, refunded_amount: 0, currency: "INR", expires_at: null, captured_at: null, failure_code: null, idempotency_key: "pay-1", version: 1,
      });
      audit(tx, ctx, actor, "payment.create", ["payment", pay.id], { after: { status: "cod_due", amount: pay.amount } });
      return { payment: pay, warnings };
    }
    let pay = tx.insert("payments", {
      id: tx.nextId("pay"), order_id: order.id, method, provider: gw().name, provider_order_id: null, status: "created", amount: order.total,
      captured_amount: 0, refunded_amount: 0, currency: "INR", expires_at: addMs(now, P.payment_window_minutes * 60000), captured_at: null, failure_code: null, idempotency_key: "pay-1", version: 1,
    });
    audit(tx, ctx, actor, "payment.create", ["payment", pay.id], { after: { status: "created", amount: pay.amount } });
    try {
      const intent = gw().createIntent({ payment_id: pay.id, amount: pay.amount, currency: "INR" });
      pay = setStatus(tx, actor, pay, "start", { provider_order_id: intent.provider_order_id });
      ptx(tx, pay, "authorize", "pending", pay.amount);
    } catch (e) {
      if (!(e instanceof PlatformError && e.code === "UPSTREAM_UNAVAILABLE")) throw e;
      warnings.push({ code: "UPSTREAM_UNAVAILABLE", op: "createIntent", retry: "payments.start" });
    }
    return { payment: pay, warnings };
  }

  const refundPlace = (tx, order, pay, reason) => {
    const r = fn.refunds.create(tx, SYSTEM, { order, payment: pay, reason, scope: "full", scope_key: reason === "payment_late_capture" ? `late:${pay.id}` : `cancel:${order.id}` });
    return r;
  };

  // O3 / P3 / P7 after a verified capture.
  function onCaptured(tx, pay, order, rawEventId) {
    const now = ctx.clock.now();
    if (order.internal_state === "pending_payment") {
      let held = fn.inventory ? tx.list("reservations", { where: { order_id: order.id, status: "held" } }) : [];
      const stale = held.some((r) => r.expires_at && Date.parse(r.expires_at) <= now);
      if (stale || !held.length) {
        // reservation lapsed (or was swept) but the order is not yet cancelled: re-reserve if stock still exists
        if (held.length) fn.inventory.releaseReservations(tx, ctx, SYSTEM, order.id, "expired", "reservation expired before capture");
        const items = tx.list("order_items", { where: { order_id: order.id } });
        try {
          fn.inventory.reserve(tx, ctx, SYSTEM, { order, lines: items.map((it) => ({ order_item_id: it.id, product_id: it.product_id, qty: it.qty, slug: it.slug })), status: "committed" });
        } catch (e) {
          if (!(e instanceof PlatformError && e.code === "INSUFFICIENT_STOCK")) throw e;
          fn.cancelCore(tx, SYSTEM, order, { reason: "out_of_stock", event: "expire", reasonText: "stock gone before payment capture" });
          return "cancelled_out_of_stock";
        }
      } else fn.inventory.commitReservations(tx, ctx, order.id);
      fn.applyTransition(tx, SYSTEM, order, "payment_captured", { reason: "payment captured" });
      queueNotification(tx, ctx, { user_id: order.user_id, template: "order.placed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      queueNotification(tx, ctx, { user_id: order.user_id, template: "payment.captured", payload: { order_id: order.id, display_no: order.display_no }, dedupe: order.id });
      fn.afterPaid(tx, order.id);
      return "order_placed";
    }
    // order already closed (cancelled by customer, expired by the job): never keep the money
    if (order.internal_state === "cancelled" || order.internal_state === "returned") {
      const fresh = tx.get("payments", pay.id);
      refundPlace(tx, order, fresh, "payment_late_capture");
      return "late_capture_refunded";
    }
    return "captured_no_action";
  }

  function handleEvent(tx, evt) {
    const d = evt.data || {};
    if (evt.type === "payment.captured" || evt.type === "payment.failed") {
      const pay = tx.list("payments", { where: { provider: "mock", provider_order_id: d.provider_order_id } })[0];
      if (!pay) return "unknown_payment";
      const order = tx.get("orders", pay.order_id);
      if (evt.type === "payment.failed") {
        if (pay.status === "pending") {
          const next = setStatus(tx, SYSTEM, pay, "fail", { failure_code: d.failure_code || "failed" });
          ptx(tx, next, "fail", "failure", pay.amount, { provider_event_id: evt.id, raw: d });
          queueNotification(tx, ctx, { user_id: order.user_id, template: "payment.failed", payload: { order_id: order.id, display_no: order.display_no }, dedupe: `${order.id}:${evt.id}` });
          return "payment_failed";
        }
        ptx(tx, pay, "webhook_ignored", "failure", pay.amount, { provider_event_id: evt.id, raw: { reason: `stale failed event while ${pay.status}` } });
        return `ignored_stale_failed_${pay.status}`;
      }
      // payment.captured
      if (d.amount !== pay.amount || (d.currency || "INR") !== pay.currency) {
        ptx(tx, pay, "webhook_ignored", "failure", d.amount ?? 0, { provider_event_id: evt.id, raw: { reason: "amount_or_currency_mismatch", expected: pay.amount, got: d.amount } });
        for (const uid of usersWithRole(tx, "finance_operator")) queueNotification(tx, ctx, { user_id: uid, template: "payment.mismatch", payload: { payment_id: pay.id, order_id: pay.order_id }, dedupe: evt.id, channels: ["in_app"] });
        return "amount_mismatch";
      }
      if (["captured", "partially_refunded", "refunded", "cod_due", "cod_collected"].includes(pay.status)) {
        ptx(tx, pay, "webhook_ignored", "success", pay.amount, { provider_event_id: evt.id, raw: { reason: `already ${pay.status}` } });
        return "ignored_already_captured";
      }
      let cur = pay;
      if (cur.status === "created") cur = setStatus(tx, SYSTEM, cur, "start");
      if (cur.status === "failed") cur = setStatus(tx, SYSTEM, cur, "retry");
      const late = cur.status === "expired" || cur.status === "voided";
      const patch = { captured_amount: cur.amount, captured_at: ctx.clock.iso(), failure_code: null };
      const next = setStatus(tx, SYSTEM, cur, late ? "late_capture" : "capture", patch);
      ptx(tx, next, "capture", "success", next.amount, { provider_event_id: evt.id, provider_txn_id: d.provider_txn_id, raw: d, signature_valid: true });
      return onCaptured(tx, next, tx.get("orders", next.order_id), evt.id);
    }
    if (evt.type === "refund.processed" || evt.type === "refund.failed") {
      const refund = tx.get("refunds", d.idempotency_key);
      if (!refund) return "unknown_refund";
      if (evt.type === "refund.processed") {
        if (refund.status !== "processing") return `ignored_refund_${refund.status}`;
        fn.refunds.markSucceeded(tx, SYSTEM, refund, { provider_refund_id: d.provider_refund_id, event_id: evt.id });
        return "refund_succeeded";
      }
      if (refund.status !== "processing") return `ignored_refund_${refund.status}`;
      fn.refunds.markFailed(tx, SYSTEM, refund, d.failure_code || "failed");
      return "refund_failed";
    }
    return "unhandled_type";
  }

  fn.payments = { createForOrder, setStatus, ptx, handleEvent };

  const api = {
    // Signed provider webhook. Repeated delivery of the same event id is acknowledged and ignored.
    handleWebhook({ provider = "mock", raw_body, signature }) {
      return exec(SYSTEM, { action: "payment.webhook" }, (tx) => {
        const valid = gw().verify(raw_body, signature);
        let evt = null;
        try { evt = JSON.parse(raw_body); } catch { evt = null; }
        const now = ctx.clock.iso();
        if (!valid || !evt || !evt.id) {
          tx.insert("webhook_events", { id: tx.nextId("whk"), provider, event_id: `invalid:${tx.counter("whk_invalid")}`, signature_valid: false, payload: null, received_at: now, processed_at: now, result: "rejected_bad_signature" });
          audit(tx, ctx, SYSTEM, "payment.webhook", ["webhook", provider], { result: "denied", reason: "bad_signature" });
          return commitThenFail(new PlatformError("FORBIDDEN", "Invalid webhook signature.", { reason: "bad_signature" }));
        }
        const existing = tx.list("webhook_events", { where: { provider, event_id: evt.id } })[0];
        if (existing) return { duplicate: true, result: existing.result };
        const row = tx.insert("webhook_events", { id: tx.nextId("whk"), provider, event_id: evt.id, signature_valid: true, payload: evt, received_at: now, processed_at: null, result: null });
        const result = handleEvent(tx, evt);
        tx.update("webhook_events", row.id, { processed_at: ctx.clock.iso(), result });
        return { duplicate: false, result };
      });
    },

    // Customer starts (P2) or retries (P6) payment for a pending_payment order.
    start(actor, { order_id }) {
      return exec(actor, { action: "payment.start", entity: ["order", order_id || ""] }, (tx, a) => {
        const order = tx.get("orders", order_id);
        if (!order) throw new PlatformError("NOT_FOUND", "Order not found.");
        assertCan(a, "payment.initiate", { user_id: order.user_id });
        const pay = fn.orders.activePayment(tx, order_id);
        if (!pay || order.internal_state !== "pending_payment") throw new PlatformError("INVALID_TRANSITION", "Nothing to pay for this order.", { from: order.internal_state, event: "payment.start", allowed_events: [] });
        if (pay.expires_at && Date.parse(pay.expires_at) <= ctx.clock.now()) throw new PlatformError("RESERVATION_EXPIRED", "The payment window has closed. Please order again.", { expires_at: pay.expires_at });
        const held = tx.list("reservations", { where: { order_id, status: "held" } });
        if (!held.length) throw new PlatformError("RESERVATION_EXPIRED", "Stock is no longer held. Please order again.");
        if (pay.status === "created") {
          const intent = gw().createIntent({ payment_id: pay.id, amount: pay.amount });
          const next = setStatus(tx, a, pay, "start", { provider_order_id: intent.provider_order_id });
          ptx(tx, next, "authorize", "pending", next.amount);
          return next;
        }
        if (pay.status === "failed") {
          const next = setStatus(tx, a, pay, "retry", { failure_code: null });
          ptx(tx, next, "authorize", "pending", next.amount);
          return next;
        }
        throw new PlatformError("INVALID_TRANSITION", "Payment is already in progress.", { from: pay.status, event: "start", allowed_events: [] });
      });
    },

    // DEMO checkout: simulates the customer's bank result. handle: "success" | "fail" | "delay:<ms>" (delayed success).
    payMock(actor, { order_id, handle = "success" }) {
      const prep = exec(actor, { action: "payment.pay_mock", entity: ["order", order_id || ""] }, (tx, a) => {
        const order = tx.get("orders", order_id);
        if (!order) throw new PlatformError("NOT_FOUND", "Order not found.");
        assertCan(a, "payment.initiate", { user_id: order.user_id });
        const pay = fn.orders.activePayment(tx, order_id);
        if (!pay || pay.status !== "pending") throw new PlatformError("INVALID_TRANSITION", "Payment is not awaiting a result.", { from: pay ? pay.status : null, event: "pay", allowed_events: [] });
        const base = { provider_order_id: pay.provider_order_id, amount: pay.amount, currency: pay.currency };
        const delay = /^delay:(\d+)$/.exec(handle);
        const evt = handle === "fail" ? gw().paymentFailed(base) : gw().paymentCaptured(base);
        if (delay) {
          tx.insert("gateway_inbox", { id: tx.nextId("gwi"), deliver_at: addMs(ctx.clock.iso(), Number(delay[1])), provider: "mock", raw_body: evt.raw_body, signature: evt.signature, status: "scheduled", delivered_at: null });
          return { scheduled: true, deliver_at: addMs(ctx.clock.iso(), Number(delay[1])) };
        }
        return { scheduled: false, evt };
      });
      if (!prep.ok || prep.data.scheduled) return prep.ok ? { ok: true, data: prep.data } : prep;
      const res = api.handleWebhook(prep.data.evt);
      return res.ok ? { ok: true, data: { delivered: true, result: res.data.result } } : res;
    },

    // Job: deliver scheduled provider webhooks that are due.
    deliverScheduled() {
      const due = ctx.repo.read((tx) => tx.list("gateway_inbox", { where: { status: "scheduled" } })).filter((r) => Date.parse(r.deliver_at) <= ctx.clock.now());
      const out = [];
      for (const r of due) {
        const res = api.handleWebhook({ provider: r.provider, raw_body: r.raw_body, signature: r.signature });
        ctx.repo.transact((tx) => tx.update("gateway_inbox", r.id, { status: "delivered", delivered_at: ctx.clock.iso() }));
        out.push({ id: r.id, ok: res.ok, result: res.ok ? res.data.result : res.error.code });
      }
      return out;
    },

    // Job: unpaid orders whose payment window / reservation TTL passed -> payment expired, stock released, order cancelled (O5).
    expireDue() {
      const now = ctx.clock.now();
      const ids = ctx.repo.read((tx) => tx.list("orders", { where: { internal_state: "pending_payment" } }))
        .filter((o) => {
          const pay = ctx.repo.read((tx) => fn.orders.activePayment(tx, o.id));
          const resv = ctx.repo.read((tx) => tx.list("reservations", { where: { order_id: o.id, status: "held" } }));
          return (pay && pay.expires_at && Date.parse(pay.expires_at) <= now) || (resv.length && resv.every((r) => r.expires_at && Date.parse(r.expires_at) <= now));
        }).map((o) => o.id);
      const done = [];
      for (const id of ids) {
        const res = exec(SYSTEM, { action: "order.expire", entity: ["order", id] }, (tx, a) => {
          const o = tx.get("orders", id);
          if (!o || o.internal_state !== "pending_payment") return { skipped: true };
          const pay = fn.orders.activePayment(tx, id);
          if (pay && ["created", "pending", "failed"].includes(pay.status)) setStatus(tx, a, pay, "expire");
          // payment already moved to expired above, so cancelCore leaves it alone and no refund is raised
          fn.cancelCore(tx, a, o, { reason: "payment_timeout", event: "expire", reasonText: "payment timeout" });
          return { expired: true };
        });
        if (res.ok && res.data.expired) done.push(id);
      }
      return done;
    },

    // COD collection happens inside rider delivery (P8).
    collectCod(tx, actor, pay, amount) {
      if (amount !== pay.amount) throw new PlatformError("VALIDATION_FAILED", "Collected amount must equal the amount due.", { code: "COD_AMOUNT_MISMATCH", fields: { cod_amount_collected: `expected ${pay.amount}` } });
      const next = setStatus(tx, actor, pay, "collect_cod", { captured_amount: pay.amount, captured_at: ctx.clock.iso() });
      ptx(tx, next, "cod_collect", "success", amount);
      return next;
    },

    get(actor, payment_id) {
      return exec(actor, { action: "payment.read", entity: ["payment", payment_id || ""] }, (tx, a) => {
        const pay = tx.get("payments", payment_id);
        if (!pay) throw new PlatformError("NOT_FOUND", "Payment not found.");
        const order = tx.get("orders", pay.order_id);
        assertCan(a, "payment.read", { user_id: order.user_id, store_id: order.store_id });
        return pay;
      });
    },
    list(actor, { status } = {}) {
      return exec(actor, { action: "payment.list" }, (tx, a) => {
        assertCan(a, "payment.reconcile");
        return tx.list("payments", { where: status ? { status } : undefined });
      });
    },
    transactions(actor, payment_id) {
      return exec(actor, { action: "payment_txn.read", entity: ["payment", payment_id || ""] }, (tx, a) => {
        assertCan(a, "payment_txn.read");
        const rows = tx.list("payment_transactions", { where: { payment_id } });
        const full = isSystem(a) || a.roles.some((r) => ["super_admin", "finance_operator"].includes(r.role));
        return full ? rows : rows.map(({ raw, ...r }) => r);
      });
    },

    // FIN / SA: compares payments, refunds, transactions, orders and inventory (BACKEND-INTEGRATION.md section 9).
    reconcile(actor) {
      return exec(actor, { action: "payment.reconcile", entity: ["payment", "all"] }, (tx, a) => {
        assertCan(a, "payment.reconcile");
        const items = [];
        const pays = tx.list("payments");
        const refunds = tx.list("refunds");
        const txns = tx.list("payment_transactions");
        for (const p of pays) {
          const succ = refunds.filter((r) => r.payment_id === p.id && r.status === "succeeded").reduce((s, r) => s + r.amount, 0);
          const tsucc = txns.filter((t) => t.payment_id === p.id && t.kind === "refund" && t.status === "success").reduce((s, t) => s + t.amount, 0);
          if (p.refunded_amount !== succ || succ !== tsucc) items.push({ type: "refund_mismatch", payment_id: p.id, refunded_amount: p.refunded_amount, succeeded_refunds: succ, ledger_refunds: tsucc });
          const live = refunds.filter((r) => r.payment_id === p.id && ["requested", "approved", "processing", "succeeded"].includes(r.status)).reduce((s, r) => s + r.amount, 0);
          if (live > p.captured_amount) items.push({ type: "refunds_exceed_captured", payment_id: p.id, live, captured: p.captured_amount });
          if (p.refunded_amount > p.captured_amount || p.captured_amount > p.amount) items.push({ type: "amount_invariant", payment_id: p.id });
          const order = tx.get("orders", p.order_id);
          if (order && ["cancelled"].includes(order.internal_state) && ["captured", "partially_refunded"].includes(p.status) && p.captured_amount - p.refunded_amount > 0 &&
            !refunds.some((r) => r.payment_id === p.id && ["requested", "approved", "processing", "succeeded"].includes(r.status))) items.push({ type: "orphan_capture", payment_id: p.id, order_id: p.order_id });
          if (order && !["pending_payment", "cancelled", "returned"].includes(order.internal_state) && p.method !== "cod" && !REFUNDABLE_PAYMENT_STATES.includes(p.status) && p.status !== "refunded") items.push({ type: "order_without_capture", payment_id: p.id, order_id: p.order_id });
        }
        const inv = checkInventory(tx);
        for (const pr of inv.problems) items.push({ type: `inventory_${pr.type}`, id: pr.id });
        audit(tx, ctx, a, "payment.reconcile", ["payment", "all"], { after: { checked: pays.length, mismatches: items.length } });
        return { ok: items.length === 0, checked: pays.length, items };
      });
    },
  };
  return api;
}

export { can, actorId };
