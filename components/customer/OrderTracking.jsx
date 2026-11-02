"use client";
import { Bike, Check, KeyRound, X } from "@/components/icons";
import { DETAIL_LABEL, MAIN_STEPS, STEP_LABEL, TERMINAL, fmtDateTime } from "@/components/customer/labels";

// Builds the visible steps from the customer history ({ seq, status, at, detail? }).
export function buildSteps(order) {
  const hist = Array.isArray(order.history) ? order.history : [];
  const at = new Map();
  const details = [];
  for (const h of hist) {
    if (!at.has(h.status)) at.set(h.status, h.at);
    if (h.detail) details.push(h);
  }
  const cancelled = order.status === "cancelled";
  const ids = [];
  if (at.has("pending_payment")) ids.push("pending_payment");
  for (const s of MAIN_STEPS) if (!cancelled || at.has(s)) ids.push(s);
  if (cancelled) ids.push("cancelled");
  return ids.map((id) => ({
    id,
    label: id === "pending_payment" && at.has("placed") ? "Payment received" : STEP_LABEL[id],
    at: at.get(id) || null,
    state: id === order.status ? "current" : at.has(id) ? "done" : "upcoming",
    details: id === "out_for_delivery" ? details : [],
  }));
}

const STATE_TEXT = { done: "Completed", current: "Current step", upcoming: "Not reached yet" };

export default function OrderTracking({ order }) {
  const steps = buildSteps(order);
  const live = !TERMINAL.includes(order.internal_state);
  const rider = order.rider;
  return (
    <section aria-labelledby="track-h" className="rounded-md border border-border bg-white p-4 sm:p-5">
      <h2 id="track-h" className="text-lg font-bold">Tracking</h2>
      <p className="mt-1 text-sm" role="status" aria-live="polite">
        Status: <span className="font-semibold">{STEP_LABEL[order.status] || order.status}</span>
      </p>
      {live && order.eta_at && (
        <p className="mt-1 text-sm text-muted-foreground">
          Estimated arrival around <time dateTime={order.eta_at}>{fmtDateTime(order.eta_at)}</time>. This is an estimate, not a promise.
        </p>
      )}

      <ol className="mt-4 space-y-0">
        {steps.map((s, i) => (
          <li key={s.id} aria-current={s.state === "current" ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className={`absolute top-6 bottom-0 left-[11px] w-0.5 ${s.state === "done" ? "bg-foreground" : "bg-slate-200"}`} />}
            <span
              aria-hidden="true"
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                s.id === "cancelled" ? "border-destructive bg-destructive text-white" : s.state === "done" ? "border-foreground bg-primary text-primary-foreground" : s.state === "current" ? "border-foreground bg-white" : "border-slate-300 bg-white"
              }`}
            >
              {s.id === "cancelled" ? <X className="size-3.5" /> : s.state === "done" ? <Check className="size-3.5" /> : s.state === "current" ? <span className="size-2 rounded-full bg-foreground" /> : null}
            </span>
            <div className="min-w-0">
              <p className={`text-sm ${s.state === "upcoming" ? "text-muted-foreground" : "font-semibold"}`}>
                {s.label}
                <span className="sr-only">. {STATE_TEXT[s.state]}</span>
              </p>
              {s.at && <p className="text-xs text-muted-foreground"><time dateTime={s.at}>{fmtDateTime(s.at)}</time></p>}
              {s.details.map((d) => (
                <p key={d.seq} className="mt-1 text-xs text-muted-foreground">{DETAIL_LABEL[d.detail] || d.detail} <span>({fmtDateTime(d.at)})</span></p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {rider && (
        <div className="mt-4 flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm">
          <Bike className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
          <p>
            <span className="font-semibold">{rider.first_name}</span> is delivering your order{rider.vehicle_type ? ` by ${rider.vehicle_type}` : ""}.
            <span className="block text-muted-foreground">Phone <span className="font-mono">{rider.phone_masked}</span> (partly hidden for privacy)</span>
          </p>
        </div>
      )}

      {order.delivery_otp && (
        <div className="mt-3 flex items-start gap-3 rounded-md border border-foreground/30 bg-accent p-3 text-sm">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
          <p>
            Delivery code <span className="font-mono text-base font-bold tracking-widest">{order.delivery_otp}</span>
            <span className="block text-muted-foreground">Tell this code to the rider only when you receive your parcel.</span>
          </p>
        </div>
      )}
    </section>
  );
}
