"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "@/components/ui/icons";
import AddressBook from "@/features/checkout/components/AddressBook";
import { useAddresses } from "@/features/checkout/addresses";
import { useCatalog } from "@/features/catalog/catalogStore";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import CartStep from "./CartStep";
import DoneStep from "./DoneStep";
import MiniSummary from "./MiniSummary";
import PaymentStep from "./PaymentStep";
import StepIndicator from "./StepIndicator";
import SummaryStep from "./SummaryStep";
import { useCheckoutQuote } from "./useCheckoutQuote";
import { usePayment } from "./usePayment";

// The steps are cart > address > summary > pay > done.
const TITLES = { cart: "Your Cart", address: "Delivery Address", summary: "Order Summary", pay: "Payment", done: "Order Placed" };
const BACK = { address: "cart", summary: "address", pay: "summary" };

// Slide-in cart that doubles as the checkout flow. `view` ({ step, n }) lets the header ask for a particular step:
// each request bumps `n`, so asking for the same step twice still takes effect.
export default function CartDrawer({ open, onClose, items, view, setQty, clear, onCheckout, returnRef }) {
  const dialogRef = useDialogFocus(open, returnRef);
  const headingRef = useRef(null);
  const previousStep = useRef("cart");
  const [step, setStep] = useState("cart");
  const [method, setMethod] = useState("upi");
  const [placed, setPlaced] = useState(null); // { name, no, total, fee }, amounts in rupees
  const { selected: address, ready: addressesReady } = useAddresses();
  // all entries incl. hidden ones, so a product hidden by the admin can still be bought from a saved cart
  const { list: catalog, ready: catalogReady } = useCatalog({ includeHidden: true });

  // Cart entries matched to catalogue products. Ones deleted from the catalogue are shown as unavailable and left
  // out of totals and checkout (not flagged until the catalogue has loaded).
  const entries = Object.entries(items).map(([slug, qty]) => ({ slug, qty, p: catalog.find((x) => x.slug === slug) }));
  const lines = entries.filter((l) => l.p);
  const unavailable = catalogReady ? entries.filter((l) => !l.p) : [];
  const total = lines.reduce((sum, l) => sum + l.p.price * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  const quote = useCheckoutQuote({ enabled: open && (step === "summary" || step === "pay"), address, lines });
  const payment = usePayment({
    lines,
    address,
    quote,
    method,
    onPlaced: (order) => {
      setPlaced({ ...order, name: address?.name || "" });
      clear();
      setStep("done");
    },
  });

  // jump to the step the header asked for
  useEffect(() => {
    if (view.n) setStep(view.step);
  }, [view]);

  // the summary and payment steps need a delivery address
  useEffect(() => {
    if (addressesReady && !address && (step === "summary" || step === "pay")) setStep("address");
  }, [step, addressesReady, address]);

  // moving between steps moves focus to the new step heading
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [step, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const close = () => {
    onClose();
    if (step === "done") setStep("cart");
  };

  const changeAddress = () => setStep("address");

  let content;
  if (step === "done") {
    content = <DoneStep placed={placed} method={method} onClose={close} />;
  } else if (step === "address") {
    content = (
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <MiniSummary count={count} total={total} />
        <AddressBook mode="checkout" onDeliver={() => setStep("summary")} />
      </div>
    );
  } else if (step === "summary" && address) {
    content = (
      <SummaryStep
        address={address}
        lines={lines}
        count={count}
        quote={quote}
        onChangeAddress={changeAddress}
        onContinue={() => setStep("pay")}
      />
    );
  } else if (step === "pay" && address) {
    content = (
      <PaymentStep
        address={address}
        count={count}
        total={total}
        quote={quote}
        method={method}
        onMethodChange={setMethod}
        payment={payment}
        onChangeAddress={changeAddress}
      />
    );
  } else {
    content = <CartStep lines={lines} unavailable={unavailable} total={total} setQty={setQty} onClose={onClose} onCheckout={onCheckout} />;
  }

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white text-foreground transition-[transform,box-shadow] duration-300 motion-reduce:transition-none ${
          open ? "translate-x-0 shadow-2xl" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 [@media(max-height:500px)]:py-1.5">
          <div className="flex items-center gap-2">
            {BACK[step] && (
              <button onClick={() => setStep(BACK[step])} aria-label="Back" className="-m-2 rounded-md p-2.5 focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft className="size-5" />
              </button>
            )}
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              {TITLES[step]}
            </h2>
          </div>
          <button onClick={close} aria-label="Close cart" className="-m-2 rounded-md p-2.5 focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-6" />
          </button>
        </div>

        {step !== "done" && <StepIndicator step={step} />}
        {content}
      </div>
    </div>
  );
}
