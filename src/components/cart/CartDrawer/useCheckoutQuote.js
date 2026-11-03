import { useEffect, useState } from "react";
import { inr } from "@/data";

// Prices the basket (items, delivery, tax) once there is an address, so every figure is shown before Pay.
// `lines` are { slug, qty, p }; the result is { status: "idle" | "loading" | "ok" | "error", ...paise amounts }.
export function useCheckoutQuote({ enabled, address, lines }) {
  const [quote, setQuote] = useState({ status: "idle" });
  const basketKey = lines.map((l) => `${l.slug}:${l.qty}`).join(",");

  useEffect(() => {
    if (!enabled || !address || !basketKey) return;
    let current = true;
    setQuote({ status: "loading" });

    // loaded on demand so the simulated platform stays out of the initial bundle
    import("@/components/checkout/api").then(({ quoteCheckout }) => {
      if (!current) return;
      const result = quoteCheckout({ items: lines.map((l) => ({ slug: l.slug, qty: l.qty })), address });
      if (!result.ok) {
        setQuote({ status: "error", message: result.error?.message || "We could not price this order." });
      } else if (!result.data.meets_minimum) {
        setQuote({ status: "error", message: `The minimum order for this address is ${inr(result.data.min_order_value / 100)}.` });
      } else {
        setQuote({ status: "ok", ...result.data });
      }
    });
    return () => {
      current = false;
    };
    // `lines` is covered by basketKey; the address by its id and pincode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, address?.id, address?.pincode, basketKey]);

  return quote;
}
