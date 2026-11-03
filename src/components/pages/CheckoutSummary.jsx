"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inr } from "@/data";
import CheckoutLayout, { EmptyCart, Loading } from "@/components/checkout/CheckoutLayout";
import { useCheckoutData } from "@/components/checkout/useCheckoutData";
import AddressBlock from "@/components/cart/CartDrawer/AddressBlock";
import Breakdown from "@/components/cart/CartDrawer/Breakdown";
import { useCheckoutQuote } from "@/components/cart/CartDrawer/useCheckoutQuote";

// Checkout step 2 as a page: review the address and items on the left; the priced total and "Continue" on the right.
export default function CheckoutSummary() {
  const router = useRouter();
  const { lines, count, address, ready } = useCheckoutData();
  const quote = useCheckoutQuote({ enabled: ready && lines.length > 0 && !!address, address, lines });

  // the summary needs a delivery address
  useEffect(() => {
    if (ready && lines.length > 0 && !address) router.replace("/checkout/address");
  }, [ready, lines.length, address, router]);

  const ok = ready && lines.length > 0 && !!address;
  let content;
  if (!ok && !(ready && lines.length === 0)) content = <Loading />;
  else if (!ok) content = <EmptyCart />;
  else
    content = (
      <div className="space-y-5 p-5">
        <AddressBlock address={address} onChange={() => router.push("/checkout/address")} />
        <section aria-label="Items in your order">
          <h2 className="mb-1 text-base font-bold">Items ({count})</h2>
          <ul>
            {lines.map(({ p, qty }) => (
              <li key={p.slug} className="flex gap-4 border-b border-slate-200 py-4 last:border-b-0">
                <div className="size-20 shrink-0 rounded-lg bg-slate-50">
                  <img src={p.img} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">Qty {qty} × {inr(p.price)}</div>
                </div>
                <span className="font-bold">{inr(p.price * qty)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );

  const totals = ok && (
    <aside aria-label="Price details" className="rounded-xl border border-border bg-white p-5 shadow-sm lg:sticky lg:top-40">
      <h2 className="mb-3 text-lg font-bold">Price details</h2>
      <Breakdown quote={quote} />
      <Button onClick={() => router.push("/checkout/payment")} disabled={quote.status !== "ok"} className="h-12 w-full rounded-xl text-base">
        Continue to payment
      </Button>
    </aside>
  );

  return (
    <CheckoutLayout step="summary" title="Order Summary" backHref="/checkout/address" backLabel="Back to address" aside={totals || null}>
      {content}
    </CheckoutLayout>
  );
}
