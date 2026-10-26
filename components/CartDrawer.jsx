"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Check, CreditCard, Landmark, MapPin, Minus, Plus, ShoppingCart, Smartphone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddressBook from "@/components/checkout/AddressBook";
import { inr } from "@/lib/data";
import { useCatalog } from "@/lib/admin/catalog";
import CardPayment, { EMPTY_CARD, cvvError, frontErrors } from "@/components/checkout/CardPayment";
import { addressLines, useAddresses } from "@/lib/addresses";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { saveOrder } from "@/lib/orders";
import { mirrorToPlatform } from "@/components/customer/bridge";

const METHODS = [
  { id: "upi", label: "UPI", note: "GPay, PhonePe, Paytm", Icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", note: "Visa, Mastercard, RuPay", Icon: CreditCard },
  { id: "netbanking", label: "Net Banking", note: "All major banks", Icon: Landmark },
  { id: "cod", label: "Cash on Delivery", note: "Pay when it arrives", Icon: Banknote },
];

const STEPS = [
  ["cart", "Cart"],
  ["address", "Address"],
  ["summary", "Summary"],
  ["pay", "Payment"],
];
const TITLES = { cart: "Your Cart", address: "Delivery Address", summary: "Order Summary", pay: "Payment", done: "Order Placed" };
const BACK = { address: "cart", summary: "address", pay: "summary" };

// small confetti burst around the check mark (brand colours); decorative, hidden from assistive tech
const CONFETTI = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.3;
  const d = 52 + (i % 3) * 14;
  return {
    x: `${Math.round(Math.cos(a) * d)}px`,
    y: `${Math.round(Math.sin(a) * d)}px`,
    r: `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
    c: ["#E8FF00", "#0B0B0B", "#16a34a", "#9CA3AF"][i % 4],
  };
});

const plural = (n) => `${n} ${n === 1 ? "item" : "items"}`;

function StepIndicator({ step }) {
  const at = STEPS.findIndex(([id]) => id === step);
  return (
    <ol aria-label="Checkout progress" className="grid grid-cols-4 border-b border-slate-200 px-2 py-3 text-xs min-[400px]:px-4 [@media(max-height:500px)]:py-1.5">
      {STEPS.map(([id, label], i) => (
        <li
          key={id}
          aria-current={i === at ? "step" : undefined}
          className={`relative flex min-w-0 flex-col items-center gap-1.5 text-center ${i === at ? "font-bold text-foreground" : i < at ? "text-foreground" : "text-muted-foreground"}`}
        >
          {/* edge: runs from this node's centre to the next node's centre, behind the nodes */}
          {i < STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute top-3 left-1/2 h-0.5 w-full ${i < at ? "bg-foreground" : "bg-slate-300"}`}
            />
          )}
          {/* node */}
          <span
            aria-hidden="true"
            className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
              i === at
                ? "border-foreground bg-foreground text-white ring-4 ring-foreground/20"
                : i < at
                  ? "border-foreground bg-foreground text-white"
                  : "border-slate-300 bg-white text-muted-foreground"
            }`}
          >
            {i < at ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className="max-w-full break-words">
            {label}
            {i < at && <span className="sr-only"> (completed)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MiniSummary({ count, total }) {
  return (
    <p className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{plural(count)}</span>
      <span className="font-semibold">Total {inr(total)}</span>
    </p>
  );
}

function AddressBlock({ a, onChange }) {
  const { line1, line2 } = addressLines(a);
  return (
    <section aria-label="Delivery address" className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
      <MapPin className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          {a.name} · {a.phone}
        </div>
        <div className="text-muted-foreground">{line1}</div>
        <div className="text-muted-foreground">{line2}</div>
        {a.coords && (
          <a href={`https://www.google.com/maps?q=${a.coords.lat},${a.coords.lon}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block py-1 text-xs font-medium text-foreground underline underline-offset-4">
            View on map
          </a>
        )}
      </div>
      <button type="button" onClick={onChange} aria-label="Change delivery address" className="-m-1 min-h-10 rounded-md px-2 text-sm font-medium text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">
        Change
      </button>
    </section>
  );
}

