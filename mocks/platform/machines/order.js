import { defineMachine, step } from "./util.js";

export const ORDER_STATES = ["pending_payment", "stock_reserved", "confirmed", "picking", "picked", "packing", "packed", "ready_for_pickup", "rider_assigned", "rider_accepted", "picked_up", "delivery_attempted", "delivered", "failed_delivery", "returning", "returned", "cancelled"];

// internal_state -> customer-facing status (STATE-MACHINES.md section 2)
export const STATUS_OF = Object.freeze({
  pending_payment: "pending_payment", stock_reserved: "placed", confirmed: "confirmed", picking: "confirmed", picked: "confirmed", packing: "confirmed",
  packed: "packed", ready_for_pickup: "packed", rider_assigned: "packed", rider_accepted: "packed",
  picked_up: "out_for_delivery", delivery_attempted: "out_for_delivery", delivered: "delivered", failed_delivery: "out_for_delivery", returning: "out_for_delivery",
  returned: "cancelled", cancelled: "cancelled",
});
export const CUSTOMER_STATUSES = ["pending_payment", "placed", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled"];

const STORE = ["super_admin", "store_manager", "picker_packer"];
const SM = ["super_admin", "store_manager"];
export const PRE_DISPATCH_STATES = ["pending_payment", "stock_reserved", "confirmed", "picking", "picked", "packing", "packed", "ready_for_pickup", "rider_assigned", "rider_accepted"];

export const ORDER_MACHINE = defineMachine("order", ORDER_STATES, {
  payment_captured: { from: ["pending_payment"], to: "stock_reserved", actors: ["system"] },
  accept: { from: ["stock_reserved"], to: "confirmed", actors: [...STORE, "system"] },
  start_picking: { from: ["confirmed"], to: "picking", actors: STORE },
  finish_picking: { from: ["picking"], to: "picked", actors: STORE },
  start_packing: { from: ["picked"], to: "packing", actors: STORE },
  finish_packing: { from: ["packing"], to: "packed", actors: STORE },
  mark_ready: { from: ["packed"], to: "ready_for_pickup", actors: STORE },
  reopen_picking: { from: ["picked"], to: "picking", actors: SM },
  reopen_packing: { from: ["packed"], to: "packing", actors: SM },
  assign_rider: { from: ["ready_for_pickup"], to: "rider_assigned", actors: ["system", ...SM] },
  rider_accept: { from: ["rider_assigned"], to: "rider_accepted", actors: ["delivery_partner"] },
  rider_reject: { from: ["rider_assigned"], to: "ready_for_pickup", actors: ["delivery_partner"] },
  rider_expire: { from: ["rider_assigned"], to: "ready_for_pickup", actors: ["system"] },
  rider_drop: { from: ["rider_accepted"], to: "ready_for_pickup", actors: ["delivery_partner", ...SM] },
  pickup: { from: ["rider_accepted"], to: "picked_up", actors: ["delivery_partner"] },
  deliver: { from: ["picked_up", "delivery_attempted"], to: "delivered", actors: ["delivery_partner"] },
  attempt_failed: { from: ["picked_up", "delivery_attempted"], to: "delivery_attempted", actors: ["delivery_partner"] },
  mark_failed_delivery: { from: ["delivery_attempted"], to: "failed_delivery", actors: ["delivery_partner", "store_manager", "support_supervisor", "super_admin"] },
  start_return: { from: ["failed_delivery"], to: "returning", actors: ["delivery_partner", "store_manager", "super_admin", "system"] },
  complete_return: { from: ["returning"], to: "returned", actors: ["store_manager", "picker_packer", "super_admin"] },
  cancel: { from: PRE_DISPATCH_STATES, to: "cancelled", actors: ["customer", "store_manager", "support_supervisor", "super_admin", "support_agent", "system"] },
  expire: { from: ["pending_payment"], to: "cancelled", actors: ["system"] },
  approve_cancel: { from: ["picking", "picked", "packing", "packed"], to: "cancelled", actors: STORE },
  request_cancel: { from: ["picking", "picked", "packing", "packed"], to: null, actors: ["customer"] },
  deny_cancel: { from: ["picking", "picked", "packing", "packed"], to: null, actors: STORE },
});

export const nextOrderState = (state, event, roles) => step(ORDER_MACHINE, state, event, roles);
