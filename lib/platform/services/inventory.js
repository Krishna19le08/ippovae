// Inventory: physical / reserved / available per (store, product), a reservation per order line and an append-only
// stock_movements ledger. Reads and writes happen inside one repository transaction, and every write goes through
// writeInv(), which refuses to leave physical < 0, reserved < 0 or available < 0 (the "conditional UPDATE" guard).

import { PlatformError } from "../errors.js";
import { assertCan, can, actorStoreIds, isSystem, scopeFilter, inScope } from "../policy/permissions.js";
import { audit, actorId } from "../core.js";
import { addMs } from "../clock.js";

export const invId = (store_id, product_id) => `${store_id}:${product_id}`;

function writeInv(tx, ctx, actor, inv, { dPhysical = 0, dReserved = 0, type, order_id = null, reservation_id = null, reason = null }) {
  const physical = inv.physical + dPhysical;
  const reserved = inv.reserved + dReserved;
  if (physical < 0 || reserved < 0 || physical - reserved < 0) {
    throw new PlatformError("INSUFFICIENT_STOCK", "Not enough stock.", { store_id: inv.store_id, product_id: inv.product_id, available: inv.physical - inv.reserved });
  }
  const next = tx.update("inventory", inv.id, { physical, reserved, available: physical - reserved });
  tx.insert("stock_movements", {
    id: tx.nextId("mov"), store_id: inv.store_id, product_id: inv.product_id, type,
    qty: dPhysical !== 0 ? dPhysical : dReserved, physical_delta: dPhysical, reserved_delta: dReserved,
    physical_after: physical, reserved_after: reserved, order_id, reservation_id, actor_id: actorId(actor), reason, created_at: ctx.clock.iso(),
  });
  return next;
}

const getInv = (tx, store_id, product_id) => tx.get("inventory", invId(store_id, product_id));

export function availableFor(tx, store_id, product_id) {
  const inv = getInv(tx, store_id, product_id);
  return inv ? inv.physical - inv.reserved : 0;
}

// lines: [{ order_item_id, product_id, qty }]. status 'held' needs expiresAt. All-or-nothing (caller's transaction).
export function reserve(tx, ctx, actor, { order, lines, status, expiresAt }) {
  const short = [];
  for (const l of lines) {
    const avail = availableFor(tx, order.store_id, l.product_id);
    if (avail < l.qty) short.push({ product_id: l.product_id, slug: l.slug, requested: l.qty, available: Math.max(avail, 0) });
  }
  if (short.length) throw new PlatformError("INSUFFICIENT_STOCK", "Some items are no longer available.", { lines: short });
  const out = [];
  for (const l of lines) {
    const inv = getInv(tx, order.store_id, l.product_id);
    const rsv = tx.insert("reservations", {
      id: tx.nextId("rsv"), order_id: order.id, order_item_id: l.order_item_id, store_id: order.store_id, product_id: l.product_id, qty: l.qty,
      status, expires_at: status === "held" ? expiresAt : null,
    });
    writeInv(tx, ctx, actor, inv, { dReserved: l.qty, type: "reserve", order_id: order.id, reservation_id: rsv.id });
    out.push(rsv);
  }
  return out;
}

export const reservationsOf = (tx, order_id, statuses) => tx.list("reservations", { where: { order_id, ...(statuses ? { status: { in: statuses } } : {}) } });

export function commitReservations(tx, ctx, order_id) {
  const rows = reservationsOf(tx, order_id, ["held"]);
  return rows.map((r) => tx.update("reservations", r.id, { status: "committed", expires_at: null }));
}

// held|committed -> released|expired, reserved -= qty
export function releaseReservations(tx, ctx, actor, order_id, newStatus = "released", reason = null) {
  const rows = reservationsOf(tx, order_id, ["held", "committed"]);
  for (const r of rows) {
    const inv = getInv(tx, r.store_id, r.product_id);
    writeInv(tx, ctx, actor, inv, { dReserved: -r.qty, type: "reserve_release", order_id, reservation_id: r.id, reason });
    tx.update("reservations", r.id, { status: newStatus, expires_at: null });
  }
  return rows;
}

// committed -> consumed: stock leaves the store (rider pickup)
export function consumeReservations(tx, ctx, actor, order_id) {
  const rows = reservationsOf(tx, order_id, ["committed"]);
  for (const r of rows) {
    const inv = getInv(tx, r.store_id, r.product_id);
    writeInv(tx, ctx, actor, inv, { dPhysical: -r.qty, dReserved: -r.qty, type: "dispatch", order_id, reservation_id: r.id });
    tx.update("reservations", r.id, { status: "consumed" });
  }
  return rows;
}

