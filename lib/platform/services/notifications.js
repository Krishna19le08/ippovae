// Notifications: rows are written inside business transactions (outbox pattern) and sent afterwards by flush().
// A failing channel never rolls anything back: the row goes queued -> failed (backoff) -> sent, or -> dead.
// In-app notifications are "sent" the moment they are written, so they still show when email or SMS is down.

import { PlatformError } from "../errors.js";
import { assertCan, isSystem } from "../policy/permissions.js";
import { SYSTEM } from "../policy/permissions.js";
import { addMs } from "../clock.js";

export function render(templates, n) {
  const def = templates.find((t) => t.id === n.template);
  const fill = (s) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (n.payload && n.payload[k] != null ? String(n.payload[k]) : ""));
  return { title: def ? fill(def.title) : n.template, body: def ? fill(def.body) : "" };
}

export function install(ctx, exec) {
  const cfg = ctx.policies.notifications;
  let flushing = false;

  function flush() {
    if (flushing) return { sent: 0, failed: 0, dead: 0 };
    flushing = true;
    const res = { sent: 0, failed: 0, dead: 0 };
    try {
      const now = ctx.clock.now();
      const due = ctx.repo.read((tx) => tx.list("notifications", { where: { status: { in: ["queued", "failed"] } } }))
        .filter((n) => n.channel !== "in_app" && (!n.next_attempt_at || Date.parse(n.next_attempt_at) <= now));
      for (const n of due) {
        let outcome;
        try {
          ctx.gateways.notify.send(n);
          outcome = { status: "sent", attempts: n.attempts + 1, sent_at: ctx.clock.iso(), last_error: null, next_attempt_at: null };
          res.sent += 1;
        } catch (e) {
          const attempts = n.attempts + 1;
          const dead = attempts >= cfg.max_attempts;
          const wait = cfg.backoff_minutes[Math.min(attempts - 1, cfg.backoff_minutes.length - 1)];
          outcome = { status: dead ? "dead" : "failed", attempts, last_error: String(e && e.message ? e.message : e), next_attempt_at: dead ? null : addMs(ctx.clock.iso(), wait * 60000) };
          res[dead ? "dead" : "failed"] += 1;
        }
        try { ctx.repo.transact((tx) => tx.update("notifications", n.id, outcome)); } catch { /* storage trouble: try again next flush */ }
      }
    } finally { flushing = false; }
    return res;
  }
  ctx.flush = flush;

  return {
    flush,
    list(actor, { unread, limit } = {}) {
      return exec(actor, { action: "notification.list" }, (tx, a) => {
        assertCan(a, "notification.read", { user_id: a.userId });
        let rows = tx.list("notifications", { where: { user_id: a.userId, channel: "in_app" }, orderBy: "-created_at" });
        if (unread) rows = rows.filter((n) => !n.read_at);
        if (limit) rows = rows.slice(0, limit);
        return rows.map((n) => ({ ...n, ...render(ctx.templates, n) }));
      });
    },
    markRead(actor, id) {
      return exec(actor, { action: "notification.read", entity: ["notification", id || ""] }, (tx, a) => {
        const n = id ? tx.get("notifications", id) : null;
        if (!n || n.user_id !== a.userId) throw new PlatformError("NOT_FOUND", "Notification not found.");
        return tx.update("notifications", id, { read_at: ctx.clock.iso(), status: n.status === "sent" ? "read" : n.status });
      });
    },
    failures(actor) {
      return exec(actor, { action: "notification.failures" }, (tx, a) => {
        assertCan(a, "notification.failures");
        return tx.list("notifications", { where: { status: { in: ["failed", "dead"] } } });
      });
    },
    render: (n) => render(ctx.templates, n),
  };
}

export { SYSTEM, isSystem };
