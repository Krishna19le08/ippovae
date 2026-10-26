"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingCart } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useCartQty } from "@/lib/useCartQty";
import { flyToCart } from "@/lib/flyToCart";

const fire = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// "Add to Cart" until the product is in the cart, then a − qty + stepper.
export default function CartButton({ slug, name = "", qty = 1, className = "", btnClass = "" }) {
  const inCart = useCartQty(slug);
  const [adding, setAdding] = useState(false);
  const timer = useRef(0);
  const iconRef = useRef(null);
  const textRef = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // the star flies for 800ms; the item lands in the cart (and the button becomes the stepper) as it arrives
  const add = (e) => {
    if (adding) return;
    flyToCart(e.currentTarget); // measure before the button swaps to the stepper
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return fire("kn-cart-add", { slug, qty });
    // the label slides into the icon, then the icon travels to the button's centre
    const btn = e.currentTarget.getBoundingClientRect();
    const ic = iconRef.current?.getBoundingClientRect();
    const tx = textRef.current?.getBoundingClientRect();
    if (ic && tx) {
      iconRef.current.style.setProperty("--dx", `${btn.left + btn.width / 2 - (ic.left + ic.width / 2)}px`);
      textRef.current.style.setProperty("--tx", `${ic.left + ic.width / 2 - (tx.left + tx.width / 2)}px`);
    }
    setAdding(true);
    timer.current = setTimeout(() => {
      setAdding(false);
      fire("kn-cart-add", { slug, qty });
    }, 780);
  };

  if (inCart > 0) {
    return (
      <div className={`anim-fade-zoom-in motion-reduce:animate-none flex items-center justify-between rounded-xl border border-foreground bg-accent text-foreground duration-300 ${className}`}>
        <button className="h-full px-4" aria-label={`Decrease quantity${name ? ` of ${name}` : ""}`} onClick={() => fire("kn-cart-set", { slug, qty: inCart - 1 })}>
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span key={inCart} className="anim-pop-in motion-reduce:animate-none font-semibold duration-200">{inCart}</span>
        <button className="h-full px-4" aria-label={`Increase quantity${name ? ` of ${name}` : ""}`} onClick={() => fire("kn-cart-set", { slug, qty: inCart + 1 })}>
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <Button onClick={add} aria-busy={adding || undefined} className={`overflow-hidden transition-[background-color,color,box-shadow,transform] duration-500 ease-out motion-reduce:transition-none active:scale-[0.98] ${
        adding ? "bg-accent text-foreground ring-1 ring-foreground ring-inset hover:bg-accent" : ""
      } ${className} ${btnClass}`}>
      <ShoppingCart ref={iconRef} className={adding ? "animate-[cart-roll_0.78s_linear_forwards]" : ""} aria-hidden="true" />{" "}
      <span ref={textRef} className={adding ? "animate-[text-merge_0.3s_ease-in_forwards]" : ""}>
        Add to Cart
      </span>
    </Button>
  );
}
