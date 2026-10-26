// Customer-facing wording for platform codes. The platform returns codes; the shop shows plain sentences.

export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};
export const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const humanize = (s) => {
  const t = String(s || "").replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// reasons a customer may pick (staff-only reasons stay out of the list)
export const CANCEL_REASONS = [
  { value: "changed_mind", label: "I changed my mind" },
  { value: "ordered_by_mistake", label: "I ordered by mistake" },
  { value: "duplicate_order", label: "I placed this order twice" },
  { value: "address_issue", label: "The delivery address is wrong" },
  { value: "payment_issue", label: "I had a problem paying" },
  { value: "delay", label: "It is taking too long" },
  { value: "other", label: "Another reason" },
];
export const cancelReasonLabel = (code) =>
  CANCEL_REASONS.find((r) => r.value === code)?.label ||
  ({ out_of_stock: "Items were out of stock", store_cannot_fulfil: "The store could not fulfil the order", payment_timeout: "Payment was not completed in time", fraud_suspected: "Cancelled by the store" })[code] ||
  humanize(code);

export const TICKET_CATEGORIES = [
  { value: "missing_item", label: "An item is missing" },
  { value: "damaged_item", label: "An item arrived damaged" },
  { value: "wrong_item", label: "I received the wrong item" },
  { value: "late_delivery", label: "My delivery is late" },
  { value: "payment", label: "A payment problem" },
  { value: "refund", label: "A refund question" },
  { value: "cancellation", label: "Cancelling an order" },
  { value: "rider_behaviour", label: "The delivery rider" },
  { value: "other", label: "Something else" },
];
export const categoryLabel = (c) => TICKET_CATEGORIES.find((x) => x.value === c)?.label || humanize(c);

export const METHOD = { upi: "UPI", card: "Credit / Debit Card", netbanking: "Net Banking", cod: "Cash on Delivery" };

// customer-visible refund status (the platform already maps internal refund states)
export const REFUND_LABEL = { refunded: "Refunded", in_progress: "In progress", delayed: "Delayed, we are retrying", rejected: "Not approved", cancelled: "Cancelled" };

// Steps of the customer timeline, in order. `cancelled` and `pending_payment` appear only when the order went there.
export const STEP_LABEL = {
  pending_payment: "Waiting for payment",
  placed: "Order placed",
  confirmed: "Confirmed by the store",
  packed: "Packed, waiting for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const MAIN_STEPS = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"];
export const DETAIL_LABEL = { failed_delivery: "A delivery attempt did not succeed", returning: "The parcel is on its way back to the store" };

// what the customer can do next, per next_actions code from the cancellation policy
export const NEXT_ACTION_TEXT = {
  contact_support: "Contact support and we will see what can be done.",
  refuse_at_door: "If the rider is at your door, you can refuse the parcel.",
  report_problem: "If something is wrong with what arrived, report a problem.",
};

export const TERMINAL = ["delivered", "cancelled", "returned"];

export function newKey(prefix) {
  const r = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${r}`;
}
