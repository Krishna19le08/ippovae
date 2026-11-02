import { defineMachine, step } from "./util.js";
export const ASSIGNMENT_STATES = ["offered", "accepted", "rejected", "expired", "cancelled", "picked_up", "delivered", "failed", "returned"];
export const LIVE_ASSIGNMENT_STATES = ["offered", "accepted", "picked_up"];
export const ASSIGNMENT_MACHINE = defineMachine("assignment", ASSIGNMENT_STATES, {
  offer: { from: null, to: "offered" },
  accept: { from: ["offered"], to: "accepted" },
  reject: { from: ["offered"], to: "rejected" },
  expire: { from: ["offered"], to: "expired" },
  cancel: { from: ["offered", "accepted"], to: "cancelled" },
  pickup: { from: ["accepted"], to: "picked_up" },
  deliver: { from: ["picked_up"], to: "delivered" },
  fail: { from: ["picked_up"], to: "failed" },
  return_complete: { from: ["failed"], to: "returned" },
});
export const nextAssignmentState = (s, e) => step(ASSIGNMENT_MACHINE, s, e);
