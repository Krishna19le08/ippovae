// Cancellation eligibility (STATE-MACHINES.md section 4.1). Pure.
// eligibility(order, actorRoles, isOwner) -> { allowed, mode: "direct" | "request" | "forbidden" | "noop", reason?, next_actions? }

export const DIRECT_EARLY = ["pending_payment", "stock_reserved", "confirmed"];
export const REQUEST_GROUP = ["picking", "picked", "packing", "packed"];
export const DISPATCH_GROUP = ["ready_for_pickup", "rider_assigned", "rider_accepted"];
export const FIELD_GROUP = ["picked_up", "delivery_attempted"];

const has = (roles, r) => roles.includes(r);

export function eligibility(order, roles, isOwner) {
  const s = order.internal_state;
  if (s === "cancelled" || s === "returned") return { allowed: true, mode: "noop", reason: "already_cancelled" };
  const staffAll = has(roles, "super_admin") || has(roles, "support_supervisor");
  const sm = has(roles, "store_manager");
  const customer = isOwner && has(roles, "customer") && !roles.some((r) => ["super_admin", "store_manager", "support_supervisor"].includes(r));

  if (DIRECT_EARLY.includes(s)) {
    if (staffAll || sm || has(roles, "support_agent") || has(roles, "system")) return { allowed: true, mode: "direct" };
    if (customer) return { allowed: true, mode: "direct" };
    return { allowed: false, mode: "forbidden", reason: "role_not_allowed" };
  }
  if (REQUEST_GROUP.includes(s)) {
    if (staffAll || sm) return { allowed: true, mode: "direct" };
    if (customer) return { allowed: true, mode: "request" };
    if (has(roles, "picker_packer") || has(roles, "support_agent")) return { allowed: false, mode: "forbidden", reason: "role_not_allowed" };
    return { allowed: false, mode: "forbidden", reason: "role_not_allowed" };
  }
  if (DISPATCH_GROUP.includes(s)) {
    if (staffAll || sm) return { allowed: true, mode: "direct" };
    if (customer) return { allowed: false, mode: "forbidden", reason: "past_cutoff", next_actions: ["contact_support"], code: "PAST_CANCELLATION_CUTOFF" };
    return { allowed: false, mode: "forbidden", reason: "role_not_allowed" };
  }
  if (FIELD_GROUP.includes(s)) return { allowed: false, mode: "forbidden", reason: "past_cutoff", next_actions: ["refuse_at_door", "contact_support"], code: "PAST_CANCELLATION_CUTOFF" };
  if (s === "delivered") return { allowed: false, mode: "forbidden", reason: "delivered", next_actions: ["report_problem"], code: "PAST_CANCELLATION_CUTOFF" };
  return { allowed: false, mode: "forbidden", reason: "not_applicable", next_actions: ["contact_support"], code: "PAST_CANCELLATION_CUTOFF" };
}
