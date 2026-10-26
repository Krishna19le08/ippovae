"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Ban, Clock, Info } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/platform/ErrorNotice";
import { CANCEL_REASONS, NEXT_ACTION_TEXT, cancelReasonLabel, fmtDateTime, newKey } from "@/components/customer/labels";
import { useDialogFocus } from "@/lib/useDialogFocus";

const ticketHref = (orderId, category) => `/help/tickets?new=1&order=${encodeURIComponent(orderId)}&category=${category}`;

function CancelDialog({ order, mode, open, onClose, onDone, p, actor }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const key = useRef("");
  const ref = useDialogFocus(open);
  const tid = useId();
  const request = mode === "request";

  useEffect(() => {
    if (open) { setReason(""); setError(null); setBusy(false); key.current = newKey("cancel"); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  const submit = (e) => {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const r = p.orders.cancel(actor, { order_id: order.id, reason, expected_version: order.version, idempotency_key: key.current });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onDone(r.data);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form ref={ref} role="dialog" aria-modal="true" aria-labelledby={tid} tabIndex={-1} onSubmit={submit}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl outline-none sm:rounded-xl">
        <h2 id={tid} className="text-lg font-bold">{request ? "Request cancellation" : "Cancel this order?"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {request
            ? "The store has already started on your order, so it needs to approve the cancellation. We will tell you what it decides."
            : "The order will be cancelled. If you already paid, a refund to your original payment method is started automatically."}
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Why are you cancelling?</legend>
          <div className="mt-2 space-y-1">
            {CANCEL_REASONS.map((r) => (
              <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-sm has-[:checked]:border-foreground has-[:checked]:bg-accent">
                <input type="radio" name="cancel-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-4 accent-[var(--color-primary)]" />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <ErrorNotice error={error} className="mt-3" />}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>Keep my order</Button>
          <Button type="submit" variant="destructive" className="min-h-11" disabled={!reason || busy}>
            {busy ? "Working..." : request ? "Send request" : "Cancel order"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Explains whether the order can be cancelled, and runs the cancel / request flow. */
export default function CancelOrder({ order, p, actor }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const btnRef = useRef(null);
  const roles = actor.roles.map((r) => r.role);
  const el = p.cancelEligibility(order, roles, order.user_id === actor.userId);
  const id = order.id;

  if (outcome) {
    return (
      <Alert variant="info" role="status">
        <Info aria-hidden="true" />
        <AlertTitle>{outcome.mode === "request" ? "Cancellation requested" : outcome.already_cancelled ? "This order was already cancelled" : "Order cancelled"}</AlertTitle>
        <AlertDescription>
          {outcome.mode === "request"
            ? "The store will review your request. This page updates when it decides."
            : "If you had paid, your refund appears under Payments and refunds below."}
        </AlertDescription>
      </Alert>
    );
  }

  // already cancelled / returned: the summary lives in the header, nothing to do
  if (el.mode === "noop") {
    return (
      <section aria-labelledby="cancel-h" className="rounded-md border border-border bg-white p-4 sm:p-5">
        <h2 id="cancel-h" className="text-lg font-bold">Cancellation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This order was cancelled{order.cancelled_at ? ` on ${fmtDateTime(order.cancelled_at)}` : ""}
          {order.cancel_reason ? `. Reason: ${cancelReasonLabel(order.cancel_reason)}` : ""}.
        </p>
      </section>
    );
  }

  let body;
  if (order.cancel_request_status === "requested") {
    body = (
      <p className="flex items-start gap-2 text-sm"><Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        You asked to cancel{order.cancel_requested_at ? ` on ${fmtDateTime(order.cancel_requested_at)}` : ""}. The store is reviewing your request. You do not need to do anything.</p>
    );
  } else if (order.cancel_request_status === "denied") {
    body = (
      <>
        <p className="text-sm">The store could not cancel this order{order.cancel_deny_reason ? `: ${order.cancel_deny_reason}` : "."}</p>
        <p className="mt-1 text-sm text-muted-foreground">Next step: if you still need help, <Link href={ticketHref(id, "cancellation")} className="font-semibold text-foreground underline underline-offset-4">contact support</Link>.</p>
      </>
    );
  } else if (el.allowed) {
    const request = el.mode === "request";
    body = (
      <>
        <p className="text-sm text-muted-foreground">
          {request
            ? "The store has started preparing your order. You can ask to cancel, and the store decides."
            : "You can cancel this order now, before the store starts preparing it."}
        </p>
        <Button ref={btnRef} type="button" variant={request ? "outline" : "destructive"} className="mt-3 min-h-11" onClick={() => setOpen(true)}>
          <Ban aria-hidden="true" /> {request ? "Request cancellation" : "Cancel order"}
        </Button>
        <CancelDialog order={order} mode={el.mode} open={open} p={p} actor={actor} onClose={() => setOpen(false)} onDone={(d) => { setOpen(false); setOutcome(d); }} />
      </>
    );
  } else {
    const why =
      el.reason === "delivered" ? "This order has been delivered, so it can no longer be cancelled."
      : ["picked_up", "delivery_attempted"].includes(order.internal_state) ? "Your order is already out for delivery, so it can no longer be cancelled here."
      : el.reason === "past_cutoff" ? "Your order is packed and handed to dispatch, so it can no longer be cancelled here."
      : "This order cannot be cancelled in its current state.";
    const actions = el.next_actions || [];
    body = (
      <>
        <p className="text-sm">{why}</p>
        {actions.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {actions.map((a) => <li key={a}>{NEXT_ACTION_TEXT[a] || a}</li>)}
          </ul>
        )}
        <div className="mt-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={ticketHref(id, actions.includes("report_problem") ? "other" : "cancellation")}>
              {actions.includes("report_problem") ? "Report a problem" : "Contact support"}
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby="cancel-h" className="rounded-md border border-border bg-white p-4 sm:p-5">
      <h2 id="cancel-h" className="text-lg font-bold">Cancellation</h2>
      <div className="mt-2">{body}</div>
    </section>
  );
}
