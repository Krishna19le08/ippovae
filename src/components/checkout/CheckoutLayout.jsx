import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { inr } from "@/data";
import StepIndicator from "@/components/cart/CartDrawer/StepIndicator";

/** The items list shown beside the checkout steps. */
// `compact` caps the list height (it scrolls) so the totals and pay button stay on screen on short laptop screens.
export function OrderAside({ lines, count, compact = false, children }) {
  return (
    <aside aria-label="Order summary" className="rounded-xl border border-border bg-white p-5 shadow-sm lg:sticky lg:top-40">
      <h2 className="mb-1 text-lg font-bold">Order summary ({count})</h2>
      <ul className={compact ? "max-h-[30vh] overflow-y-auto pr-3" : ""}>
        {lines.map(({ p, qty }) => (
          <li key={p.slug} className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
            <div className="size-16 shrink-0 rounded-lg bg-slate-50">
              <img src={p.img} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">Qty {qty} × {inr(p.price)}</div>
            </div>
            <span className="text-sm font-bold">{inr(p.price * qty)}</span>
          </li>
        ))}
      </ul>
      {children && <div className="mt-4 border-t border-slate-200 pt-4">{children}</div>}
    </aside>
  );
}

/**
 * Full-page frame for a checkout step: back link, title, progress bar, the step itself and an optional aside.
 * `step` is "address" | "summary" | "pay" (or "" for the confirmation, which has no progress bar).
 */
export default function CheckoutLayout({ step, title, backHref, backLabel, aside, children }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70vh] max-w-6xl px-4 pt-6 pb-28 outline-none lg:pb-16">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {backHref && (
          <Link href={backHref} className="flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> {backLabel}
          </Link>
        )}
      </div>
      {step && (
        <div className="mx-auto mb-6 max-w-2xl">
          <StepIndicator step={step} />
        </div>
      )}
      <div className={aside ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" : "mx-auto max-w-2xl"}>
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">{children}</div>
        {aside}
      </div>
    </main>
  );
}

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-semibold">Your cart is empty</p>
      <Button asChild className="h-11 rounded-xl px-8"><Link href="/products">Shop all parts</Link></Button>
    </div>
  );
}

export function Loading() {
  return <p role="status" className="p-6 text-sm text-muted-foreground">Loading your checkout...</p>;
}
