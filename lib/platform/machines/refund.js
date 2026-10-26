import { defineMachine, step } from "./util.js";
export const REFUND_STATES = ["requested", "approved", "rejected", "processing", "succeeded", "failed", "cancelled"];
export const LIVE_REFUND_STATES = ["requested", "approved", "processing", "succeeded"]; // count toward the cumulative cap
export const REFUND_MACHINE = defineMachine("refund", REFUND_STATES, {
  request: { from: null, to: "requested" },
  approve: { from: ["requested"], to: "approved" },
  reject: { from: ["requested"], to: "rejected" },
  cancel_request: { from: ["requested", "approved"], to: "cancelled" },
  start_processing: { from: ["approved"], to: "processing" },
  succeeded: { from: ["processing"], to: "succeeded" },
  failed: { from: ["processing"], to: "failed" },
  retry: { from: ["failed"], to: "processing" },
});
export const nextRefundState = (s, e) => step(REFUND_MACHINE, s, e);
