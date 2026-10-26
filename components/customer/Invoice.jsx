"use client";
import { withBase } from "@/lib/asset";
import Money from "@/components/platform/Money";
import { METHOD, fmtDate } from "@/components/customer/labels";

/** Printable order invoice built only from the order snapshot (prices as charged). */
export default function Invoice({ order, payment, className = "" }) {
  const a = order.shipping_address || {};
  return (
    <section id="invoice" aria-labelledby="inv-h" className={`rounded-md border border-border bg-white p-4 sm:p-6 print:border-0 print:p-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="inv-h" className="text-lg font-bold">Invoice</h2>
          <p className="text-sm text-muted-foreground">Order <span className="font-mono">{order.display_no}</span> · {fmtDate(order.placed_at)}</p>
        </div>
        <img src={withBase("/logo-dark.png")} alt="ippovae" width={71} height={24} className="h-6 w-auto" />
      </div>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Deliver to</p>
          <p className="font-medium">{a.recipient_name}</p>
          <p>{[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}</p>
          <p>{[a.city, a.state, a.pincode].filter(Boolean).join(", ")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Payment</p>
          <p className="font-medium">{METHOD[order.payment_method] || order.payment_method}</p>
          {payment && <p className="text-muted-foreground">Status: {String(payment.status).replace(/_/g, " ")}</p>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">Items on this order</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">Price</th>
              <th scope="col" className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-2">{i.name}<span className="block font-mono text-xs text-muted-foreground">{i.sku}</span></td>
                <td className="py-2 pr-2 text-right tabular-nums">{i.qty}</td>
                <td className="py-2 pr-2 text-right"><Money paise={i.unit_price} /></td>
                <td className="py-2 text-right"><Money paise={i.unit_price * i.qty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
        <dt>Subtotal</dt><dd className="text-right"><Money paise={order.subtotal} /></dd>
        {order.discount > 0 && (<><dt>Discount</dt><dd className="text-right"><Money paise={-order.discount} signed /></dd></>)}
        <dt>Delivery</dt><dd className="text-right">{order.delivery_fee > 0 ? <Money paise={order.delivery_fee} /> : "Free"}</dd>
        {order.tax > 0 && (<><dt>Tax</dt><dd className="text-right"><Money paise={order.tax} /></dd></>)}
        {order.short_adjustment > 0 && (<><dt>Items not available</dt><dd className="text-right"><Money paise={-order.short_adjustment} signed /></dd></>)}
        <dt className="border-t border-border pt-1 font-bold">Total</dt><dd className="border-t border-border pt-1 text-right font-bold"><Money paise={order.total} /></dd>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">This is an order summary from the ippovae demo platform. It is not a tax invoice.</p>
    </section>
  );
}
