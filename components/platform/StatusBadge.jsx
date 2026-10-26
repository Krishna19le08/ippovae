import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-foreground/20 bg-accent text-foreground",
  progress: "border-amber-200 bg-amber-50 text-amber-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

const MAPS = {
  order: {
    pending_payment: ["progress", "Awaiting payment"], placed: ["info", "Placed"], confirmed: ["info", "Confirmed"], packed: ["info", "Packed"],
    out_for_delivery: ["progress", "Out for delivery"], delivered: ["success", "Delivered"], cancelled: ["danger", "Cancelled"],
  },
  internal: {
    pending_payment: ["progress"], stock_reserved: ["info"], confirmed: ["info"], picking: ["progress"], picked: ["progress"], packing: ["progress"],
    packed: ["info"], ready_for_pickup: ["info"], rider_assigned: ["info"], rider_accepted: ["info"], picked_up: ["progress"],
    delivery_attempted: ["progress"], delivered: ["success"], failed_delivery: ["danger"], returning: ["danger"], returned: ["neutral"], cancelled: ["danger"],
  },
  payment: {
    created: ["neutral"], pending: ["progress"], captured: ["success"], failed: ["danger"], expired: ["neutral"], cod_due: ["progress", "COD due"],
    cod_collected: ["success", "COD collected"], partially_refunded: ["info"], refunded: ["neutral"], voided: ["neutral"],
  },
  refund: { requested: ["progress"], approved: ["info"], rejected: ["danger"], processing: ["progress"], succeeded: ["success"], failed: ["danger"], cancelled: ["neutral"] },
  ticket: {
    OPEN: ["info", "Open"], IN_PROGRESS: ["progress", "In progress"], WAITING_FOR_CUSTOMER: ["progress", "Waiting for customer"],
    ESCALATED: ["danger", "Escalated"], RESOLVED: ["success", "Resolved"], CLOSED: ["neutral", "Closed"],
  },
  assignment: {
    offered: ["progress"], accepted: ["info"], rejected: ["neutral"], expired: ["neutral"], dropped: ["danger"], picked_up: ["progress"],
    delivered: ["success"], failed: ["danger"], returning: ["danger"], returned: ["neutral"], cancelled: ["neutral"],
  },
};

const humanize = (s) => { const t = String(s || "").replace(/_/g, " ").toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

/**
 * kind: "order" (customer status) | "internal" (order internal_state) | "payment" | "refund" | "ticket" | "assignment".
 * Unknown values fall back to a neutral humanized badge. The text always carries the state (colour is not the only cue).
 */
export default function StatusBadge({ kind = "order", value, className }) {
  if (!value) return null;
  const [tone, label] = MAPS[kind]?.[value] || ["neutral"];
  return (
    <Badge variant="outline" className={cn("normal-case tracking-normal", TONES[tone], className)}>
      {label || humanize(value)}
    </Badge>
  );
}
