import { inr } from "@/data";

const ROW = "flex justify-between text-sm text-muted-foreground";

// Items, delivery and tax from the platform quote (amounts in paise), shown before the customer pays.
export default function Breakdown({ quote }) {
  if (quote.status === "error") return <p role="alert" className="mb-3 text-sm font-medium text-red-700">{quote.message}</p>;
  if (quote.status !== "ok") return <p role="status" className="mb-3 text-sm text-muted-foreground">Calculating delivery and total...</p>;

  return (
    <div className="mb-3 space-y-1">
      <p className={ROW}><span>Items</span><span>{inr(quote.subtotal / 100)}</span></p>
      {quote.discount > 0 && <p className={ROW}><span>Discount</span><span>-{inr(quote.discount / 100)}</span></p>}
      <p className={ROW}><span>Delivery</span><span>{quote.delivery_fee > 0 ? inr(quote.delivery_fee / 100) : "Free"}</span></p>
      {quote.tax > 0 && <p className={ROW}><span>Tax</span><span>{inr(quote.tax / 100)}</span></p>}
      <p className="flex justify-between pt-1 font-semibold"><span>Total</span><span>{inr(quote.total / 100)}</span></p>
    </div>
  );
}
