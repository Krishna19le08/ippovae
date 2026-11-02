// Role x action matrix (mirrors docs/PERMISSIONS.md). UX / demo enforcement only: the real thing must run server side.
// MATRIX[action][role] = "A" | "O" | "S" | "As" | "T" | "L" | "R" | "M" | false

import { PlatformError } from "../errors.js";

export const ROLES = ["customer", "super_admin", "store_manager", "picker_packer", "delivery_partner", "support_agent", "support_supervisor", "finance_operator"];
export const SYSTEM = Object.freeze({ system: true, userId: null, roles: Object.freeze([Object.freeze({ role: "system", store_id: null })]), storeIds: Object.freeze([]) });
export const isSystem = (a) => a === SYSTEM;

// columns: C, SA, SM, PP, DP, AG, SUP, FIN
const COLS = ["customer", "super_admin", "store_manager", "picker_packer", "delivery_partner", "support_agent", "support_supervisor", "finance_operator"];
const row = (...v) => Object.fromEntries(COLS.map((c, i) => [c, v[i] === "-" ? false : v[i]]));

export const MATRIX = {
  // 3.1 catalogue and configuration
  "product.read": row("A", "A", "A", "A", "-", "A", "A", "A"),
  "product.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "product.price_change": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "category.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "store.read": row("A", "A", "S", "S", "As", "R", "R", "R"),
  "store.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "store.pause": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "service_area.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "coupon.read": row("A", "A", "R", "-", "-", "R", "R", "R"),
  "coupon.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "policy.read": row("R", "A", "R", "R", "R", "R", "R", "R"),
  "policy.edit": row("-", "A", "-", "-", "-", "-", "-", "-"),
  // 3.2 users
  "user.read_self": row("O", "A", "O", "O", "O", "O", "O", "O"),
  "user.read_other": row("-", "A", "S", "-", "-", "M", "M", "M"),
  "user.edit_self": row("O", "A", "O", "O", "O", "O", "O", "O"),
  "user.manage": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "role.assign": row("-", "A", "-", "-", "-", "-", "-", "-"),
  "staff.assign": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "address.crud": row("O", "R", "-", "-", "-", "-", "-", "-"),
  "partner.manage": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "partner.set_availability": row("-", "-", "-", "-", "O", "-", "-", "-"),
  // 3.3 cart and orders
  "cart.crud": row("O", "-", "-", "-", "-", "-", "-", "-"),
  "order.create": row("O", "-", "-", "-", "-", "-", "-", "-"),
  "order.read": row("O", "A", "S", "S", "As", "M", "M", "R"),
  "order.read_history": row("O", "A", "S", "S", "As", "A", "A", "R"),
  "order.cancel": row("O", "A", "S", "-", "-", "A", "A", "-"),
  "order.request_cancel": row("O", "-", "-", "-", "-", "-", "-", "-"),
  "order.decide_cancel": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.cancel_dispatch": row("-", "A", "S", "-", "-", "-", "A", "-"),
  "order.accept": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.pick": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.pack": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.mark_ready": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.reopen": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "order.note": row("-", "A", "S", "S", "-", "A", "A", "-"),
  "order.force_transition": row("-", "A", "S", "-", "-", "-", "A", "-"),
  "order.complete_return": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "order.reset_otp": row("-", "A", "-", "-", "-", "-", "A", "-"),
  "order.export": row("-", "A", "S", "-", "-", "-", "-", "A"),
  // 3.4 inventory
  "inventory.read": row("A", "A", "S", "S", "-", "R", "R", "R"),
  "inventory.adjust": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "inventory.report_shortage": row("-", "A", "S", "S", "-", "-", "-", "-"),
  "inventory.transfer": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "stock_movement.read": row("-", "A", "S", "S", "-", "-", "-", "R"),
  "reservation.read": row("-", "A", "S", "S", "-", "R", "R", "R"),
  // 3.5 delivery
  "assignment.read": row("O", "A", "S", "S", "As", "R", "R", "R"),
  "assignment.create": row("-", "A", "S", "-", "-", "-", "-", "-"),
  "assignment.respond": row("-", "-", "-", "-", "As", "-", "-", "-"),
  "assignment.drop": row("-", "-", "S", "-", "As", "-", "-", "-"),
  "assignment.progress": row("-", "-", "-", "-", "As", "-", "-", "-"),
  "assignment.mark_failed": row("-", "A", "S", "-", "As", "-", "A", "-"),
  "assignment.cancel": row("-", "A", "S", "-", "As", "-", "A", "-"),
  "delivery_event.read": row("O", "A", "S", "-", "As", "R", "R", "-"),
  "cod.settle": row("-", "A", "S", "-", "O", "-", "-", "A"),
  // 3.6 payments and refunds
  "payment.read": row("O", "A", "S", "-", "As", "R", "R", "A"),
  "payment.initiate": row("O", "-", "-", "-", "-", "-", "-", "-"),
  "payment_txn.read": row("-", "A", "-", "-", "-", "-", "R", "A"),
  "payment.reconcile": row("-", "A", "-", "-", "-", "-", "-", "A"),
  "refund.read": row("O", "A", "S", "-", "-", "R", "R", "A"),
  "refund.request": row("-", "A", "S", "-", "-", "A", "A", "A"),
  "refund.approve": row("-", "A", "L", "-", "-", "L", "L", "L"),
  "refund.reject": row("-", "A", "L", "-", "-", "L", "A", "A"),
  "refund.retry": row("-", "A", "-", "-", "-", "-", "-", "A"),
  // 3.7 support
  "ticket.create": row("O", "A", "-", "-", "-", "A", "A", "-"),
  "ticket.read": row("O", "A", "S", "-", "-", "T", "A", "R"),
  "ticket.claim": row("-", "A", "-", "-", "-", "T", "A", "-"),
  "ticket.reassign": row("-", "A", "-", "-", "-", "-", "A", "-"),
  "ticket.reply": row("O", "A", "-", "-", "-", "T", "A", "-"),
  "ticket.internal_note": row("-", "A", "S", "-", "-", "T", "A", "R"),
  "ticket.escalate": row("-", "A", "-", "-", "-", "T", "A", "-"),
  "ticket.take_escalation": row("-", "A", "-", "-", "-", "-", "A", "-"),
  "ticket.resolve": row("-", "A", "-", "-", "-", "T", "A", "-"),
  "ticket.close": row("O", "A", "-", "-", "-", "T", "A", "-"),
  "ticket.reopen": row("O", "A", "-", "-", "-", "-", "A", "-"),
  "attachment.upload": row("O", "A", "-", "-", "As", "T", "A", "-"),
  "attachment.read": row("O", "A", "S", "-", "As", "T", "A", "R"),
  // 3.8 notifications and audit
  "notification.read": row("O", "O", "O", "O", "O", "O", "O", "O"),
  "notification.failures": row("-", "A", "-", "-", "-", "-", "R", "R"),
  "audit.read": row("-", "A", "S", "-", "-", "-", "R", "R"),
  "report.dashboard": row("-", "A", "S", "-", "-", "R", "R", "A"),
  "demo.reset": row("-", "A", "-", "-", "-", "-", "-", "-"),
};

