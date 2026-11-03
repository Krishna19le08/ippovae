import { Banknote, CreditCard, Landmark, Smartphone } from "@/components/ui/icons";

export const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", note: "GPay, PhonePe, Paytm", Icon: Smartphone },
  { id: "card", label: "Credit / Debit Card", note: "Visa, Mastercard, RuPay", Icon: CreditCard },
  { id: "netbanking", label: "Net Banking", note: "All major banks", Icon: Landmark },
  { id: "cod", label: "Cash on Delivery", note: "Pay when it arrives", Icon: Banknote },
];

export const methodLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id).label;
