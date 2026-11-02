import Link from "next/link";
import { Button } from "@/components/ui/button";
import { inr } from "@/data";
import { methodLabel } from "./paymentMethods";

// small confetti burst around the check mark (brand colours); decorative, hidden from assistive tech
const CONFETTI = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + 0.3;
  const distance = 52 + (i % 3) * 14;
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance)}px`,
    rotate: `${(i % 2 ? 1 : -1) * (120 + i * 25)}deg`,
    color: ["#E8FF00", "#0B0B0B", "#16a34a", "#9CA3AF"][i % 4],
  };
});

// Confirmation after the order is placed. `placed` is { name, no, total, fee } (amounts in rupees).
export default function DoneStep({ placed, method, onClose }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div aria-hidden="true" className="relative flex size-24 items-center justify-center">
        <span className="success-ring absolute inset-2 rounded-full bg-green-500/25" />
        <svg viewBox="0 0 52 52" className="success-badge relative size-20">
          <circle className="success-circle" cx="26" cy="26" r="24" fill="none" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
          <path className="success-check" fill="none" stroke="#15803D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-17" />
        </svg>
        {CONFETTI.map((c, i) => (
          <span key={i} className="confetti" style={{ "--x": c.x, "--y": c.y, "--r": c.rotate, "--c": c.color }} />
        ))}
      </div>
      <p className="fade-up text-lg font-semibold">Thank you, {placed?.name || "customer"}!</p>
      <p className="fade-up d2 text-sm text-muted-foreground">
        Order <b>{placed?.no}</b> is confirmed
        {method === "cod" ? ". Pay in cash on delivery." : ` and will be paid via ${methodLabel(method)}.`}
      </p>
      {placed && (
        <p className="fade-up d2 max-w-xs text-xs text-muted-foreground">
          Total {inr(placed.total)}
          {placed.fee > 0 ? `, including ${inr(placed.fee)} delivery` : ", free delivery"}. You can track it under Your orders.
        </p>
      )}
      <Button onClick={onClose} className="mt-2 h-11 rounded-xl px-8">
        Continue Shopping
      </Button>
      <Link href="/orders" onClick={onClose} className="-mt-1 flex min-h-11 items-center px-4 text-sm font-semibold text-foreground underline underline-offset-4">
        View your orders
      </Link>
    </div>
  );
}
