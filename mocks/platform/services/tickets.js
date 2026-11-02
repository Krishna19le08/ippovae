// Support tickets: lifecycle (OPEN -> ... -> CLOSED), customer-visible vs internal messages, attachments with type and
// size checks, SLA timers, escalation. Internal messages and attachments are filtered out of every customer read and
// never reach notification payloads.

import { PlatformError } from "../errors.js";
import { SYSTEM, assertCan, can, isSystem, roleNames } from "../policy/permissions.js";
import { TICKET_MACHINE } from "../machines/ticket.js";
import { step, allowedEvents } from "../machines/util.js";
import { audit, queueNotification, usersWithRole, actorId } from "../core.js";
import { primaryRole } from "../policy/permissions.js";
import { addMs } from "../clock.js";
import { PlatformError as PE } from "../errors.js";

export const CATEGORIES = ["missing_item", "damaged_item", "wrong_item", "late_delivery", "payment", "refund", "cancellation", "rider_behaviour", "other"];
export const RESOLUTION_CODES = ["refunded", "replaced", "info_provided", "no_action", "duplicate", "spam"];
const bad = (fields, message = "Check the highlighted fields.", extra = {}) => new PlatformError("VALIDATION_FAILED", message, { fields, ...extra });
const HOUR = 3600000;

