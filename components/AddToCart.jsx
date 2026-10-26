"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/data";
import { useCartQty } from "@/lib/useCartQty";
import CartButton from "@/components/CartButton";

// "Buy Now": the bolt snaps and a light flash ripples out from it, then checkout opens
function BuyNow({ onBuy, className }) {
  const [firing, setFiring] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = () => {
    if (firing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onBuy();
    setFiring(true);
    timer.current = setTimeout(() => {
      setFiring(false);
      onBuy();
    }, 520);
  };
  return (
    <Button onClick={click} aria-busy={firing || undefined} className={`group relative overflow-hidden active:scale-[0.98] ${className}`}>
      {firing && (
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -mt-6 -ml-6 size-12 animate-[buy-flash_0.55s_ease-out_forwards] rounded-full bg-white/60" />
      )}
      <Zap
        aria-hidden="true"
        className={`relative ${firing ? "animate-[bolt-zap_0.52s_ease-out] fill-white" : "group-hover:animate-[bolt-zap_0.6s_ease-out]"}`}
      />
      <span className="relative">Buy Now</span>
    </Button>
  );
}

export default function AddToCart({ slug, price }) {
  const [qty, setQty] = useState(1);
  const inCart = useCartQty(slug);
  const [msg, setMsg] = useState("");
  const actions = useRef(null);
  const [stuck, setStuck] = useState(false); // the main buttons have scrolled out of view (mobile bar)
  const add = (buy) => window.dispatchEvent(new CustomEvent("kn-cart-add", { detail: { slug, qty: inCart > 0 ? 0 : qty, buy } })); // already in cart: Buy Now just checks out

  // short confirmation after this product is added (Add to Cart or Buy Now)
  useEffect(() => {
    let timer;
    const onAdd = (e) => {
      const d = e.detail;
      if ((typeof d === "string" ? d : d?.slug) !== slug || d?.qty === 0) return;
      setMsg("Added to cart");
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(""), 4000);
    };
    window.addEventListener("kn-cart-add", onAdd);
    return () => {
      window.removeEventListener("kn-cart-add", onAdd);
      clearTimeout(timer);
    };
  }, [slug]);

  useEffect(() => {
    const el = actions.current;
    if (!el || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      {inCart > 0 ? (
        // one quantity control: the in-cart stepper below
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">In your cart: {inCart}</span>
          <span className="text-muted-foreground">Total {inr(price * inCart)}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-medium">Quantity</span>
          <div className="flex items-center rounded-xl border border-slate-300">
            <button className="p-3" aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center font-semibold">{qty}</span>
            <button className="p-3" aria-label="Increase quantity" onClick={() => setQty(qty + 1)}>
              <Plus className="size-4" />
            </button>
          </div>
          <span className="text-sm whitespace-nowrap text-muted-foreground">Total {inr(price * qty)}</span>
        </div>
      )}

      <div ref={actions} className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 [&_svg:not([class*='size-'])]:size-5">
        <CartButton
          slug={slug}
          qty={qty}
          className="h-14 rounded-xl text-base"
          btnClass="border-2 border-foreground bg-white bg-none text-foreground shadow-none hover:bg-primary hover:text-primary-foreground"
        />
        <BuyNow onBuy={() => add(true)} className="h-14 rounded-xl text-base shadow-[0_8px_18px_-8px_rgb(11_11_11/0.25)]" />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {msg && (
          <>
            <Check className="mr-1 inline size-4 align-[-3px]" aria-hidden="true" />
            {msg}
          </>
        )}
      </p>

      {/* mobile: price and actions stay in reach once the main buttons scroll away */}
      <div
        inert={!stuck}
        className={`fixed inset-x-0 bottom-[calc(3.5625rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(11,11,11,.25)] backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${
          stuck ? "translate-y-0" : "translate-y-[200%]"
        }`}
      >
        <div className="min-w-0 shrink-0">
          <div className="text-[11px] leading-none text-muted-foreground">{inCart > 0 ? `In cart: ${inCart}` : "Price"}</div>
          <div className="tnum mt-1 text-lg leading-none font-extrabold text-foreground">{inr(price)}</div>
        </div>
        <CartButton
          slug={slug}
          qty={qty}
          className="h-11 min-w-0 flex-1 rounded-xl"
          btnClass="border-2 border-foreground bg-white bg-none text-foreground shadow-none"
        />
        <BuyNow onBuy={() => add(true)} className="h-11 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
