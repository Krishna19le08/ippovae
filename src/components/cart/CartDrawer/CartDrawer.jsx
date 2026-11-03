"use client";
import { useEffect } from "react";
import { X } from "@/components/ui/icons";
import { useCatalog } from "@/components/catalog/catalogStore";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import CartStep from "./CartStep";

// Slide-in cart. Checkout continues on full pages: /checkout/address, /checkout/summary, /checkout/payment.
export default function CartDrawer({ open, onClose, items, setQty, onCheckout, returnRef }) {
  const dialogRef = useDialogFocus(open, returnRef);
  // all entries incl. hidden ones, so a product hidden by the admin can still be bought from a saved cart
  const { list: catalog, ready: catalogReady } = useCatalog({ includeHidden: true });

  // Cart entries matched to catalogue products. Ones deleted from the catalogue are shown as unavailable and left
  // out of totals and checkout (not flagged until the catalogue has loaded).
  const entries = Object.entries(items).map(([slug, qty]) => ({ slug, qty, p: catalog.find((x) => x.slug === slug) }));
  const lines = entries.filter((l) => l.p);
  const unavailable = catalogReady ? entries.filter((l) => !l.p) : [];
  const total = lines.reduce((sum, l) => sum + l.p.price * l.qty, 0);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const close = onClose;

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
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={close} aria-label="Close cart" className="-m-2 rounded-md p-2.5 focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-6" />
          </button>
        </div>

        <CartStep lines={lines} unavailable={unavailable} total={total} setQty={setQty} onClose={onClose} onCheckout={onCheckout} />
      </div>
    </div>
  );
}