export function install(ctx, exec) {
  const P = ctx.policies;
  const T = P.tickets;
  const fn = ctx.fn;

  const loadTicket = (tx, id) => { const t = id ? tx.get("tickets", id) : null; if (!t) throw new PlatformError("NOT_FOUND", "Ticket not found."); return t; };
  const supportIds = (tx) => [...new Set([...usersWithRole(tx, "support_agent"), ...usersWithRole(tx, "support_supervisor")])];
  const isStaff = (a) => isSystem(a) || a.roles.some((r) => ["support_agent", "support_supervisor", "super_admin"].includes(r.role));
  const ticketNo = (t) => t.display_no;

  function resourceOf(tx, t) {
    const order = t.order_id ? tx.get("orders", t.order_id) : null;
    return { customer_id: t.customer_id, store_id: order ? order.store_id : undefined };
  }

  function visibleTo(tx, a, t) {
    if (isSystem(a)) return true;
    if (t.customer_id === a.userId) return true;
    if (a.roles.some((r) => ["support_agent", "support_supervisor", "super_admin"].includes(r.role))) return true;
    if (a.roles.some((r) => r.role === "store_manager") && t.order_id) { const o = tx.get("orders", t.order_id); return !!o && a.roles.some((r) => r.role === "store_manager" && r.store_id === o.store_id); }
    if (a.roles.some((r) => r.role === "finance_operator")) return tx.list("refunds", { where: { ticket_id: t.id } }).length > 0 || t.category === "refund" || t.category === "payment";
    return false;
  }
  const seesInternal = (a) => isSystem(a) || a.roles.some((r) => ["support_agent", "support_supervisor", "super_admin", "finance_operator"].includes(r.role));

  function addAttachments(tx, a, message, files, visibility) {
    const out = [];
    for (const f of files || []) {
      const stored = ctx.gateways.upload.store(f);
      out.push(tx.insert("attachments", {
        id: tx.nextId("att"), owner_type: "ticket_message", owner_id: message.id, uploaded_by: actorId(a), visibility, file_name: f.file_name, mime_type: f.mime_type,
        size_bytes: f.size_bytes, storage_key: stored.storage_key, sha256: f.sha256 ?? null, scan_status: stored.scan_status, created_at: ctx.clock.iso(),
      }));
    }
    return out;
  }
  function validateAttachments(files) {
    if (!files || !files.length) return;
    if (files.length > T.max_attachments) throw bad({ attachments: `at most ${T.max_attachments} files` });
    for (const f of files) {
      if (!P.attachments.mime_types.includes(f.mime_type)) throw bad({ attachments: `${f.file_name}: file type not allowed` });
      if (!Number.isInteger(f.size_bytes) || f.size_bytes <= 0 || f.size_bytes > P.attachments.max_bytes) throw bad({ attachments: `${f.file_name}: file too large (max ${P.attachments.max_bytes} bytes)` });
    }
  }

  function addMessage(tx, a, t, { body, visibility, kind = "message", attachments }) {
    const text = String(body ?? "").trim();
    if (!text) throw bad({ body: "required" });
    if (text.length > 4000) throw bad({ body: "max 4000 characters" });
    const customerAuthor = !isSystem(a) && a.userId === t.customer_id && a.roles.every((r) => r.role === "customer");
    if (customerAuthor && visibility !== "customer_visible") throw new PlatformError("FORBIDDEN", "You cannot add internal notes.", { action: "ticket.internal_note" });
    const msg = tx.insert("ticket_messages", {
      id: tx.nextId("tmg"), ticket_id: t.id, author_id: actorId(a), author_role: isSystem(a) ? "system" : customerAuthor ? "customer" : primaryRole(a),
      visibility, body: text, kind, created_at: ctx.clock.iso(),
    });
    const atts = addAttachments(tx, a, msg, attachments, visibility);
    return { message: msg, attachments: atts };
  }

  function sysNote(tx, t, { internal, customer }) {
    if (internal) tx.insert("ticket_messages", { id: tx.nextId("tmg"), ticket_id: t.id, author_id: null, author_role: "system", visibility: "internal", body: internal, kind: "status_change", created_at: ctx.clock.iso() });
    if (customer) tx.insert("ticket_messages", { id: tx.nextId("tmg"), ticket_id: t.id, author_id: null, author_role: "system", visibility: "customer_visible", body: customer, kind: "status_change", created_at: ctx.clock.iso() });
  }

  fn.tickets = {
    refundEvent(tx, ticket_id, { amount, status, refund_id }) {
      const t = tx.get("tickets", ticket_id);
      if (!t) return;
      sysNote(tx, t, { internal: `Refund ${refund_id} ${status}, amount ${amount} paise.`, customer: "A refund request was raised for this ticket." });
    },
  };

  function patchTicket(tx, t, patch, expectedVersion) {
    return tx.update("tickets", t.id, { ...patch, last_status_change_at: ctx.clock.iso() }, { expectedVersion: expectedVersion ?? t.version });
  }

  function doTransition(tx, a, t, ev, { expectedVersion, patch = {}, reason }) {
    const roles = isSystem(a) ? ["system"] : [...roleNames(a)];
    if (!isSystem(a) && t.customer_id === a.userId && !roles.includes("customer")) roles.push("customer");
    // customers only act as "customer" on their own tickets; staff roles must not be confused with ownership
    const effective = !isSystem(a) && t.customer_id !== a.userId ? roles.filter((r) => r !== "customer") : roles;
    const to = step(TICKET_MACHINE, t.status, ev, effective);
    if (expectedVersion != null && expectedVersion !== t.version) throw new PlatformError("VERSION_CONFLICT", "The ticket changed. Refresh and try again.", { ticket_id: t.id, current_version: t.version });
    const next = patchTicket(tx, t, { status: to, ...patch }, expectedVersion);
    audit(tx, ctx, a, `ticket.${ev}`, ["ticket", t.id], { before: { status: t.status }, after: { status: to }, reason });
    return next;
  }

  function reopen(tx, a, t, expectedVersion) {
    const customer = !isSystem(a) && a.userId === t.customer_id && a.roles.every((r) => r.role === "customer");
    if (customer) {
      if (!t.resolved_at || Date.parse(t.resolved_at) + T.reopen_window_hours * HOUR < ctx.clock.now()) throw new PlatformError("INVALID_TRANSITION", "The reopen window has closed. Please open a new ticket.", { from: t.status, event: "reopen", allowed_events: [], code: "REOPEN_WINDOW_CLOSED" });
      if (t.reopen_count >= T.customer_max_reopens) throw new PlatformError("INVALID_TRANSITION", "This ticket was already reopened once.", { from: t.status, event: "reopen", allowed_events: [], reason: "reopen_limit" });
    } else if (t.reopen_count >= T.max_reopens) throw new PlatformError("INVALID_TRANSITION", "Reopen limit reached.", { from: t.status, event: "reopen", allowed_events: [], reason: "reopen_limit" });
    const next = doTransition(tx, a, t, "reopen", { expectedVersion, patch: { reopen_count: t.reopen_count + 1, resolved_at: null, resolution_code: null } });
    sysNote(tx, next, { customer: "Your request was reopened." });
    if (t.assignee_id) queueNotification(tx, ctx, { user_id: t.assignee_id, template: "ticket.customer_reply", payload: { ticket_id: t.id, ticket_no: ticketNo(t) }, dedupe: `${t.id}:reopen:${next.reopen_count}` });
    return next;
  }

  const api = {
    create(actor, input) {
      const { order_id, category, subject, body, attachments, idempotency_key, customer_id, priority = "normal", allow_without_attachments = false, parent_ticket_id } = input || {};
      return exec(actor, { action: "ticket.create", entity: ["order", order_id || "n/a"], idem: { key: idempotency_key, payload: { order_id, category, subject, body, attachments: (attachments || []).map((f) => f.file_name) } } }, (tx, a) => {
        assertCan(a, "ticket.create", { owner_id: undefined });
        const staff = isStaff(a);
        const cust = staff ? customer_id : a.userId;
        if (!cust) throw bad({ customer_id: "required when creating on behalf of a customer" });
        if (!staff && customer_id && customer_id !== a.userId) throw new PlatformError("FORBIDDEN", "You can only create tickets for yourself.", { action: "ticket.create" });
        if (!tx.get("users", cust)) throw new PlatformError("NOT_FOUND", "Customer not found.");
        if (!CATEGORIES.includes(category)) throw bad({ category: `one of ${CATEGORIES.join(", ")}` });
        if (!String(subject ?? "").trim() || String(subject).length > 200) throw bad({ subject: "required, max 200 characters" });
        if (!["low", "normal", "high", "urgent"].includes(priority)) throw bad({ priority: "low, normal, high or urgent" });
        let order = null;
        if (order_id) {
          order = tx.get("orders", order_id);
          if (!order || order.user_id !== cust) throw new PlatformError("NOT_FOUND", "Order not found.");
        }
        const open = tx.list("tickets", { where: { customer_id: cust } }).filter((x) => !["RESOLVED", "CLOSED"].includes(x.status)).length;
        if (open >= T.max_open_per_customer) throw new PlatformError("VALIDATION_FAILED", "You have too many open requests. Wait for a reply or close one.", { code: "TOO_MANY_OPEN_TICKETS", fields: {} });
        validateAttachments(attachments);
        const warnings = [];
        let files = attachments || [];
        if (files.length) {
          try { ctx.gateways.upload.store({ file_name: "probe", data: "" }); } catch (e) {
            if (!(e instanceof PlatformError && e.code === "UPSTREAM_UNAVAILABLE")) throw e;
            if (!allow_without_attachments) throw e;
            warnings.push({ code: "ATTACHMENTS_DROPPED" });
            files = [];
          }
        }
        const now = ctx.clock.iso();
        const t = tx.insert("tickets", {
          id: tx.nextId("tkt"), display_no: tx.nextNo("TK", "ticket"), order_id: order_id ?? null, customer_id: cust, subject: String(subject).trim(), category, priority,
          status: "OPEN", assignee_id: null, escalated_to: null, resolution_code: null, first_response_due_at: addMs(now, T.first_response_hours * HOUR),
          resolve_due_at: addMs(now, T.resolve_hours * HOUR), first_responded_at: null, resolved_at: null, closed_at: null, reopen_count: 0, parent_ticket_id: parent_ticket_id ?? null,
          last_status_change_at: now, version: 1,
        });
        const first = addMessage(tx, { ...a, userId: staff ? cust : a.userId, roles: [{ role: "customer", store_id: null }] }, t, { body, visibility: "customer_visible", attachments: files });
        queueNotification(tx, ctx, { user_id: cust, template: "ticket.created", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id });
        for (const uid of supportIds(tx)) queueNotification(tx, ctx, { user_id: uid, template: "ticket.new", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id });
        audit(tx, ctx, a, "ticket.create", ["ticket", t.id], { after: { category, order_id: order_id ?? null, status: "OPEN" }, store_id: order ? order.store_id : null });
        return { ticket: t, message: first.message, attachments: first.attachments, warnings };
      });
    },

    get(actor, ticket_id) {
      return exec(actor, { action: "ticket.read", entity: ["ticket", ticket_id || ""] }, (tx, a) => {
        const t = loadTicket(tx, ticket_id);
        if (!visibleTo(tx, a, t)) throw new PlatformError("NOT_FOUND", "Ticket not found.", { action: "ticket.read" });
        const internal = seesInternal(a) && !(a.roles && t.customer_id === a.userId && a.roles.every((r) => r.role === "customer"));
        let messages = tx.list("ticket_messages", { where: { ticket_id: t.id }, orderBy: "created_at" });
        if (!internal) messages = messages.filter((m) => m.visibility === "customer_visible");
        const ids = new Set(messages.map((m) => m.id));
        const attachments = tx.list("attachments", { where: { owner_type: "ticket_message" } }).filter((x) => ids.has(x.owner_id) && (internal || x.visibility === "customer_visible"));
        const refunds = tx.list("refunds", { where: { ticket_id: t.id } }).map((r) => (internal ? r : { id: r.id, status: r.status === "succeeded" ? "refunded" : r.status === "rejected" ? "rejected" : "in_progress", amount: r.amount }));
        return { ticket: t, messages, attachments, refunds, next_events: allowedEvents(TICKET_MACHINE, t.status) };
      });
    },

    list(actor, { status, assignee, order_id, customer_id } = {}) {
      return exec(actor, { action: "ticket.list" }, (tx, a) => {
        let rows = tx.list("tickets", { where: { ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}), ...(order_id ? { order_id } : {}), ...(customer_id ? { customer_id } : {}) }, orderBy: "-created_at" });
        if (assignee === "me") rows = rows.filter((t) => t.assignee_id === actorId(a));
        else if (assignee) rows = rows.filter((t) => t.assignee_id === assignee);
        return rows.filter((t) => visibleTo(tx, a, t));
      });
    },

    // Customer / agent message. A customer reply to WAITING_FOR_CUSTOMER moves the ticket to IN_PROGRESS (T4);
    // to RESOLVED it asks to reopen (T10, window and count enforced).
    addMessage(actor, { ticket_id, body, visibility = "customer_visible", attachments, idempotency_key }) {
      return exec(actor, { action: "ticket.reply", entity: ["ticket", ticket_id || ""], idem: { key: idempotency_key, payload: { ticket_id, body, visibility } } }, (tx, a) => {
        let t = loadTicket(tx, ticket_id);
        if (!visibleTo(tx, a, t)) throw new PlatformError("NOT_FOUND", "Ticket not found.", { action: "ticket.reply" });
        const customerAuthor = !isSystem(a) && a.userId === t.customer_id && a.roles.every((r) => r.role === "customer");
        if (visibility === "internal") assertCan(a, "ticket.internal_note", resourceOf(tx, t));
        else if (!customerAuthor) assertCan(a, "ticket.reply", resourceOf(tx, t));
        if (!customerAuthor && !isStaff(a)) throw new PlatformError("FORBIDDEN", "You cannot reply to this ticket.", { action: "ticket.reply" });
        if (t.status === "CLOSED") throw new PlatformError("INVALID_TRANSITION", "This ticket is closed. Please open a new one.", { from: "CLOSED", event: "reply", allowed_events: [] });
        validateAttachments(attachments);
        const msg = addMessage(tx, a, t, { body, visibility, attachments });
        if (customerAuthor) {
          if (t.status === "WAITING_FOR_CUSTOMER") t = doTransition(tx, a, t, "customer_reply", {});
          else if (t.status === "RESOLVED") t = reopen(tx, a, t);
          if (t.assignee_id) queueNotification(tx, ctx, { user_id: t.assignee_id, template: "ticket.customer_reply", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: msg.message.id });
        } else if (visibility === "customer_visible") {
          if (!t.first_responded_at) t = tx.update("tickets", t.id, { first_responded_at: ctx.clock.iso() });
          queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.reply", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: msg.message.id });
        }
        audit(tx, ctx, a, "ticket.message", ["ticket", t.id], { after: { visibility, kind: "message" } });
        return { ticket: t, message: msg.message, attachments: msg.attachments };
      });
    },

    transition(actor, { ticket_id, event, expected_version, payload = {}, idempotency_key }) {
      return exec(actor, { action: `ticket.${event}`, entity: ["ticket", ticket_id || ""], idem: { key: idempotency_key, payload: { ticket_id, event, payload } } }, (tx, a) => {
        const t = loadTicket(tx, ticket_id);
        if (!visibleTo(tx, a, t)) throw new PlatformError("NOT_FOUND", "Ticket not found.", { action: `ticket.${event}` });
        const customerSelf = !isSystem(a) && a.userId === t.customer_id && a.roles.every((r) => r.role === "customer");
        const ACTION = { claim: "ticket.claim", assign: "ticket.reassign", request_info: "ticket.reply", escalate: "ticket.escalate", take_escalation: "ticket.take_escalation", resolve: "ticket.resolve", close: "ticket.close", reopen: "ticket.reopen" };
        if (!TICKET_MACHINE.events[event] || event === "create" || event === "customer_reply" || event === "auto_close_waiting") throw new PlatformError("INVALID_TRANSITION", "That event cannot be sent directly.", { from: t.status, event, allowed_events: allowedEvents(TICKET_MACHINE, t.status) });
        assertCan(a, ACTION[event], { customer_id: t.customer_id });
        let next;
        switch (event) {
          case "claim": next = doTransition(tx, a, t, "claim", { expectedVersion: expected_version, patch: { assignee_id: a.userId } }); queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.in_progress", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id }); sysNote(tx, next, { customer: "Your request is being handled." }); break;
          case "assign": {
            const target = tx.get("users", payload.assignee_id);
            const ok = target && tx.list("user_roles", { where: { user_id: target.id } }).some((r) => ["support_agent", "support_supervisor"].includes(r.role));
            if (!ok) throw bad({ assignee_id: "must be a support agent or supervisor" });
            next = doTransition(tx, a, t, "assign", { expectedVersion: expected_version, patch: { assignee_id: target.id } });
            break;
          }
          case "request_info": {
            if (!(payload.message && String(payload.message).trim())) throw bad({ message: "a customer-visible question is required" });
            next = doTransition(tx, a, t, "request_info", { expectedVersion: expected_version });
            addMessage(tx, a, t, { body: payload.message, visibility: "customer_visible" });
            if (!t.first_responded_at) next = tx.update("tickets", t.id, { first_responded_at: ctx.clock.iso() });
            queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.reply", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: `${t.id}:info:${t.version}` });
            break;
          }
          case "escalate": {
            if (!(payload.reason && String(payload.reason).trim())) throw bad({ reason: "an internal reason is required" });
            next = doTransition(tx, a, t, "escalate", { expectedVersion: expected_version, reason: payload.reason });
            sysNote(tx, next, { internal: `Escalated: ${payload.reason}`, customer: "Your request was passed to a senior team member." });
            for (const uid of usersWithRole(tx, "support_supervisor")) queueNotification(tx, ctx, { user_id: uid, template: "ticket.escalated", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: `${t.id}:esc:${t.version}` });
            break;
          }
          case "take_escalation": next = doTransition(tx, a, t, "take_escalation", { expectedVersion: expected_version, patch: { assignee_id: a.userId, escalated_to: a.userId } }); break;
          case "resolve": {
            if (t.status === "ESCALATED" && !isSystem(a) && !a.roles.some((r) => ["support_supervisor", "super_admin"].includes(r.role))) throw new PlatformError("FORBIDDEN", "Escalated tickets are resolved by a supervisor.", { action: "ticket.resolve" });
            if (!RESOLUTION_CODES.includes(payload.resolution_code)) throw bad({ resolution_code: `one of ${RESOLUTION_CODES.join(", ")}` });
            if (!(payload.message && String(payload.message).trim())) throw bad({ message: "a customer-visible resolution message is required" });
            if (payload.resolution_code === "refunded" && !tx.list("refunds", { where: { ticket_id: t.id } }).some((r) => ["approved", "processing", "succeeded"].includes(r.status))) {
              throw new PlatformError("VALIDATION_FAILED", "Raise and approve a refund before resolving as refunded.", { code: "REFUND_REQUIRED", fields: { resolution_code: "no approved refund linked" } });
            }
            next = doTransition(tx, a, t, "resolve", { expectedVersion: expected_version, patch: { resolution_code: payload.resolution_code, resolved_at: ctx.clock.iso() } });
            addMessage(tx, a, t, { body: payload.message, visibility: "customer_visible" });
            queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.resolved", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id });
            break;
          }
          case "close": {
            if (t.status === "OPEN" && !(["spam", "duplicate"].includes(payload.resolution_code) && !customerSelf)) throw new PlatformError("INVALID_TRANSITION", "An open ticket can only be closed as spam or duplicate by support.", { from: t.status, event: "close", allowed_events: allowedEvents(TICKET_MACHINE, t.status) });
            if (customerSelf && t.status !== "RESOLVED") throw new PlatformError("INVALID_TRANSITION", "You can close a ticket after it is resolved.", { from: t.status, event: "close", allowed_events: allowedEvents(TICKET_MACHINE, t.status) });
            if (t.status === "OPEN" && !isSystem(a) && a.roles.some((r) => r.role === "support_agent") && !a.roles.some((r) => ["support_supervisor", "super_admin"].includes(r.role)) && !["spam", "duplicate"].includes(payload.resolution_code)) throw new PlatformError("FORBIDDEN", "Agents may only close spam or duplicates.", { action: "ticket.close" });
            next = doTransition(tx, a, t, "close", { expectedVersion: expected_version, patch: { closed_at: ctx.clock.iso(), ...(payload.resolution_code ? { resolution_code: payload.resolution_code } : {}) } });
            if (!customerSelf) queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.closed", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id });
            break;
          }
          case "reopen": next = reopen(tx, a, t, expected_version); break;
          default: throw new PlatformError("INVALID_TRANSITION", "Unsupported event.", { from: t.status, event, allowed_events: [] });
        }
        return tx.get("tickets", next.id);
      });
    },

    // Job: SLA breach -> escalate; WAITING 72h -> close; RESOLVED 72h -> close. Idempotent.
    runSla() {
      const now = ctx.clock.now();
      const rows = ctx.repo.read((tx) => tx.list("tickets"));
      const out = [];
      for (const t of rows) {
        let ev = null, patch = {}, extra = null;
        if (t.status === "WAITING_FOR_CUSTOMER" && Date.parse(t.last_status_change_at) + T.waiting_auto_close_hours * HOUR <= now) { ev = "auto_close_waiting"; patch = { closed_at: ctx.clock.iso() }; extra = "closed_waiting"; }
        else if (t.status === "RESOLVED" && t.resolved_at && Date.parse(t.resolved_at) + T.resolved_auto_close_hours * HOUR <= now) { ev = "close"; patch = { closed_at: ctx.clock.iso() }; extra = "closed_resolved"; }
        else if (["OPEN", "IN_PROGRESS"].includes(t.status) && Date.parse(t.resolve_due_at) <= now) { ev = "escalate"; extra = "sla_escalated"; }
        if (!ev) continue;
        const res = exec(SYSTEM, { action: `ticket.${ev}`, entity: ["ticket", t.id] }, (tx, a) => {
          const cur = tx.get("tickets", t.id);
          if (cur.version !== t.version) return { skipped: true };
          const next = doTransition(tx, a, cur, ev, { patch, reason: extra });
          if (ev === "escalate") sysNote(tx, next, { internal: "Escalated automatically: resolve-by time passed.", customer: "Your request was passed to a senior team member." });
          else { sysNote(tx, next, { customer: "This request was closed." }); queueNotification(tx, ctx, { user_id: t.customer_id, template: "ticket.closed", payload: { ticket_id: t.id, ticket_no: t.display_no }, dedupe: t.id }); }
          return { done: extra };
        });
        out.push({ id: t.id, ok: res.ok, action: extra });
      }
      return out;
    },
  };
  return api;
}

export { can, PE };
