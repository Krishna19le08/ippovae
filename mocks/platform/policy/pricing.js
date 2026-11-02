// Pricing: coupon application, discount allocation per line, delivery fee, tax and totals. All integer paise.

import { PlatformError } from "../errors.js";
import { allocate, bpOf } from "../money.js";

const invalid = (reason) => new PlatformError("VALIDATION_FAILED", "Coupon cannot be applied.", { fields: { coupon_code: reason } });

export function couponUsage(tx, coupon_id, user_id) {
  const rows = tx.list("coupon_redemptions", { where: { coupon_id } });
  const net = (list) => list.filter((r) => r.status === "applied").length - list.filter((r) => r.status === "reverted").length;
  return { total: net(rows), user: net(rows.filter((r) => r.user_id === user_id)) };
}

// lines: [{ category_id, amount }] where amount = unit_price * qty
export function applyCoupon(tx, ctx, { code, user_id, subtotal, lines }) {
  const c = tx.list("coupons", { where: { code: String(code).trim().toUpperCase() } })[0];
  if (!c || c.deleted_at || !c.is_active) throw invalid("unknown_or_inactive");
  const now = ctx.clock.now();
  if (c.starts_at && Date.parse(c.starts_at) > now) throw invalid("not_started");
  if (c.ends_at && Date.parse(c.ends_at) < now) throw invalid("expired");
  if (subtotal < c.min_order_value) throw invalid("below_minimum_order");
  const use = couponUsage(tx, c.id, user_id);
  if (c.usage_limit_total != null && use.total >= c.usage_limit_total) throw invalid("usage_limit_reached");
  if (c.usage_limit_per_user != null && use.user >= c.usage_limit_per_user) throw invalid("already_used");
  const eligible = c.applicable_category_ids ? lines.filter((l) => c.applicable_category_ids.includes(l.category_id)).reduce((s, l) => s + l.amount, 0) : subtotal;
  if (eligible <= 0 && c.type !== "free_delivery") throw invalid("no_eligible_items");
  let discount = 0;
  if (c.type === "percent") {
    discount = Math.floor((eligible * c.value) / 10000);
    if (c.max_discount != null) discount = Math.min(discount, c.max_discount);
  } else if (c.type === "flat") discount = Math.min(c.value, eligible);
  return { coupon: c, discount, free_delivery: c.type === "free_delivery" };
}

// items: [{ unit_price, qty, tax_rate_bp }]
export function computeTotals({ items, discount, area, freeDelivery }) {
  const amounts = items.map((i) => i.unit_price * i.qty);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  const shares = allocate(Math.min(discount, subtotal), amounts);
  const lineTotals = amounts.map((a, i) => a - shares[i]);
  let delivery_fee = area.delivery_fee;
  if (freeDelivery || (area.free_delivery_above != null && subtotal >= area.free_delivery_above)) delivery_fee = 0;
  const tax = items.reduce((t, it, i) => t + bpOf(lineTotals[i], it.tax_rate_bp || 0), 0);
  const disc = shares.reduce((a, b) => a + b, 0);
  return { subtotal, discount: disc, delivery_fee, tax, total: subtotal - disc + delivery_fee + tax, shares, lineTotals };
}
