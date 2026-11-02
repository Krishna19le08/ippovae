// Shared plumbing for services: actor resolution, audit log, notification queue, status history, command executor.

import { PlatformError, isCommitFail } from "./errors.js";
import { hashObject, sha256 } from "./crypto.js";
import { SYSTEM, isSystem, primaryRole } from "./policy/permissions.js";
import { STATUS_OF } from "./machines/order.js";

const PII_KEYS = new Set(["email", "user_email", "phone", "recipient_name"]);

function maskValue(v) {
  const s = String(v ?? "");
  if (s.includes("@")) { const [u, d] = s.split("@"); return `${u.slice(0, 1)}***@${d}`; }
  return s.length <= 4 ? "****" : `${"*".repeat(s.length - 4)}${s.slice(-4)}`;
}
export function maskPII(v) {
  if (Array.isArray(v)) return v.map(maskPII);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "shipping_address" && val && typeof val === "object") out[k] = { city: val.city, pincode: val.pincode };
      else if (PII_KEYS.has(k) && val != null) out[k] = maskValue(val);
      else out[k] = maskPII(val);
    }
    return out;
  }
  return v;
}

export function changedFields(before, after) {
  const b = {}, a = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k === "updated_at" || k === "version") continue;
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) { b[k] = before?.[k] ?? null; a[k] = after?.[k] ?? null; }
  }
  return { before: maskPII(b), after: maskPII(a) };
}

// Re-reads the actor's roles from the repository so callers cannot invent roles.
export function resolveActor(tx, actor) {
  if (isSystem(actor)) return SYSTEM;
  if (!actor || !actor.userId) throw new PlatformError("UNAUTHENTICATED", "Sign in required.");
  const user = tx.get("users", actor.userId);
  if (!user || user.deleted_at) throw new PlatformError("UNAUTHENTICATED", "Unknown user.");
  if (user.status !== "active") throw new PlatformError("FORBIDDEN", "Account is suspended.", { reason: "suspended" });
  const roles = tx.list("user_roles", { where: { user_id: user.id } }).map((r) => ({ role: r.role, store_id: r.store_id || null }));
  if (!roles.some((r) => r.role === "customer")) roles.push({ role: "customer", store_id: null });
  const partner = tx.list("delivery_partners", { where: { user_id: user.id } })[0] || null;
  return {
    userId: user.id, email: user.email, name: user.name, roles,
    storeIds: [...new Set(roles.map((r) => r.store_id).filter(Boolean))],
    partnerId: partner ? partner.id : null,
  };
}

export const actorId = (a) => (isSystem(a) ? null : a.userId);

export function audit(tx, ctx, actor, action, entity, opts = {}) {
  const head = tx.get("counters", "audit_head");
  const row = {
    id: tx.nextId("aud"),
    at: ctx.clock.iso(),
    created_at: ctx.clock.iso(),
    actor_id: actorId(actor),
    actor_role: actor ? primaryRole(actor) : "anonymous",
    action,
    entity_type: entity[0],
    entity_id: entity[1],
    store_id: opts.store_id ?? null,
    before: opts.before === undefined ? null : opts.before,
    after: opts.after === undefined ? null : opts.after,
    result: opts.result || "success",
    reason: opts.reason ?? null,
    request_id: opts.request_id ?? null,
    prev_hash: head ? head.hash : null,
  };
  row.hash = sha256(`${row.prev_hash || ""}|${hashObject({ ...row, hash: undefined })}`);
  tx.insert("audit_logs", row);
  if (head) tx.update("counters", "audit_head", { hash: row.hash });
  else tx.insert("counters", { id: "audit_head", n: 0, hash: row.hash });
  return row;
}

export function verifyAuditChain(rows) {
  let prev = null;
  for (const r of rows) {
    const expect = sha256(`${prev || ""}|${hashObject({ ...r, hash: undefined })}`);
    if (r.prev_hash !== prev || r.hash !== expect) return { ok: false, broken_at: r.id };
    prev = r.hash;
  }
  return { ok: true };
}

// ---- notifications (outbox) -------------------------------------------------------------------------------------
const FORBIDDEN_PAYLOAD_KEY = /internal|note|body|secret|otp|password/i;
function cleanPayload(p) {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (FORBIDDEN_PAYLOAD_KEY.test(k)) continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) out[k] = v;
  }
  return out;
}

export function queueNotification(tx, ctx, { user_id, template, payload, dedupe, channels }) {
  if (!user_id) return [];
  const def = ctx.templates.find((t) => t.id === template);
  const chans = channels || (def ? def.channels : ["in_app"]);
  const now = ctx.clock.iso();
  const clean = cleanPayload(payload);
  const rows = [];
  for (const channel of chans) {
    const row = {
      id: tx.nextId("ntf"), user_id, channel, template, payload: clean,
      dedupe_key: `${template}:${dedupe ?? clean.order_id ?? clean.ticket_id ?? clean.refund_id ?? ""}`,
      status: channel === "in_app" ? "sent" : "queued", attempts: 0, next_attempt_at: channel === "in_app" ? null : now,
      last_error: null, sent_at: channel === "in_app" ? now : null, read_at: null, created_at: now,
    };
    try { rows.push(tx.insert("notifications", row)); } catch (e) { if (!(e instanceof PlatformError && e.code === "CONFLICT")) throw e; }
  }
  return rows;
}

