import { inr } from "@/features/catalog/data";

// One-line "3 items · Items ₹1,200" reminder shown above the address and payment steps.
export default function MiniSummary({ count, total }) {
  return (
    <p className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span>
      <span className="font-semibold">Items {inr(total)}</span>
    </p>
  );
}
