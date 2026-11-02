import { Button } from "@/components/ui/button";
import { inr } from "@/features/catalog/data";
import AddressBlock from "./AddressBlock";
import Breakdown from "./Breakdown";

// Step 3: review the address and items, see the priced breakdown, then continue to payment.
export default function SummaryStep({ address, lines, count, quote, onChangeAddress, onContinue }) {
  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <AddressBlock address={address} onChange={onChangeAddress} />
        <section aria-label="Items in your order">
          <h3 className="mb-1 text-sm font-semibold">Items ({count})</h3>
          <ul>
            {lines.map(({ p, qty }) => (
              <li key={p.slug} className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
                <div className="size-16 shrink-0 rounded-lg bg-slate-50">
                  <img src={p.img} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Qty {qty} × {inr(p.price)}
                  </div>
                </div>
                <span className="text-sm font-bold">{inr(p.price * qty)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="border-t border-slate-200 p-4">
        <Breakdown quote={quote} />
        <Button onClick={onContinue} disabled={lines.length === 0 || quote.status !== "ok"} className="h-11 w-full rounded-xl">
          Continue to payment
        </Button>
      </div>
    </>
  );
}
