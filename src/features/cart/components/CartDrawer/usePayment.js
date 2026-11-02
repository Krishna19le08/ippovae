import { useRef, useState } from "react";
import { EMPTY_CARD, cvvError, frontErrors } from "@/features/checkout/components/CardPayment";

// Card form state and order placement for the payment step.
// `onPlaced({ no, total, fee })` is called with the new order's number and amounts in rupees.
export function usePayment({ lines, address, quote, method, onPlaced }) {
  const [card, setCard] = useState(EMPTY_CARD);
  const [cardStage, setCardStage] = useState("front"); // front: number/name/expiry; back: CVV
  const [cardErrors, setCardErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const placing = useRef(false);
  const orderKey = useRef(null);

  // Card payments take two steps: validate the front, then the CVV. Returns true when the order may be placed.
  const cardIsReady = () => {
    if (cardStage === "front") {
      const errors = frontErrors(card);
      setCardErrors(errors);
      if (Object.keys(errors).length === 0) setCardStage("back");
      else document.getElementById(`card-${Object.keys(errors)[0]}`)?.focus();
      return false;
    }
    const message = cvvError(card);
    setCardErrors(message ? { cvv: message } : {});
    return !message;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (placing.current) return;
    if (method === "card" && !cardIsReady()) return;
    if (quote.status !== "ok") return;

    placing.current = true;
    setBusy(true);
    setError("");
    orderKey.current ||= `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; // a retry of the same attempt cannot place twice

    let result;
    try {
      const { placeCheckout } = await import("@/features/checkout/api");
      result = placeCheckout({
        items: lines.map((l) => ({ slug: l.slug, qty: l.qty })),
        method,
        address,
        key: orderKey.current,
      });
    } catch (err) {
      result = { ok: false, error: { message: String(err?.message || err) } };
    }
    placing.current = false;
    setBusy(false);

    if (!result.ok) {
      setError(result.error?.message || "We could not place your order. Please try again.");
      return;
    }
    orderKey.current = null;
    setCard(EMPTY_CARD);
    setCardStage("front");
    setCardErrors({});
    onPlaced({ no: result.data.display_no, total: result.data.total / 100, fee: result.data.delivery_fee / 100 });
  };

  return {
    card,
    setCard,
    cardStage,
    cardErrors,
    busy,
    error,
    submit,
    onCardBack: method === "card" && cardStage === "back",
    backToCardFront: () => {
      setCardStage("front");
      setCardErrors({});
    },
  };
}
