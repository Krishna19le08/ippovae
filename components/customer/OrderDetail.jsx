"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CreditCard, FileText, LifeBuoy, Printer, RotateCcw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ErrorNotice, LoadingState } from "@/components/platform/ErrorNotice";
import Money from "@/components/platform/Money";
import StatusBadge from "@/components/platform/StatusBadge";
import CancelOrder from "@/components/customer/CancelOrder";
import Invoice from "@/components/customer/Invoice";
import OrderTracking from "@/components/customer/OrderTracking";
import { METHOD, REFUND_LABEL, cancelReasonLabel, fmtDate, fmtDateTime } from "@/components/customer/labels";
import { getCatalogEntry } from "@/lib/admin/catalog";
import { usePlatform, usePlatformQuery } from "@/lib/platform-ui/PlatformProvider";

const sold = (slug) => { const e = getCatalogEntry(slug); return !!e && !e.hidden; };
const card = "rounded-md border border-border bg-white p-4 sm:p-5";

function PaymentsAndRefunds({ order, payment, actor, p }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const pay = order.payment;
  const refunds = order.refunds || [];

  const payNow = () => {
    setBusy(true);
    setErr(null);
    let r = { ok: true };
    if (pay.status === "created" || pay.status === "failed") r = p.payments.start(actor, { order_id: order.id });
    if (r.ok) r = p.payments.payMock(actor, { order_id: order.id, handle: "success" });
    setBusy(false);
    if (!r.ok) setErr(r.error);
  };

  return (
    <section aria-labelledby="pay-h" className={card}>
      <h2 id="pay-h" className="text-lg font-bold">Payments and refunds</h2>
      {!pay ? <p className="mt-2 text-sm text-muted-foreground">No payment is recorded for this order.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Payment and refund history</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-2 font-semibold">What</th>
                <th scope="col" className="py-2 pr-2 font-semibold">Status</th>
                <th scope="col" className="py-2 pr-2 font-semibold">When</th>
                <th scope="col" className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <th scope="row" className="py-2 pr-2 text-left font-medium">Payment by {METHOD[pay.method] || pay.method}</th>
                <td className="py-2 pr-2"><StatusBadge kind="payment" value={pay.status} /></td>
                <td className="py-2 pr-2 text-muted-foreground">{payment?.captured_at ? fmtDateTime(payment.captured_at) : ""}</td>
                <td className="py-2 text-right"><Money paise={pay.amount} /></td>
              </tr>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <th scope="row" className="py-2 pr-2 text-left font-medium">Refund</th>
                  <td className="py-2 pr-2">{REFUND_LABEL[r.status] || r.status}</td>
                  <td className="py-2 pr-2 text-muted-foreground" />
                  <td className="py-2 text-right"><Money paise={r.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payment && payment.refunded_amount > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Refunded so far: <Money paise={payment.refunded_amount} className="font-semibold text-foreground" />. Refunds go back to your original payment method.</p>
      )}
      {order.internal_state === "pending_payment" && pay && ["created", "pending", "failed"].includes(pay.status) && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            {pay.status === "failed" ? "Your last payment did not go through. " : ""}Complete payment{pay.expires_at ? ` before ${fmtDateTime(pay.expires_at)}` : ""} or the order is cancelled and the items are released.
          </p>
          <Button type="button" className="mt-2 min-h-11" onClick={payNow} disabled={busy}><CreditCard aria-hidden="true" /> {busy ? "Working..." : "Pay now (demo gateway)"}</Button>
          {err && <ErrorNotice error={err} className="mt-2" />}
        </div>
      )}
    </section>
  );
}

