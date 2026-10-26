"use client";
import Link from "next/link";
import { ChevronRight, LifeBuoy, Truck } from "lucide-react";
import StatusBadge from "@/components/platform/StatusBadge";
import Money from "@/components/platform/Money";
import { fmtDate } from "@/components/customer/labels";
import { useCustomerSession } from "@/components/customer/CustomerShell";
import { PlatformRoot, usePlatformQuery } from "@/lib/platform-ui/PlatformProvider";

function List() {
  const s = useCustomerSession();
  const q = usePlatformQuery((p, a) => p.orders.list(a, { user_id: a.userId }), []);
  if (s.status !== "ready") return null;
  const orders = q.data || [];
  if (orders.length === 0) {
    return (
      <p className="mb-6 text-sm">
        <Link href="/help/tickets" className="inline-flex min-h-11 items-center gap-1 font-semibold text-foreground hover:underline"><LifeBuoy className="size-4" aria-hidden="true" /> Support requests</Link>
      </p>
    );
  }
  return (
    <section aria-labelledby="live-h" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-h" className="flex items-center gap-2 text-lg font-bold"><Truck className="size-5 text-foreground" aria-hidden="true" /> Live tracking</h2>
        <Link href="/help/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:underline"><LifeBuoy className="size-4" aria-hidden="true" /> Support requests</Link>
      </div>
      <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-white">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/view?id=${encodeURIComponent(o.id)}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring">
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-semibold">{o.display_no}</span>
                <span className="block text-xs text-muted-foreground">{fmtDate(o.placed_at)} · <Money paise={o.total} /></span>
              </span>
              <StatusBadge kind="order" value={o.status} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">View order {o.display_no}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shown above the legacy list on /orders. Renders nothing for signed-out visitors (the legacy list prompts to sign in). */
export default function PlatformOrders() {
  return (
    <PlatformRoot>
      <List />
    </PlatformRoot>
  );
}
