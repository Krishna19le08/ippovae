"use client";
import { useEffect, useState } from "react";

// How many of this product are in the cart (kept in sync with the header's cart).
export function useCartQty(slug) {
  const [qty, setQty] = useState(0);
  useEffect(() => {
    try {
      setQty(JSON.parse(localStorage.getItem("kn-cart-items"))?.[slug] || 0);
    } catch {}
    const sync = (e) => setQty(e.detail?.[slug] || 0);
    window.addEventListener("kn-cart-changed", sync);
    return () => window.removeEventListener("kn-cart-changed", sync);
  }, [slug]);
  return qty;
}
