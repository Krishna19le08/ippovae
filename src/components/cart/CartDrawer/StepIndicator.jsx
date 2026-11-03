import { Check } from "@/components/ui/icons";

export const STEPS = [
  ["cart", "Cart"],
  ["address", "Address"],
  ["summary", "Summary"],
  ["pay", "Payment"],
];

// "Cart > Address > Summary > Payment" progress bar at the top of the drawer.
export default function StepIndicator({ step }) {
  const current = STEPS.findIndex(([id]) => id === step);
  return (
    <ol aria-label="Checkout progress" className="grid grid-cols-4 border-b border-slate-200 px-2 py-3 text-xs min-[400px]:px-4 [@media(max-height:500px)]:py-1.5">
      {STEPS.map(([id, label], i) => {
        const isCurrent = i === current;
        const isDone = i < current;
        return (
          <li
            key={id}
            aria-current={isCurrent ? "step" : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-1.5 text-center ${isCurrent ? "font-bold text-foreground" : isDone ? "text-foreground" : "text-muted-foreground"}`}
          >
            {/* edge: runs from this node's centre to the next node's centre, behind the nodes */}
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className={`absolute top-3 left-1/2 h-0.5 w-full ${isDone ? "bg-foreground" : "bg-slate-300"}`} />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                isCurrent
                  ? "border-foreground bg-foreground text-white ring-4 ring-foreground/20"
                  : isDone
                    ? "border-foreground bg-foreground text-white"
                    : "border-slate-300 bg-white text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="max-w-full break-words">
              {label}
              {isDone && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