function OrderTickets({ orderId }) {
  const q = usePlatformQuery((p, a) => p.tickets.list(a, { order_id: orderId }), [orderId]);
  if (!q.data?.length) return null;
  return (
    <section aria-labelledby="tix-h" className={card}>
      <h2 id="tix-h" className="text-lg font-bold">Support requests for this order</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {q.data.map((t) => (
          <li key={t.id}>
            <Link href={`/help/tickets/view?id=${encodeURIComponent(t.id)}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:text-foreground">
              <span className="font-mono text-xs text-muted-foreground">{t.display_no}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{t.subject}</span>
              <StatusBadge kind="ticket" value={t.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Body({ order, actor }) {
  const { p } = usePlatform();
  const [showInvoice, setShowInvoice] = useState(false);
  const [added, setAdded] = useState(false);
  const payment = usePlatformQuery((pp, a) => (order.payment ? pp.payments.get(a, order.payment.id) : null), [order.payment?.id, order.version]).data;
  const available = order.items.filter((i) => sold(i.slug));
  const cancelled = order.status === "cancelled";

  const reorder = () => {
    for (const i of available) window.dispatchEvent(new CustomEvent("kn-cart-add", { detail: { slug: i.slug, qty: i.qty } }));
    window.dispatchEvent(new Event("kn-open-cart"));
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Link href="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:underline"><ArrowLeft className="size-4" aria-hidden="true" /> All orders</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Order <span className="font-mono">{order.display_no}</span></h1>
          <StatusBadge kind="order" value={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed {fmtDateTime(order.placed_at)} · Total <Money paise={order.total} className="font-semibold text-foreground" /> · {METHOD[order.payment_method] || order.payment_method}
          {order.legacy_id ? <> · Shop ref <span className="font-mono">{order.legacy_id}</span></> : null}
        </p>
        {cancelled && order.cancel_reason && <p className="mt-1 text-sm text-muted-foreground">Cancelled{order.cancelled_at ? ` on ${fmtDate(order.cancelled_at)}` : ""}. Reason: {cancelReasonLabel(order.cancel_reason)}.</p>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] print:hidden">
        <div className="space-y-4">
          <OrderTracking order={order} />
          <CancelOrder order={order} p={p} actor={actor} />
        </div>
        <div className="space-y-4">
          <section aria-labelledby="items-h" className={card}>
            <h2 id="items-h" className="text-lg font-bold">Items</h2>
            <ul className="mt-2">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
                  <div className="size-14 shrink-0 rounded-lg bg-slate-50">
                    {i.image_url && <img src={i.image_url} alt="" className="size-full object-contain p-1 mix-blend-multiply" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">Qty {i.qty} × <Money paise={i.unit_price} />{i.fulfilment_status === "short" ? " · some units were not available" : ""}</p>
                  </div>
                  <Money paise={i.unit_price * i.qty} className="text-sm font-bold" />
                </li>
              ))}
            </ul>
            <dl className="mt-2 ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
              <dt>Subtotal</dt><dd className="text-right"><Money paise={order.subtotal} /></dd>
              {order.discount > 0 && (<><dt>Discount</dt><dd className="text-right"><Money paise={-order.discount} signed /></dd></>)}
              <dt>Delivery</dt><dd className="text-right">{order.delivery_fee > 0 ? <Money paise={order.delivery_fee} /> : "Free"}</dd>
              {order.tax > 0 && (<><dt>Tax</dt><dd className="text-right"><Money paise={order.tax} /></dd></>)}
              <dt className="font-bold">Total</dt><dd className="text-right font-bold"><Money paise={order.total} /></dd>
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">
              Delivery to <span className="font-medium text-foreground">{order.shipping_address?.recipient_name}</span>: {[order.shipping_address?.line1, order.shipping_address?.city, order.shipping_address?.pincode].filter(Boolean).join(", ")}
            </p>
          </section>
          <PaymentsAndRefunds order={order} payment={payment} actor={actor} p={p} />
          <OrderTickets orderId={order.id} />
          <section aria-labelledby="act-h" className={card}>
            <h2 id="act-h" className="sr-only">More actions</h2>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="min-h-11" aria-expanded={showInvoice} aria-controls="invoice" onClick={() => setShowInvoice((v) => !v)}>
                <FileText aria-hidden="true" /> {showInvoice ? "Hide invoice" : "View invoice"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={reorder} disabled={!available.length}>
                {added ? <Check aria-hidden="true" /> : <RotateCcw aria-hidden="true" />} {added ? "Added to cart" : "Order again"}
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/help/tickets?new=1&order=${encodeURIComponent(order.id)}`}><LifeBuoy aria-hidden="true" /> Report a problem</Link>
              </Button>
            </div>
            {available.length < order.items.length && <p className="mt-2 text-xs text-muted-foreground">{available.length ? "Some items are no longer listed and will be skipped." : "These items are no longer listed."}</p>}
            {order.internal_state === "delivered" && <p className="mt-2 text-xs text-muted-foreground">Delivered {fmtDateTime(order.delivered_at)}. If something is wrong, report a problem and we will look into it.</p>}
          </section>
        </div>
      </div>

      <div className={showInvoice ? "" : "hidden print:block"}>
        {showInvoice && (
          <div className="mb-2 flex justify-end print:hidden">
            <Button type="button" className="min-h-11" onClick={() => window.print()}><Printer aria-hidden="true" /> Print invoice</Button>
          </div>
        )}
        <Invoice order={order} payment={order.payment} />
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const id = useSearchParams().get("id") || "";
  const q = usePlatformQuery((p, a) => (id ? p.orders.get(a, id) : { ok: false, error: { code: "NOT_FOUND", message: "No order was specified." } }), [id]);
  const { actor } = usePlatform();
  if (q.loading) return <LoadingState label="Loading order" rows={4} />;
  if (q.error) {
    return (
      <div className="space-y-4">
        <ErrorNotice error={q.error} onRetry={q.refetch} />
        <Button asChild variant="outline" className="min-h-11"><Link href="/orders"><ArrowLeft aria-hidden="true" /> Back to your orders</Link></Button>
      </div>
    );
  }
  if (!q.data || !actor) return null;
  return <Body order={q.data} actor={actor} />;
}

