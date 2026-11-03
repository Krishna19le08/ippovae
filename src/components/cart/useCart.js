import { useEffect, useRef, useState } from "react";

const CART_KEY = "kn-cart-items";
const countItems = (items) => Object.values(items).reduce((sum, qty) => sum + qty, 0);

// The cart: { slug: qty }. Saved in localStorage, and kept in sync with the rest of the page through window events:
//   "kn-cart-add"     { slug, qty, buy? } (or just a slug string) adds items; `buy` also starts checkout
//   "kn-cart-set"     { slug, qty }       sets a quantity (0 removes the item)
//   "kn-cart-changed" { items }           is fired after every change so product cards can show what's in the cart
export function useCart({ onBuyNow }) {
  const [items, setItems] = useState({});
  // true only after the stored cart has been read and applied in the same step (state, not a ref, so StrictMode's
  // double effect run cannot make the persist effect write the empty initial cart)
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState(""); // for the screen-reader live region
  const announcedCount = useRef(0);
  const onBuyNowRef = useRef(onBuyNow);
  const count = countItems(items);

  useEffect(() => {
    onBuyNowRef.current = onBuyNow;
  });

  const setQty = (slug, qty) =>
    setItems((prev) => {
      const next = { ...prev };
      if (qty > 0) next[slug] = qty;
      else delete next[slug];
      return next;
    });

  // Load the stored cart and start listening for cart events.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CART_KEY)) || {};
      announcedCount.current = countItems(stored); // the initial load is not announced
      setItems(stored);
    } catch {}
    setHydrated(true); // batched with setItems(stored) above

    const onAdd = (e) => {
      const { slug, qty, buy } = typeof e.detail === "string" ? { slug: e.detail, qty: 1 } : e.detail;
      setItems((prev) => ({ ...prev, [slug]: (prev[slug] || 0) + qty }));
      if (buy) onBuyNowRef.current?.();
    };
    const onSet = (e) => setQty(e.detail.slug, e.detail.qty);
    window.addEventListener("kn-cart-add", onAdd);
    window.addEventListener("kn-cart-set", onSet);
    return () => {
      window.removeEventListener("kn-cart-add", onAdd);
      window.removeEventListener("kn-cart-set", onSet);
    };
  }, []);

  // Persist the cart and tell product cards what's in it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
    window.dispatchEvent(new CustomEvent("kn-cart-changed", { detail: items }));
  }, [items, hydrated]);

  // Tell screen readers when the cart changes.
  useEffect(() => {
    if (!hydrated || announcedCount.current === count) return;
    const added = count > announcedCount.current;
    announcedCount.current = count;
    setAnnouncement(`${added ? "Added to cart" : "Cart updated"}. ${count} ${count === 1 ? "item" : "items"} in cart`);
  }, [count, hydrated]);

  return { items, count, announcement, setQty, clear: () => setItems({}) };
}
