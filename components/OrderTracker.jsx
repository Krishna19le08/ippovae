"use client";
import { Check, X } from "@/components/icons";
import { CANCELLED, STATUSES, historyOf, statusLabel, statusOf } from "@/lib/orders";

const stamp = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

// Tracking timeline for one order. The status is set by the shop (there is no server to move it along), and each reached
// step shows when it was set. Vertical on phones, horizontal from md up. State is never colour alone: icons and text say it too.
export default function OrderTracker({ order }) {
  const status = statusOf(order);
  const history = historyOf(order);
  const cancelled = status === CANCELLED.id;
  // for a cancelled order, the steps it got through before being cancelled stay marked
  const lastGood = [...history].reverse().find((h) => h.status !== CANCELLED.id)?.status || "placed";
  const cur = Math.max(0, STATUSES.findIndex((s) => s.id === (cancelled ? lastGood : status)));
  const at = (id) => [...history].reverse().find((h) => h.status === id)?.at;
  const updated = at(status);

  return (
    <section aria-label={`Tracking for order ${order.id}`} className="border-b border-border px-4 py-4">
      <p className="text-sm">
        <span className="text-muted-foreground">Status: </span>
        <span className={`font-semibold ${cancelled ? "text-red-700" : "text-foreground"}`}>{statusLabel(status)}</span>
        {updated && <span className="text-xs text-muted-foreground"> · updated {stamp(updated)}</span>}
      </p>

      <ol className="mt-4 grid md:grid-cols-5">
        {STATUSES.map((s, i) => {
          const reached = i <= cur;
          const current = i === cur && !cancelled;
          const when = reached ? at(s.id) : "";
          return (
            <li
              key={s.id}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3 pb-5 last:pb-0 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center"
            >
              {/* connector to the next step: down on phones, across from md */}
              {i < STATUSES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-6 bottom-0 left-3 w-0.5 -translate-x-1/2 md:top-3 md:right-auto md:bottom-auto md:left-1/2 md:h-0.5 md:w-full md:translate-x-0 ${
                    i < cur ? "bg-foreground" : "bg-slate-300"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  current
                    ? "border-foreground bg-primary text-primary-foreground ring-4 ring-foreground/20"
                    : reached
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "border-slate-300 bg-white"
                }`}
              >
                {reached && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 text-sm">
                <span className={`block ${current ? "font-semibold text-foreground" : reached ? "font-medium" : "text-muted-foreground"}`}>
                  {s.label}
                  <span className="sr-only">{current ? " (current step)" : reached ? " (completed)" : " (not yet)"}</span>
                </span>
                {when && <span className="tnum block text-xs text-muted-foreground">{stamp(when)}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {cancelled && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <X className="size-4 shrink-0" aria-hidden="true" /> This order was cancelled{updated ? ` on ${stamp(updated)}` : ""}.
        </p>
      )}
      {status === "placed" && <p className="mt-3 text-xs text-muted-foreground">ippovae updates this as your order moves along.</p>}
    </section>
  );
}
