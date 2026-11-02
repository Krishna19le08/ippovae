import { AlertCircle, Inbox } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TEXT = {
  VALIDATION_FAILED: "Some details need fixing.",
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "Your role is not allowed to do this.",
  FORBIDDEN_LIMIT: "This is above your approval limit. Ask a supervisor.",
  NOT_FOUND: "We could not find that record.",
  CONFLICT: "This conflicts with the current data. Refresh and try again.",
  VERSION_CONFLICT: "Someone else changed this just now. Refresh and try again.",
  INVALID_TRANSITION: "That step is not available in the current state.",
  ORDER_CANCELLED: "This order has been cancelled.",
  PAST_CANCELLATION_CUTOFF: "It is too late to cancel this order directly. You can request cancellation instead.",
  INSUFFICIENT_STOCK: "Some items do not have enough stock.",
  PRICE_CHANGED: "Prices changed. Review the new total.",
  RESERVATION_EXPIRED: "The stock reservation expired. Place the order again.",
  PAYMENT_FAILED: "The payment did not go through.",
  REFUND_EXCEEDS_CAPTURED: "That refund is more than what was paid.",
  IDEMPOTENCY_CONFLICT: "This request was already used with different details.",
  IDEMPOTENCY_IN_PROGRESS: "This request is still being processed.",
  OFFER_EXPIRED: "That offer has expired.",
  UPSTREAM_UNAVAILABLE: "A connected service is unavailable. Try again shortly.",
  STORAGE_FULL: "Browser storage is full. Clear some demo data and retry.",
  DATA_CORRUPT: "Stored demo data looks damaged. An admin can reset it.",
  APPEND_ONLY: "This record cannot be changed.",
  INTERNAL: "Something went wrong.",
};

/** Readable message for a platform error ({code,message,details}); falls back to the platform message. */
export function errorMessage(error) {
  if (!error) return "";
  const base = TEXT[error.code] || error.message || "Something went wrong.";
  const f = error.details?.fields;
  if (error.code === "VALIDATION_FAILED" && f && typeof f === "object") {
    const parts = Object.entries(f).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (parts.length) return `${base} ${parts.join("; ")}.`;
  }
  if (error.code === "INVALID_TRANSITION" && Array.isArray(error.details?.allowed_events) && error.details.allowed_events.length)
    return `${base} Available: ${error.details.allowed_events.map((e) => e.replace(/_/g, " ")).join(", ")}.`;
  if (error.code === "FORBIDDEN" && error.message && error.message !== "Forbidden") return `${TEXT.FORBIDDEN} ${error.message}`;
  return base;
}

/** Inline error alert. Pass `onRetry` to show a retry button. */
export function ErrorNotice({ error, onRetry, className }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" role="alert" className={className}>
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{error.code === "VERSION_CONFLICT" ? "Out of date" : "Could not complete that"}</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {onRetry && <Button type="button" variant="outline" size="sm" className="mt-2 min-h-9" onClick={onRetry}>Try again</Button>}
      </AlertDescription>
    </Alert>
  );
}

export function LoadingState({ label = "Loading", rows = 3 }) {
  return (
    <div aria-busy="true" className="space-y-2">
      <span className="sr-only" role="status">{label}</span>
      <div aria-hidden="true" className="space-y-2">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 bg-slate-100" />)}</div>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", children, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-border px-4 py-10 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Renders loading, error, empty or children for a usePlatformQuery result. children may be a function of data. */
export default function QueryState({ query, isEmpty, empty, children, loadingLabel }) {
  if (query.loading) return <LoadingState label={loadingLabel} />;
  if (query.error) return <ErrorNotice error={query.error} onRetry={query.refetch} />;
  const none = isEmpty ? isEmpty(query.data) : query.data == null || (Array.isArray(query.data) && !query.data.length);
  if (none) return empty ?? <EmptyState />;
  return typeof children === "function" ? children(query.data) : children;
}