export const PP_VISIBLE_STATES = ["confirmed", "picking", "picked", "packing", "packed", "ready_for_pickup"];

const ownerOf = (r) => r.user_id ?? r.customer_id ?? r.owner_id;

function scopeOk(mark, actor, entry, resource) {
  if (mark === false || mark === undefined) return false;
  if (resource == null) return true; // capability check without a concrete record
  switch (mark) {
    case "A": case "T": case "L": case "R": case "M": return true;
    case "O": {
      const o = ownerOf(resource);
      return o === undefined ? true : o === actor.userId;
    }
    case "S": {
      if (resource.store_id === undefined) return true;
      return !!entry.store_id && entry.store_id === resource.store_id;
    }
    case "As": {
      if (resource.assigned_user_ids === undefined) return true;
      return resource.assigned_user_ids.includes(actor.userId);
    }
    default: return false;
  }
}

// can(actor, "order.read", { user_id, store_id, internal_state, assigned_user_ids })
export function can(actor, action, resource) {
  if (!actor) return false;
  if (isSystem(actor)) return true;
  const rule = MATRIX[action];
  if (!rule) return false;
  for (const entry of actor.roles || []) {
    const mark = rule[entry.role];
    if (!scopeOk(mark, actor, entry, resource)) continue;
    if (entry.role === "picker_packer" && action === "order.read" && resource && resource.internal_state && !PP_VISIBLE_STATES.includes(resource.internal_state)) continue;
    return true;
  }
  return false;
}

// Throws NOT_FOUND for customer-owned data accessed by someone else (do not confirm existence), FORBIDDEN otherwise.
export function assertCan(actor, action, resource) {
  if (!actor) throw new PlatformError("UNAUTHENTICATED", "Sign in required.");
  if (can(actor, action, resource)) return;
  const rule = MATRIX[action] || {};
  const isOwnerRule = (actor.roles || []).every((r) => rule[r.role] === "O" || rule[r.role] === false || rule[r.role] === undefined) && (actor.roles || []).some((r) => rule[r.role] === "O");
  if (isOwnerRule && resource) throw new PlatformError("NOT_FOUND", "Not found.", { action });
  throw new PlatformError("FORBIDDEN", "You are not allowed to do this.", { action });
}

