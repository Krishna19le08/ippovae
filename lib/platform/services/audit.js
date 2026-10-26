// Audit log reads. Writes happen only inside services (core.audit), never from callers.

import { PlatformError } from "../errors.js";
import { assertCan, isSystem } from "../policy/permissions.js";
import { verifyAuditChain } from "../core.js";

const SUP_TYPES = ["ticket", "refund", "order", "assignment"];
const FIN_TYPES = ["payment", "refund", "webhook"];

export function install(ctx, exec) {
  return {
    list(actor, { entity_type, entity_id, action, actor_id, limit } = {}) {
      return exec(actor, { action: "audit.read" }, (tx, a) => {
        assertCan(a, "audit.read");
        let rows = tx.list("audit_logs", { where: { ...(entity_type ? { entity_type } : {}), ...(entity_id ? { entity_id } : {}), ...(action ? { action } : {}), ...(actor_id ? { actor_id } : {}) }, orderBy: "at" });
        if (!isSystem(a) && !a.roles.some((r) => r.role === "super_admin")) {
          rows = rows.filter((r) => a.roles.some((x) => (x.role === "store_manager" && r.store_id === x.store_id) || (x.role === "support_supervisor" && SUP_TYPES.includes(r.entity_type)) || (x.role === "finance_operator" && FIN_TYPES.includes(r.entity_type))));
        }
        if (limit) rows = rows.slice(-limit);
        return rows;
      });
    },
    verifyChain(actor) {
      return exec(actor, { action: "audit.verify" }, (tx, a) => {
        if (!isSystem(a) && !a.roles.some((r) => r.role === "super_admin")) throw new PlatformError("FORBIDDEN", "Only a super admin can verify the audit chain.", { action: "audit.verify" });
        return verifyAuditChain(tx.list("audit_logs"));
      });
    },
  };
}