export const usersWithRole = (tx, role, store_id) =>
  [...new Set(tx.list("user_roles", { where: { role, ...(store_id ? { store_id } : {}) } }).map((r) => r.user_id))];
export const storeStaffIds = (tx, store_id) => [...new Set([...usersWithRole(tx, "store_manager", store_id), ...usersWithRole(tx, "picker_packer", store_id)])];

// ---- order status history ---------------------------------------------------------------------------------------
export function recordHistory(tx, ctx, order, { from, to, event, actor, reason, metadata }) {
  const seq = tx.count("order_status_history", { order_id: order.id }) + 1;
  return tx.insert("order_status_history", {
    id: tx.nextId("osh"), order_id: order.id, seq, from_state: from ?? null, to_state: to, customer_status: STATUS_OF[to], event,
    actor_id: actorId(actor), actor_role: primaryRole(actor), reason: reason ?? null, metadata: metadata ?? null, created_at: ctx.clock.iso(),
  });
}

// ---- command executor --------------------------------------------------------------------------------------------
const DENIED = new Set(["FORBIDDEN", "FORBIDDEN_LIMIT", "NOT_FOUND", "UNAUTHENTICATED"]);
const CONFLICTS = new Set(["VERSION_CONFLICT", "INVALID_TRANSITION", "ORDER_CANCELLED", "PAST_CANCELLATION_CUTOFF", "OFFER_EXPIRED", "RESERVATION_EXPIRED", "REFUND_EXCEEDS_CAPTURED", "CONFLICT"]);

// spec: { action, entity?: [type, id], store_id?, idem?: { key, payload }, onFail?: (tx, error, actor) => void }
// body(tx, actor) runs inside one transaction. Throw PlatformError to roll back and report a failure.
// Return commitThenFail(err) to commit what was written and still report err.
export function makeExec(ctx) {
  return function exec(actorIn, spec, body) {
    let replayed = false;
    let failure = null;
    let data;
    try {
      data = ctx.repo.transact((tx) => {
        const actor = resolveActor(tx, actorIn);
        let idemId = null;
        let hash = null;
        if (spec.idem && spec.idem.key) {
          idemId = `${actorId(actor) || "system"}:${spec.action}:${spec.idem.key}`;
          hash = hashObject(spec.idem.payload ?? null);
          const rec = tx.get("idempotency_keys", idemId);
          if (rec) {
            if (rec.request_hash !== hash) throw new PlatformError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used with a different request.", { key: spec.idem.key });
            replayed = true;
            return rec.response;
          }
        }
        const out = body(tx, actor);
        if (isCommitFail(out)) { failure = out.$error; return undefined; }
        if (idemId) tx.insert("idempotency_keys", { id: idemId, scope: spec.action, key: spec.idem.key, request_hash: hash, response: out === undefined ? null : out, created_at: ctx.clock.iso() });
        return out;
      });
    } catch (e) {
      if (!(e instanceof PlatformError)) throw e;
      recordFailure(ctx, actorIn, spec, e);
      return { ok: false, error: e.toJSON() };
    }
    if (failure) {
      recordFailure(ctx, actorIn, spec, failure);
      safeFlush(ctx);
      return { ok: false, error: failure.toJSON() };
    }
    if (!replayed) safeFlush(ctx);
    return replayed ? { ok: true, data, replayed: true } : { ok: true, data };
  };
}

function safeFlush(ctx) {
  try { if (ctx.flush) ctx.flush(); } catch { /* notification failures never affect business results */ }
}

function recordFailure(ctx, actorIn, spec, e) {
  const denied = DENIED.has(e.code);
  const conflict = CONFLICTS.has(e.code);
  if (!denied && !(conflict && spec.entity)) return;
  try {
    ctx.repo.transact((tx) => {
      let actor = null;
      try { actor = resolveActor(tx, actorIn); } catch { actor = null; }
      audit(tx, ctx, actor, spec.action, spec.entity || ["request", "n/a"], {
        result: denied ? "denied" : "conflict", reason: e.code, store_id: spec.store_id ?? null,
        after: { code: e.code, details: e.details && typeof e.details === "object" ? { current_version: e.details.current_version, from: e.details.from, event: e.details.event, action: e.details.action } : null },
      });
      if (spec.onFail && actor) spec.onFail(tx, e, actor);
    });
  } catch { /* audit of a failure must never mask the original error */ }
}
