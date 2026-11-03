"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, LifeBuoy, Package, Truck } from "@/components/ui/icons";
import StatusBadge from "@/components/common/StatusBadge";
import Money from "@/components/common/Money";
import { fmtDate } from "@/components/orders/labels";
import { useCustomerSession } from "@/components/common/layout/CustomerShell";
import { PlatformRoot, usePlatformQuery } from "@/providers/PlatformProvider";

function List() {
  const s = useCustomerSession();
  const q = usePlatformQuery((p, a) => p.orders.list(a, { user_id: a.userId }), []);
  if (s.status === "signed_out") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <Package className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">Sign in to see your orders</p>
        <p className="text-sm text-muted-foreground">Orders are saved to your account on this device.</p>
        <Button onClick={() => window.dispatchEvent(new Event("kn-open-login"))} className="mt-2 h-11 rounded-xl px-8">Sign in</Button>
      </div>
    );
  }
  if (s.status !== "ready" || q.loading) return null;
  const orders = q.data || [];
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <Package className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">No orders yet</p>
        <p className="text-sm text-muted-foreground">Orders you place will show up here so you can track them.</p>
        <Button asChild className="mt-2 h-11 rounded-xl px-8"><Link href="/products">Browse products</Link></Button>
        <Link href="/help/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:underline"><LifeBuoy className="size-4" aria-hidden="true" /> Support requests</Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="live-h" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-h" className="flex items-center gap-2 text-lg font-bold"><Truck className="size-5 text-foreground" aria-hidden="true" /> Your orders</h2>
        <Link href="/help/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:underline"><LifeBuoy className="size-4" aria-hidden="true" /> Support requests</Link>
      </div>
      <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-white">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${encodeURIComponent(o.id)}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-ring">
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

/** The orders list on /orders: sign-in prompt, empty state, or the customer's orders. */
export default function PlatformOrders() {
  return (
    <PlatformRoot>
      <List />
    </PlatformRoot>
  );
}