// Picker found fewer units than ordered: shrink the reservation, release the hold and correct physical stock.
export function shortPick(tx, ctx, actor, reservation, shortage, reason) {
  if (shortage <= 0) return reservation;
  const inv = getInv(tx, reservation.store_id, reservation.product_id);
  const afterRelease = writeInv(tx, ctx, actor, inv, { dReserved: -shortage, type: "reserve_release", order_id: reservation.order_id, reservation_id: reservation.id, reason: `short pick: ${reason || "unavailable"}` });
  writeInv(tx, ctx, actor, afterRelease, { dPhysical: -shortage, type: "adjustment", order_id: reservation.order_id, reservation_id: reservation.id, reason: `short pick: ${reason || "unavailable"}` });
  const left = reservation.qty - shortage;
  return tx.update("reservations", reservation.id, left > 0 ? { qty: left } : { qty: 0, status: "released" });
}

// Returned parcel QC: sellable goes back on the shelf, damaged is received and written off (ledger stays explainable).
export function restock(tx, ctx, actor, { store_id, product_id, qty, sellable, order_id, reason }) {
  const inv = getInv(tx, store_id, product_id);
  const afterIn = writeInv(tx, ctx, actor, inv, { dPhysical: qty, type: "return_in", order_id, reason: reason || null });
  if (!sellable) writeInv(tx, ctx, actor, afterIn, { dPhysical: -qty, type: "write_off", order_id, reason: reason || "damaged on return" });
}

