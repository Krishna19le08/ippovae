import { defineMachine, step } from "./util.js";
export const PAYMENT_STATES = ["created", "pending", "captured", "failed", "expired", "cod_due", "cod_collected", "partially_refunded", "refunded", "voided"];
export const REFUNDABLE_PAYMENT_STATES = ["captured", "cod_collected", "partially_refunded"];
export const PAYMENT_MACHINE = defineMachine("payment", PAYMENT_STATES, {
  create_intent: { from: null, to: "created" },
  create_cod: { from: null, to: "cod_due" },
  start: { from: ["created"], to: "pending" },
  capture: { from: ["pending"], to: "captured" },
  fail: { from: ["pending"], to: "failed" },
  expire: { from: ["created", "pending", "failed"], to: "expired" },
  retry: { from: ["failed"], to: "pending" },
  // late_capture from "voided" is a deliberate extension: a customer cancel voids a pending intent, and a capture can still arrive.
  late_capture: { from: ["expired", "voided"], to: "captured" },
  collect_cod: { from: ["cod_due"], to: "cod_collected" },
  void: { from: ["created", "pending", "cod_due"], to: "voided" },
  refund_partial: { from: REFUNDABLE_PAYMENT_STATES, to: "partially_refunded" },
  refund_full: { from: REFUNDABLE_PAYMENT_STATES, to: "refunded" },
});
export const nextPaymentState = (s, e) => step(PAYMENT_MACHINE, s, e);
