"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LifeBuoy, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import QueryState, { EmptyState } from "@/components/platform/ErrorNotice";
import StatusBadge from "@/components/platform/StatusBadge";
import NewTicketForm from "@/components/customer/NewTicketForm";
import { categoryLabel, fmtDate } from "@/components/customer/labels";
import { usePlatform, usePlatformQuery } from "@/lib/platform-ui/PlatformProvider";

export default function TicketsList() {
  const sp = useSearchParams();
  const [creating, setCreating] = useState(sp.get("new") === "1");
  const { p } = usePlatform();
  const q = usePlatformQuery((pp, a) => pp.tickets.list(a), []);
  useEffect(() => { if (sp.get("new") === "1") setCreating(true); }, [sp]);
  const orderNo = (id) => (id ? p.repo.get("orders", id)?.display_no : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Ask about an order, a payment or a refund. We reply here, and you can add photos. Expected first reply: within {p.policies.tickets.first_response_hours} hours, as a target.
        </p>
        {!creating && <Button type="button" className="min-h-11" onClick={() => setCreating(true)}><Plus aria-hidden="true" /> New request</Button>}
      </div>

      {creating && (
        <NewTicketForm initialOrder={sp.get("order") || ""} initialCategory={sp.get("category") || ""} onCancel={() => setCreating(false)} />
      )}

      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className="mb-2 text-lg font-bold">Your requests</h2>
        <QueryState query={q} empty={<EmptyState icon={LifeBuoy} title="No support requests yet">When you contact us, the conversation shows up here.</EmptyState>}>
          {(rows) => (
            <ul className="divide-y divide-border rounded-md border border-border bg-white">
              {rows.map((t) => (
                <li key={t.id}>
                  <Link href={`/help/tickets/view?id=${encodeURIComponent(t.id)}`} className="block min-h-14 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs text-muted-foreground">{t.display_no}</span>
                      <span className="min-w-0 flex-1 text-sm font-semibold">{t.subject}</span>
                      <StatusBadge kind="ticket" value={t.status} />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {categoryLabel(t.category)}{orderNo(t.order_id) ? ` · Order ${orderNo(t.order_id)}` : ""} · Opened {fmtDate(t.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>
    </div>
  );
}