export function install(ctx, exec) {
  const fn = (ctx.fn.inventory = { reserve, commitReservations, releaseReservations, consumeReservations, shortPick, restock, availableFor });

  // Expire held reservations past their TTL that are not attached to a pending payment (safety net; the unpaid-order
  // sweep in jobs normally handles both together).
  fn.expireHeld = (tx, actor) => {
    const now = ctx.clock.now();
    const due = tx.list("reservations", { where: { status: "held" } }).filter((r) => r.expires_at && Date.parse(r.expires_at) <= now);
    const orders = [...new Set(due.map((r) => r.order_id))];
    for (const oid of orders) releaseReservations(tx, ctx, actor, oid, "expired", "reservation expired");
    return orders;
  };

  const api = {
    // Customers see an availability flag, never counts. Staff see counts for their scope.
    list(actor, { store_id } = {}) {
      return exec(actor, { action: "inventory.list" }, (tx, a) => {
        assertCan(a, "inventory.read", store_id ? { store_id } : undefined);
        const rows = tx.list("inventory", { where: store_id ? { store_id } : undefined });
        const frags = scopeFilter(a, "inventory");
        const counts = isSystem(a) || a.roles.some((r) => ["super_admin", "finance_operator", "store_manager", "picker_packer"].includes(r.role));
        if (counts) return rows.filter((r) => inScope(frags, r));
        return rows.map((r) => ({ store_id: r.store_id, product_id: r.product_id, in_stock: r.physical - r.reserved > 0 }));
      });
    },

    adjust(actor, { store_id, product_id, type = "adjustment", delta, reason, idempotency_key }) {
      return exec(actor, { action: "inventory.adjust", entity: ["inventory", invId(store_id || "", product_id || "")], store_id, idem: { key: idempotency_key, payload: { store_id, product_id, type, delta, reason } } }, (tx, a) => {
        assertCan(a, "inventory.adjust", { store_id });
        if (!["receipt", "adjustment", "write_off"].includes(type)) throw new PlatformError("VALIDATION_FAILED", "Unsupported adjustment type.", { fields: { type: "receipt, adjustment or write_off" } });
        if (!Number.isInteger(delta) || delta === 0) throw new PlatformError("VALIDATION_FAILED", "delta must be a non-zero integer.", { fields: { delta: "non-zero integer" } });
        if (type === "receipt" && delta < 0) throw new PlatformError("VALIDATION_FAILED", "A receipt must add stock.", { fields: { delta: "positive for receipt" } });
        if (type === "write_off" && delta > 0) throw new PlatformError("VALIDATION_FAILED", "A write-off must remove stock.", { fields: { delta: "negative for write_off" } });
        if ((type === "adjustment" || type === "write_off") && !(reason && reason.trim())) throw new PlatformError("VALIDATION_FAILED", "A reason is required.", { fields: { reason: "required" } });
        const inv = getInv(tx, store_id, product_id);
        if (!inv) throw new PlatformError("NOT_FOUND", "No stock record for this store and product.");
        if (inv.physical + delta < inv.reserved) throw new PlatformError("VALIDATION_FAILED", "Cannot reduce stock below what is reserved.", { fields: { delta: "would go below reserved" }, reserved: inv.reserved });
        const next = writeInv(tx, ctx, a, inv, { dPhysical: delta, type, reason: reason || null });
        audit(tx, ctx, a, "inventory.adjust", ["inventory", inv.id], { before: { physical: inv.physical }, after: { physical: next.physical }, reason, store_id });
        return next;
      });
    },

    movements(actor, { store_id, product_id, order_id } = {}) {
      return exec(actor, { action: "inventory.movements" }, (tx, a) => {
        assertCan(a, "stock_movement.read", store_id ? { store_id } : undefined);
        let rows = tx.list("stock_movements", { where: { ...(store_id ? { store_id } : {}), ...(product_id ? { product_id } : {}), ...(order_id ? { order_id } : {}) } });
        if (!isSystem(a)) { const f = scopeFilter(a, "stock_movements"); rows = rows.filter((r) => inScope(f, r)); }
        return rows;
      });
    },

    // Picker reports a shortage; the store manager approves, which applies a real adjustment.
    reportShortage(actor, { store_id, product_id, qty, reason }) {
      return exec(actor, { action: "inventory.report_shortage", entity: ["inventory", invId(store_id || "", product_id || "")], store_id }, (tx, a) => {
        assertCan(a, "inventory.report_shortage", { store_id });
        if (!Number.isInteger(qty) || qty <= 0 || !(reason && reason.trim())) throw new PlatformError("VALIDATION_FAILED", "qty and reason are required.");
        if (!getInv(tx, store_id, product_id)) throw new PlatformError("NOT_FOUND", "No stock record for this store and product.");
        const row = tx.insert("inventory_adjustment_requests", { id: tx.nextId("adj"), store_id, product_id, qty, reason, status: "requested", requested_by: actorId(a), decided_by: null });
        audit(tx, ctx, a, "inventory.report_shortage", ["inventory", invId(store_id, product_id)], { after: { qty, reason }, store_id });
        return row;
      });
    },
    decideShortage(actor, { request_id, approve }) {
      return exec(actor, { action: "inventory.decide_shortage", entity: ["inventory_adjustment_request", request_id || ""] }, (tx, a) => {
        const req = tx.get("inventory_adjustment_requests", request_id);
        if (!req) throw new PlatformError("NOT_FOUND", "Request not found.");
        assertCan(a, "inventory.adjust", { store_id: req.store_id });
        if (req.status !== "requested") throw new PlatformError("INVALID_TRANSITION", "Already decided.", { from: req.status, event: "decide", allowed_events: [] });
        if (approve) {
          const inv = getInv(tx, req.store_id, req.product_id);
          if (inv.physical - req.qty < inv.reserved) throw new PlatformError("VALIDATION_FAILED", "Cannot reduce stock below what is reserved.");
          writeInv(tx, ctx, a, inv, { dPhysical: -req.qty, type: "adjustment", reason: `shortage report: ${req.reason}` });
        }
        const next = tx.update("inventory_adjustment_requests", req.id, { status: approve ? "approved" : "rejected", decided_by: actorId(a) });
        audit(tx, ctx, a, "inventory.decide_shortage", ["inventory", invId(req.store_id, req.product_id)], { after: { status: next.status }, store_id: req.store_id });
        return next;
      });
    },

    // Invariant report (nightly check in a real backend). Pure read.
    reconcile(actor) {
      return exec(actor, { action: "inventory.reconcile" }, (tx, a) => {
        assertCan(a, "reservation.read");
        return checkInventory(tx);
      });
    },
  };
  return api;
}

export function checkInventory(tx, store_id) {
  const problems = [];
  const rows = tx.list("inventory", { where: store_id ? { store_id } : undefined });
  const rsv = tx.list("reservations");
  const mov = tx.list("stock_movements");
  for (const inv of rows) {
    if (inv.physical < 0 || inv.reserved < 0 || inv.physical - inv.reserved < 0) problems.push({ type: "negative", id: inv.id, physical: inv.physical, reserved: inv.reserved });
    if (inv.available !== inv.physical - inv.reserved) problems.push({ type: "available_mismatch", id: inv.id });
    const sum = rsv.filter((r) => r.store_id === inv.store_id && r.product_id === inv.product_id && (r.status === "held" || r.status === "committed")).reduce((s, r) => s + r.qty, 0);
    if (sum !== inv.reserved) problems.push({ type: "reserved_mismatch", id: inv.id, reserved: inv.reserved, reservations: sum });
    const ms = mov.filter((m) => m.store_id === inv.store_id && m.product_id === inv.product_id);
    if (ms.length) {
      const last = ms[ms.length - 1];
      if (last.physical_after !== inv.physical || last.reserved_after !== inv.reserved) problems.push({ type: "ledger_mismatch", id: inv.id });
    }
  }
  return { ok: problems.length === 0, checked: rows.length, problems };
}

export { addMs };