// OR-ed list of `where` fragments describing what the actor may list. [] = nothing, [{}] = everything.
export function scopeFilter(actor, collection) {
  if (isSystem(actor)) return [{}];
  const frags = [];
  const has = (role) => (actor.roles || []).filter((r) => r.role === role);
  const wide = ["super_admin", "support_agent", "support_supervisor", "finance_operator"];
  if (collection === "orders" || collection === "tickets" || collection === "payments" || collection === "refunds") {
    if (wide.some((r) => has(r).length) && !(collection === "tickets" && !["super_admin", "support_agent", "support_supervisor", "finance_operator"].some((r) => has(r).length))) return [{}];
    if (has("customer").length) frags.push(collection === "tickets" ? { customer_id: actor.userId } : { user_id: actor.userId });
    for (const r of [...has("store_manager"), ...has("picker_packer")]) if (r.store_id) frags.push({ store_id: r.store_id, ...(r.role === "picker_packer" && collection === "orders" ? { internal_state: { in: PP_VISIBLE_STATES } } : {}) });
    return frags;
  }
  if (collection === "notifications" || collection === "addresses") return [{ user_id: actor.userId }];
  if (collection === "inventory" || collection === "stock_movements" || collection === "reservations") {
    if (has("super_admin").length || has("finance_operator").length) return [{}];
    return [...has("store_manager"), ...has("picker_packer")].filter((r) => r.store_id).map((r) => ({ store_id: r.store_id }));
  }
  return has("super_admin").length ? [{}] : [];
}

export function inScope(frags, row) {
  return frags.some((f) => Object.entries(f).every(([k, c]) => (c && typeof c === "object" && "in" in c ? c.in.includes(row[k]) : row[k] === c)));
}

// Field mask for detail views. { strip: [paths], mask: [paths] } (dot paths). Least restrictive role wins.
const MASKS = {
  orders: {
    picker_packer: { strip: ["user_email", "shipping_address.phone", "customer_note"], mask: ["shipping_address.recipient_name"] },
    delivery_partner: { strip: ["user_email"], mask: ["shipping_address.phone"] },
    finance_operator: { strip: ["shipping_address", "user_email"], mask: [] },
    support_agent: { strip: [], mask: ["user_email", "shipping_address.phone"] },
    support_supervisor: { strip: [], mask: ["user_email", "shipping_address.phone"] },
  },
};
export function fieldMask(actor, collection) {
  if (isSystem(actor)) return { strip: [], mask: [] };
  const table = MASKS[collection] || {};
  let best = null;
  for (const r of actor.roles || []) {
    if (r.role === "customer") continue; // the implicit customer role never widens staff access to someone else's order
    if (!(r.role in table)) return { strip: [], mask: [] }; // another role has unmasked access
    best = best || table[r.role];
  }
  return best || { strip: [], mask: [] };
}

const maskStr = (s) => {
  s = String(s ?? "");
  if (s.includes("@")) { const [u, d] = s.split("@"); return `${u.slice(0, 1)}***@${d}`; }
  return s.length <= 4 ? "****" : `${"*".repeat(s.length - 4)}${s.slice(-4)}`;
};
export function applyMask(spec, obj) {
  if (!obj) return obj;
  const out = JSON.parse(JSON.stringify(obj));
  const walk = (path, fn) => {
    const parts = path.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) { cur = cur?.[parts[i]]; if (cur == null || typeof cur !== "object") return; }
    fn(cur, parts[parts.length - 1]);
  };
  for (const p of spec.strip) walk(p, (o, k) => { delete o[k]; });
  for (const p of spec.mask) walk(p, (o, k) => { if (o[k] != null) o[k] = maskStr(o[k]); });
  return out;
}

export function refundLimit(actor, policies) {
  if (isSystem(actor)) return Infinity;
  const L = policies.refund_limits;
  let best = 0;
  for (const r of actor.roles || []) {
    const spec = L[r.role];
    if (!spec) continue;
    if (spec.per_refund === null) return Infinity;
    best = Math.max(best, spec.per_refund);
  }
  return best;
}

export const hasRole = (actor, role) => !!actor && (isSystem(actor) ? role === "system" : (actor.roles || []).some((r) => r.role === role));
export const roleNames = (actor) => (isSystem(actor) ? ["system"] : (actor.roles || []).map((r) => r.role));
export const primaryRole = (actor) => {
  if (isSystem(actor)) return "system";
  const order = ["super_admin", "finance_operator", "support_supervisor", "store_manager", "support_agent", "picker_packer", "delivery_partner", "customer"];
  const names = roleNames(actor);
  return order.find((r) => names.includes(r)) || names[0] || "anonymous";
};
export const actorStoreIds = (actor) => (isSystem(actor) ? [] : [...new Set((actor.roles || []).map((r) => r.store_id).filter(Boolean))]);
