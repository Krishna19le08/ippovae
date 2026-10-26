"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Package, RotateCcw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { addressLines, currentUser } from "@/lib/addresses";
import { inr } from "@/lib/data";
import { getCatalogEntry, productHref, useCatalog } from "@/lib/admin/catalog";
import OrderTracker from "@/components/OrderTracker";
import { useOrders } from "@/lib/orders";

const METHOD = { upi: "UPI", card: "Credit / Debit Card", netbanking: "Net Banking", cod: "Cash on Delivery" };

const when = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// still sold = exists in the catalogue and not hidden. Order lines always show their saved snapshot (name, price, image).
const sold = (slug) => {
  const e = getCatalogEntry(slug);
  return !!e && !e.hidden;
};

const count = (o) => o.items.reduce((s, i) => s + i.qty, 0);

function Order({ o, onAgain, added }) {
  const { line1, line2 } = o.address ? addressLines(o.address) : {};
  // only items that are still sold can go back in the cart
  const available = o.items.filter((i) => sold(i.slug));
  return (
    <li className="rounded-md border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-paper px-4 py-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Order placed</p>
          <p className="font-medium">{when(o.date)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="tnum font-medium">{inr(o.total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payment</p>
          <p className="font-medium">{METHOD[o.method] || o.method}</p>
        </div>
        <div className="sm:ml-auto">
          <p className="text-xs text-muted-foreground">Order #</p>
          <p className="font-mono font-medium">{o.id}</p>
        </div>
      </div>

      <OrderTracker order={o} />

      <div className="p-4">
        <ul>
          {o.items.map((i) => {
            const live = sold(i.slug);
            const row = (
              <>
                <div className="size-16 shrink-0 rounded-lg bg-slate-50">
                  <img src={i.img} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold">{i.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Qty {i.qty} × {inr(i.price)}
                  </div>
                </div>
                <span className="tnum text-sm font-bold">{inr(i.price * i.qty)}</span>
              </>
            );
            return (
              <li key={i.slug} className="border-b border-slate-200 last:border-b-0">
                {live ? (
                  <Link href={productHref(i.slug)} className="flex items-center gap-3 py-3 hover:text-foreground">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>

        {o.address && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Delivery to {o.address.name}</span>: {line1}, {line2}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => onAgain(o)} disabled={available.length === 0} className="h-11 rounded-xl px-5">
            {added === o.id ? <Check aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {added === o.id ? "Added to cart" : "Buy again"}
          </Button>
          {available.length < o.items.length && (
            <p className="text-xs text-muted-foreground">
              {available.length === 0 ? "These items are no longer listed." : "Some items are no longer listed and will be skipped."}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function OrdersList() {
  const { list, ready } = useOrders();
  useCatalog({ includeHidden: true }); // re-render when the catalogue changes
  const [added, setAdded] = useState("");

  // the header owns the cart: send it the same events the Add to cart buttons use
  const again = (o) => {
    for (const i of o.items) {
      if (sold(i.slug)) {
        window.dispatchEvent(new CustomEvent("kn-cart-add", { detail: { slug: i.slug, qty: i.qty } }));
      }
    }
    setAdded(o.id);
    setTimeout(() => setAdded((a) => (a === o.id ? "" : a)), 2500);
    window.dispatchEvent(new Event("kn-open-cart"));
  };

  if (!ready) return null;

  if (!currentUser()) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <Package className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">Sign in to see your orders</p>
        <p className="text-sm text-muted-foreground">Orders are saved to your account on this device.</p>
        <Button onClick={() => window.dispatchEvent(new Event("kn-open-login"))} className="mt-2 h-11 rounded-xl px-8">
          Sign in
        </Button>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <Package className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">No orders yet</p>
        <p className="text-sm text-muted-foreground">Orders you place will show up here so you can buy them again.</p>
        <Button asChild className="mt-2 h-11 rounded-xl px-8">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {list.length} {list.length === 1 ? "order" : "orders"} · {list.reduce((s, o) => s + count(o), 0)} {list.reduce((s, o) => s + count(o), 0) === 1 ? "item" : "items"}
      </p>
      <ul className="space-y-4">
        {list.map((o) => (
          <Order key={o.id} o={o} onAgain={again} added={added} />
        ))}
      </ul>
    </>
  );
}
