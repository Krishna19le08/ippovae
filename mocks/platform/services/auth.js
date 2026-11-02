// Identity helpers for the demo and role management. NOT real authentication: signing in only resolves a seeded user
// by email so the UI can act as that user. A real backend replaces this with OTP / sessions.

import { PlatformError } from "../errors.js";
import { assertCan, isSystem } from "../policy/permissions.js";
import { resolveActor, audit, actorId } from "../core.js";

const STORE_ROLES = ["store_manager", "picker_packer"];
const ROLES = ["customer", "super_admin", "store_manager", "picker_packer", "delivery_partner", "support_agent", "support_supervisor", "finance_operator"];

export function install(ctx, exec) {
  return {
    // Returns the resolved actor object (roles re-read from the repository) or null.
    actor(userId) {
      try { return ctx.repo.read((tx) => resolveActor(tx, { userId })); } catch { return null; }
    },
    actorByEmail(email) {
      const u = ctx.repo.read((tx) => tx.list("users")).find((x) => x.email.toLowerCase() === String(email || "").trim().toLowerCase() && !x.deleted_at);
      return u ? this.actor(u.id) : null;
    },
    // Demo sign-in: creates a customer account on first use (same as the legacy shop login), then resolves the actor.
    signIn({ email, name }) {
      const e = String(email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: new PlatformError("VALIDATION_FAILED", "Enter a valid email.", { fields: { email: "invalid" } }).toJSON() };
      return exec(isSystemActor(), { action: "user.sign_in" }, (tx) => {
        let u = tx.list("users").find((x) => x.email.toLowerCase() === e);
        if (!u) {
          u = tx.insert("users", { id: tx.nextId("usr"), email: e, phone: null, name: (name || e.split("@")[0]).trim(), password_hash: null, status: "active", default_address_id: null, last_login_at: null, deleted_at: null });
          tx.insert("user_roles", { id: tx.nextId("rol"), user_id: u.id, role: "customer", store_id: null, created_at: ctx.clock.iso() });
        }
        if (u.status !== "active" || u.deleted_at) throw new PlatformError("FORBIDDEN", "Account is suspended.", { reason: "suspended" });
        tx.update("users", u.id, { last_login_at: ctx.clock.iso() });
        return resolveActor(tx, { userId: u.id });
      });
    },
    listUsers(actor) {
      return exec(actor, { action: "user.list" }, (tx, a) => {
        assertCan(a, "user.manage");
        return tx.list("users").map((u) => ({ ...u, roles: tx.list("user_roles", { where: { user_id: u.id } }).map((r) => ({ role: r.role, store_id: r.store_id })) }));
      });
    },
    assignRole(actor, { user_id, role, store_id = null }) {
      return exec(actor, { action: "user.role_change", entity: ["user", user_id || ""] }, (tx, a) => {
        if (!ROLES.includes(role)) throw new PlatformError("VALIDATION_FAILED", "Unknown role.", { fields: { role: "invalid" } });
        if (!isSystem(a) && a.userId === user_id) throw new PlatformError("FORBIDDEN", "You cannot change your own roles.", { action: "role.assign", reason: "self_change" });
        const target = tx.get("users", user_id);
        if (!target) throw new PlatformError("NOT_FOUND", "User not found.");
        const storeRole = STORE_ROLES.includes(role);
        if (storeRole !== !!store_id) throw new PlatformError("VALIDATION_FAILED", storeRole ? "Store roles need a store." : "This role has no store.", { fields: { store_id: storeRole ? "required" : "must be empty" } });
        const sa = a.roles.some((r) => r.role === "super_admin");
        if (!sa) {
          // store managers may add pickers to their own store (PERMISSIONS.md 3.2 "store staff assign")
          assertCan(a, "staff.assign", { store_id: store_id || undefined });
          if (role !== "picker_packer") throw new PlatformError("FORBIDDEN", "Store managers can only assign pickers.", { action: "staff.assign" });
        } else assertCan(a, "role.assign");
        if (store_id && !tx.get("stores", store_id)) throw new PlatformError("NOT_FOUND", "Store not found.");
        const existing = tx.list("user_roles", { where: { user_id } }).find((r) => r.role === role && (r.store_id || null) === (store_id || null));
        if (existing) return { role: existing, unchanged: true };
        const row = tx.insert("user_roles", { id: tx.nextId("rol"), user_id, role, store_id: store_id || null, created_at: ctx.clock.iso() });
        audit(tx, ctx, a, "user.role_change", ["user", user_id], { after: { added: { role, store_id } }, store_id });
        return { role: row };
      });
    },
    revokeRole(actor, { user_id, role, store_id = null }) {
      return exec(actor, { action: "user.role_change", entity: ["user", user_id || ""] }, (tx, a) => {
        if (!isSystem(a) && a.userId === user_id) throw new PlatformError("FORBIDDEN", "You cannot change your own roles.", { action: "role.assign", reason: "self_change" });
        assertCan(a, "role.assign");
        if (role === "customer") throw new PlatformError("VALIDATION_FAILED", "Every user keeps the customer role.", { fields: { role: "cannot revoke" } });
        const row = tx.list("user_roles", { where: { user_id } }).find((r) => r.role === role && (r.store_id || null) === (store_id || null));
        if (!row) throw new PlatformError("NOT_FOUND", "Role not found.");
        tx.remove("user_roles", row.id);
        audit(tx, ctx, a, "user.role_change", ["user", user_id], { after: { removed: { role, store_id } }, store_id });
        return { removed: true };
      });
    },
    setStatus(actor, { user_id, status }) {
      return exec(actor, { action: "user.status", entity: ["user", user_id || ""] }, (tx, a) => {
        assertCan(a, "user.manage");
        if (!["active", "suspended"].includes(status)) throw new PlatformError("VALIDATION_FAILED", "active or suspended", { fields: { status: "invalid" } });
        if (!isSystem(a) && a.userId === user_id) throw new PlatformError("FORBIDDEN", "You cannot suspend yourself.", { action: "user.manage" });
        const u = tx.get("users", user_id);
        if (!u) throw new PlatformError("NOT_FOUND", "User not found.");
        const next = tx.update("users", user_id, { status });
        audit(tx, ctx, a, "user.status", ["user", user_id], { before: { status: u.status }, after: { status } });
        return next;
      });
    },
    demoAccounts() {
      return ctx.repo.read((tx) => tx.list("users")).map((u) => ({ id: u.id, email: u.email, name: u.name, roles: ctx.repo.read((tx) => tx.list("user_roles", { where: { user_id: u.id } })).map((r) => r.role).filter((r) => r !== "customer" || true) }));
    },
  };
}

import { SYSTEM } from "../policy/permissions.js";
const isSystemActor = () => SYSTEM;
export { actorId };