export default function CartDrawer({ open, onClose, items, view, setQty, clear, onCheckout, returnRef }) {
  const dialogRef = useDialogFocus(open, returnRef);
  const [step, setStep] = useState("cart"); // cart | address | summary | pay | done
  const [method, setMethod] = useState("upi");
  const [card, setCard] = useState(EMPTY_CARD);
  const [cardStage, setCardStage] = useState("front"); // front: number/name/expiry; back: CVV
  const [cardErrors, setCardErrors] = useState({});
  const [orderId, setOrderId] = useState("");
  const [doneName, setDoneName] = useState("");
  const [liveNote, setLiveNote] = useState(null);
  const { selected, ready } = useAddresses();
  // all entries incl. hidden ones, so a product hidden by the admin can still be bought from a saved cart
  const { list: catalog, ready: catalogReady } = useCatalog({ includeHidden: true });
  const headRef = useRef(null);
  const prevStep = useRef("cart");

  useEffect(() => {
    if (view.n) setStep(view.step);
  }, [view]);

  // the summary and payment steps need a delivery address
  useEffect(() => {
    if (ready && !selected && (step === "summary" || step === "pay")) setStep("address");
  }, [step, ready, selected]);

  // moving between steps moves focus to the new step heading
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    if (open) headRef.current?.focus({ preventScroll: true });
  }, [step, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const resolved = Object.entries(items).map(([slug, qty]) => ({ slug, p: catalog.find((x) => x.slug === slug), qty }));
  const lines = resolved.filter((l) => l.p);
  // deleted from the catalogue: shown as unavailable and left out of totals and checkout (not flagged until the catalogue has loaded)
  const gone = catalogReady ? resolved.filter((l) => !l.p) : [];
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const close = () => {
    onClose();
    if (step === "done") setStep("cart");
  };

  const placeOrder = (e) => {
    e.preventDefault();
    if (method === "card") {
      if (cardStage === "front") {
        const err = frontErrors(card);
        setCardErrors(err);
        if (Object.keys(err).length === 0) setCardStage("back");
        else document.getElementById(`card-${Object.keys(err)[0]}`)?.focus();
        return;
      }
      const msg = cvvError(card);
      setCardErrors(msg ? { cvv: msg } : {});
      if (msg) return;
    }
    setCard(EMPTY_CARD);
    setCardStage("front");
    setCardErrors({});
    setDoneName(selected?.name || "");
    const id = `KN${Date.now().toString().slice(-8)}`;
    setOrderId(id);
    const items = lines.map(({ p, qty }) => ({ slug: p.slug, name: p.name, img: p.img, price: p.price, qty }));
    saveOrder({ id, date: new Date().toISOString(), items, total, method, address: selected });
    // also place it on the platform for live tracking; never blocks or fails the legacy checkout
    const live = mirrorToPlatform({ id, items, method, address: selected });
    setLiveNote(
      live.ok
        ? { ok: true, no: live.data.display_no, fee: live.data.delivery_fee / 100, total: live.data.total / 100 }
        : { ok: false, why: live.error?.message || "" },
    );
    clear();
    setStep("done");
  };

  const onCardBack = method === "card" && cardStage === "back";

  const body = "flex-1 space-y-4 overflow-y-auto px-4 py-4";

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
            <h2 ref={headRef} tabIndex={-1} className="text-lg font-bold outline-none">
              {TITLES[step]}
            </h2>
          </div>
          <button onClick={close} aria-label="Close cart" className="-m-2 rounded-md p-2.5 focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-6" />
          </button>
        </div>
        {step !== "done" && <StepIndicator step={step} />}

        {step === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div aria-hidden="true" className="relative flex size-24 items-center justify-center">
              <span className="success-ring absolute inset-2 rounded-full bg-green-500/25" />
              <svg viewBox="0 0 52 52" className="success-badge relative size-20">
                <circle className="success-circle" cx="26" cy="26" r="24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
                <path className="success-check" fill="none" stroke="#15803D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" />
              </svg>
              {CONFETTI.map((c, i) => (
                <span key={i} className="confetti" style={{ "--x": c.x, "--y": c.y, "--r": c.r, "--c": c.c }} />
              ))}
            </div>
            <p className="fade-up text-lg font-semibold">Thank you, {doneName || "customer"}!</p>
            <p className="fade-up d2 text-sm text-muted-foreground">
              Order <b>{orderId}</b> is confirmed
              {method === "cod" ? ". Pay in cash on delivery." : ` and will be paid via ${METHODS.find((m) => m.id === method).label}.`}
            </p>
            {liveNote && (
              <p className="fade-up d2 max-w-xs text-xs text-muted-foreground" data-testid="live-tracking-note">
                {liveNote.ok
                  ? `Live tracking is on as ${liveNote.no}. Delivery for this address adds ${inr(liveNote.fee)}, so the tracked total is ${inr(liveNote.total)}.`
                  : `Live tracking is not available for this order${liveNote.why ? `: ${liveNote.why}` : ""}`}
              </p>
            )}
            <Button onClick={close} className="mt-2 h-11 rounded-xl px-8">
              Continue Shopping
            </Button>
            <Link href="/orders" onClick={close} className="-mt-1 flex min-h-11 items-center px-4 text-sm font-semibold text-foreground underline underline-offset-4">
              View your orders
            </Link>
          </div>
        ) : step === "address" ? (
          <div data-lenis-prevent className={body}>
            <MiniSummary count={count} total={total} />
            <AddressBook mode="checkout" onDeliver={() => setStep("summary")} />
          </div>
        ) : step === "summary" && selected ? (
          <>
            <div data-lenis-prevent className={body}>
              <AddressBlock a={selected} onChange={() => setStep("address")} />
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
              <div className="mb-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>{inr(total)}</span>
              </div>
              <Button onClick={() => setStep("pay")} disabled={lines.length === 0} className="h-11 w-full rounded-xl">
                Continue to payment
              </Button>
            </div>
          </>
        ) : step === "pay" && selected ? (
          <form onSubmit={placeOrder} className="flex min-h-0 flex-1 flex-col">
            <div data-lenis-prevent className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <MiniSummary count={count} total={total} />
              {!onCardBack && <AddressBlock a={selected} onChange={() => setStep("address")} />}

              {!onCardBack && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Payment method</legend>
                {METHODS.map(({ id, label, note, Icon }) => (
                  <label
                    key={id}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                      method === id ? "border-foreground bg-accent" : "border-slate-200"
                    }`}
                  >
                    <input type="radio" name="method" className="size-4 accent-foreground" checked={method === id} onChange={() => setMethod(id)} />
                    <Icon className="size-5 text-foreground" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">{note}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              )}

              {method === "card" && (
                <CardPayment
                  card={card}
                  setCard={setCard}
                  stage={cardStage}
                  errors={cardErrors}
                  onBack={() => {
                    setCardStage("front");
                    setCardErrors({});
                  }}
                />
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="mb-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>{inr(total)}</span>
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl">
                {method === "cod" ? "Place Order" : method === "card" && cardStage === "front" ? "Next" : `Pay ${inr(total)}`}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div data-lenis-prevent className="flex-1 overflow-y-auto px-4 py-2">
              {lines.length === 0 && gone.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ShoppingCart className="size-10" />
                  <p>Your cart is empty</p>
                  <Button asChild className="mt-2 h-11 rounded-xl px-6" onClick={onClose}>
                    <Link href="/products">Browse Products</Link>
                  </Button>
                </div>
              ) : (
                lines.map(({ p, qty }) => (
                  <div key={p.slug} className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
                    <div className="size-20 shrink-0 rounded-lg bg-slate-50">
                      <img src={p.img} alt={p.name} className="size-full object-contain p-1 mix-blend-multiply" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.cat}</div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200">
                          <button className="p-3" aria-label={`Decrease quantity of ${p.name}`} onClick={() => setQty(p.slug, qty - 1)}>
                            <Minus className="size-4" aria-hidden="true" />
                          </button>
                          <span className="w-5 text-center text-sm">{qty}</span>
                          <button className="p-3" aria-label={`Increase quantity of ${p.name}`} onClick={() => setQty(p.slug, qty + 1)}>
                            <Plus className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                        <span className="font-bold whitespace-nowrap">{inr(p.price * qty)}</span>
                      </div>
                    </div>
                    <button aria-label={`Remove ${p.name} from cart`} className="-m-2.5 self-start rounded-md p-3 text-muted-foreground transition-colors hover:text-red-600" onClick={() => setQty(p.slug, 0)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
              {gone.map(({ slug, qty }) => (
                <div key={slug} className="flex gap-3 border-b border-slate-200 py-3 last:border-b-0">
                  <div className="size-20 shrink-0 rounded-lg bg-slate-50" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-muted-foreground">Unavailable item</div>
                    <div className="truncate text-xs text-muted-foreground">{slug}</div>
                    <div className="text-xs text-red-700">No longer available (Qty {qty}). It is not included in your total.</div>
                  </div>
                  <button aria-label={`Remove ${slug} from cart`} className="-m-2.5 self-start rounded-md p-3 text-muted-foreground transition-colors hover:text-red-600" onClick={() => setQty(slug, 0)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-slate-200 p-4 [@media(max-height:500px)]:flex [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-3 [@media(max-height:500px)]:p-2">
                <div className="mb-3 flex justify-between gap-3 font-semibold [@media(max-height:500px)]:mb-0">
                  <span>Subtotal</span>
                  <span>{inr(total)}</span>
                </div>
                <Button onClick={onCheckout} className="h-11 w-full rounded-xl [@media(max-height:500px)]:flex-1">
                  Proceed to Payment
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground [@media(max-height:500px)]:hidden">
                  Pay by {METHODS.map((m) => m.label).slice(0, -1).join(", ")} or {METHODS[METHODS.length - 1].label}.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
