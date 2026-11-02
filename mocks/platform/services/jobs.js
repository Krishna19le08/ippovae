// Background work for the demo. A JobsRunner React component (UI owner) calls runDue() on mount, on focus and every
// few seconds. Every step is idempotent and version-checked, so two tabs running it is harmless.

export function install(ctx, exec, api) {
  return {
    runDue() {
      const out = {};
      out.webhooks = api.payments.deliverScheduled().length;
      out.expired_orders = api.payments.expireDue().length;
      out.offers_expired = api.delivery.expireOffers().length;
      out.refunds_polled = api.refunds.processDue().length;
      out.tickets = api.tickets.runSla().length;
      const n = api.notifications.flush();
      out.notifications = n;
      // prune idempotency records past their TTL
      const cutoff = ctx.clock.now() - ctx.policies.idempotency_ttl_hours * 3600000;
      out.idempotency_pruned = ctx.repo.transact((tx) => {
        const old = tx.list("idempotency_keys").filter((r) => Date.parse(r.created_at) < cutoff);
        for (const r of old) tx.remove("idempotency_keys", r.id);
        return old.length;
      });
      return out;
    },
  };
}
