"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CheckoutLayout, { EmptyCart, Loading, OrderAside } from "@/components/checkout/CheckoutLayout";
import { useCheckoutData } from "@/components/checkout/useCheckoutData";
import { Button } from "@/components/ui/button";
import Breakdown from "@/components/cart/CartDrawer/Breakdown";
import DoneStep from "@/components/cart/CartDrawer/DoneStep";
import PaymentStep, { submitLabel } from "@/components/cart/CartDrawer/PaymentStep";
import { useCheckoutQuote } from "@/components/cart/CartDrawer/useCheckoutQuote";
import { usePayment } from "@/components/cart/CartDrawer/usePayment";

// Checkout step 3 as a page: choose how to pay and place the order, then show the confirmation.
export default function CheckoutPayment() {
  const router = useRouter();
  const [method, setMethod] = useState("upi");
  const [placed, setPlaced] = useState(null); // { name, no, total, fee }, amounts in rupees
  const { lines, count, total, address, ready } = useCheckoutData();

  const quote = useCheckoutQuote({ enabled: !placed && ready && lines.length > 0 && !!address, address, lines });
  const payment = usePayment({
    lines,
    address,
    quote,
    method,
    onPlaced: (order) => {
      setPlaced({ ...order, name: address?.name || "" });
      // the header owns the cart; ask it to empty each line
      lines.forEach((l) => window.dispatchEvent(new CustomEvent("kn-cart-set", { detail: { slug: l.slug, qty: 0 } })));
    },
  });

  // payment needs a delivery address
  useEffect(() => {
    if (!placed && ready && lines.length > 0 && !address) router.replace("/checkout/address");
  }, [placed, ready, lines.length, address, router]);

  if (placed) {
    return (
      <CheckoutLayout step="" title="Order placed">
        <div className="flex min-h-[28rem] flex-col">
          <DoneStep placed={placed} method={method} onClose={() => router.push("/")} />
        </div>
      </CheckoutLayout>
    );
  }

  const ok = ready && lines.length > 0 && !!address;
  let content;
  if (!ready || (lines.length > 0 && !address)) content = <Loading />;
  else if (lines.length === 0) content = <EmptyCart />;
  else
    content = (
      <PaymentStep
        address={address}
        count={count}
        total={total}
        quote={quote}
        method={method}
        onMethodChange={setMethod}
        payment={payment}
        onChangeAddress={() => router.push("/checkout/address")}
        formId="pay-form"
        hideFooter
      />
    );

  return (
    <CheckoutLayout
      step="pay"
      title="Payment"
      backHref="/checkout/summary"
      backLabel="Back to summary"
      aside={
        ok ? (
          <OrderAside lines={lines} count={count} compact>
            <Breakdown quote={quote} />
            {payment.error && <p role="alert" className="mb-3 text-sm font-medium text-red-700">{payment.error}</p>}
            <Button type="submit" form="pay-form" disabled={payment.busy || quote.status !== "ok"} className="h-12 w-full rounded-xl text-base">
              {submitLabel({ busy: payment.busy, method, cardStage: payment.cardStage, quote })}
            </Button>
          </OrderAside>
        ) : null
      }
    >
      {content}
    </CheckoutLayout>
  );
}
