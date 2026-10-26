// Deterministic fake payment provider. DEMO ONLY: the signing secret ships in the bundle and proves nothing.
// It never sees card data. Scriptable so tests (and the demo UI) can force failures, delays and timeouts.

import { PlatformError } from "../errors.js";
import { hmacSha256, safeEqual } from "../crypto.js";

export function createMockPaymentGateway({ secret = "demo-webhook-secret-not-secret" } = {}) {
  let seq = 0;
  // Counters restart on every page load while stored events/refunds persist, so ids carry a per-instance token.
  const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  const intents = new Map(); // provider_order_id -> { payment_id, amount, currency, cancelled }
  const refunds = new Map(); // idempotency_key -> { provider_refund_id, amount, status }
  const failNext = {};
  let refundMode = "succeed"; // succeed | pending | fail
  let timeoutNextRefund = false;
  const calls = { createIntent: 0, refund: 0, cancelIntent: 0 };

  const maybeFail = (op) => {
    if ((failNext[op] || 0) > 0) {
      failNext[op] -= 1;
      throw new PlatformError("UPSTREAM_UNAVAILABLE", "Payment provider is unavailable.", { op, retry_after: 30 });
    }
  };

  const gw = {
    name: "mock",
    secret,
    calls,
    willFail(op = "createIntent", times = 1) { failNext[op] = times; return gw; },
    willTimeoutRefund() { timeoutNextRefund = true; return gw; },
    setRefundMode(mode) { refundMode = mode; return gw; },

    createIntent({ payment_id, amount, currency = "INR" }) {
      calls.createIntent += 1;
      maybeFail("createIntent");
      const provider_order_id = `mock_order_${payment_id}`;
      intents.set(provider_order_id, { payment_id, amount, currency, cancelled: false });
      return { provider_order_id };
    },
    cancelIntent(provider_order_id) {
      calls.cancelIntent += 1;
      const i = intents.get(provider_order_id);
      if (i) i.cancelled = true;
      return { cancelled: !!i };
    },

    // Builds a signed webhook the way a provider would. `data` carries provider ids and amounts.
    buildEvent(type, data, eventId) {
      const id = eventId || `evt_mock_${run}_${++seq}`;
      const raw_body = JSON.stringify({ id, type, data });
      return { provider: "mock", event_id: id, raw_body, signature: hmacSha256(secret, raw_body) };
    },
    paymentCaptured({ provider_order_id, amount, currency = "INR" }, eventId) {
      return gw.buildEvent("payment.captured", { provider_order_id, amount, currency, provider_txn_id: `mock_txn_${provider_order_id}` }, eventId);
    },
    paymentFailed({ provider_order_id, amount, currency = "INR", failure_code = "card_declined" }, eventId) {
      return gw.buildEvent("payment.failed", { provider_order_id, amount, currency, failure_code }, eventId);
    },
    refundProcessed({ idempotency_key, provider_refund_id, amount }, eventId) {
      return gw.buildEvent("refund.processed", { idempotency_key, provider_refund_id, amount }, eventId);
    },
    refundFailed({ idempotency_key, failure_code = "bank_rejected" }, eventId) {
      return gw.buildEvent("refund.failed", { idempotency_key, failure_code }, eventId);
    },
    verify(raw_body, signature) {
      return safeEqual(hmacSha256(secret, raw_body), signature);
    },

    // One provider refund per idempotency key, even if the caller retries after a timeout.
    refund({ idempotency_key, amount }) {
      calls.refund += 1;
      maybeFail("refund");
      let r = refunds.get(idempotency_key);
      if (!r) {
        r = { provider_refund_id: `mock_rfnd_${run}_${refunds.size + 1}`, amount, status: refundMode === "fail" ? "failed" : refundMode === "pending" ? "pending" : "succeeded", failure_code: refundMode === "fail" ? "bank_rejected" : null };
        refunds.set(idempotency_key, r);
      }
      if (timeoutNextRefund) {
        timeoutNextRefund = false;
        throw new PlatformError("UPSTREAM_UNAVAILABLE", "Refund request timed out.", { op: "refund", timeout: true });
      }
      return { ...r };
    },
    getRefund(idempotency_key) {
      const r = refunds.get(idempotency_key);
      return r ? { ...r } : null;
    },
    settleRefund(idempotency_key, status = "succeeded") {
      const r = refunds.get(idempotency_key);
      if (r) r.status = status;
      return r ? { ...r } : null;
    },
    providerRefundCount: () => refunds.size,
  };
  return gw;
}
