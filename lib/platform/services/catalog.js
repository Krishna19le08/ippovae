// Read-side catalogue helpers for the UI: products, service-area check, coupon check, checkout quote. No stock counts
// are exposed to customers, only an in-stock flag.

import { PlatformError } from "../errors.js";
import { applyCoupon, computeTotals } from "../policy/pricing.js";

export function install(ctx, exec) {
  const area = (tx, pincode) => {
    for (const s of tx.list("service_areas", { where: { pincode: String(pincode), is_active: true }, orderBy: "-priority" })) {
      const st = tx.get("stores", s.store_id);
      if (st && !st.deleted_at && st.is_active && st.accepts_orders) return { area: s, store: st };
    }
    return null;
  };
  return {
    categories: () => ctx.repo.read((tx) => tx.list("categories", { where: { is_active: true }, orderBy: "sort_order" }).filter((c) => !c.deleted_at)),
    listProducts({ category_id, q, store_id } = {}) {
      return ctx.repo.read((tx) => {
        let rows = tx.list("products", { where: { is_active: true, ...(category_id ? { category_id } : {}) } }).filter((p) => !p.deleted_at);
        if (q) { const n = String(q).toLowerCase(); rows = rows.filter((p) => p.name.toLowerCase().includes(n) || p.sku.toLowerCase().includes(n)); }
        if (!store_id) return rows;
        return rows.map((p) => { const inv = tx.get("inventory", `${store_id}:${p.id}`); return { ...p, in_stock: !!inv && inv.physical - inv.reserved > 0 }; });
      });
    },
    getProduct: (slug) => ctx.repo.read((tx) => tx.list("products", { where: { slug } }).filter((p) => !p.deleted_at)[0] || null),
    // { serviceable, store_id, delivery_fee, free_delivery_above, min_order_value, eta_minutes } (eta is an estimate)
    checkServiceArea(pincode) {
      return ctx.repo.read((tx) => {
        const hit = area(tx, pincode);
        if (!hit) return { serviceable: false };
        const { area: a, store } = hit;
        return { serviceable: true, store_id: store.id, delivery_fee: a.delivery_fee, free_delivery_above: a.free_delivery_above, min_order_value: a.min_order_value, eta_minutes: a.eta_minutes };
      });
    },
    // Prices a cart exactly as placeOrder would, without writing anything.
    quote(actor, { items, pincode, coupon_code }) {
      return exec(actor, { action: "order.quote" }, (tx, a) => {
        const hit = area(tx, pincode);
        if (!hit) throw new PlatformError("VALIDATION_FAILED", "We do not deliver to this pincode yet.", { code: "NOT_SERVICEABLE", fields: { pincode: "not serviceable" } });
        const merged = new Map();
        for (const r of items || []) {
          const prod = r.product_id ? tx.get("products", r.product_id) : tx.list("products", { where: { slug: r.slug } })[0];
          if (!prod || prod.deleted_at || !prod.is_active) throw new PlatformError("VALIDATION_FAILED", "Unknown product.", { fields: { items: String(r.slug || r.product_id) } });
          if (!Number.isInteger(r.qty) || r.qty <= 0) throw new PlatformError("VALIDATION_FAILED", "qty must be a positive integer.", { fields: { items: "qty" } });
          const cur = merged.get(prod.id) || { prod, qty: 0 };
          cur.qty += r.qty; merged.set(prod.id, cur);
        }
        const lines = [...merged.values()];
        const catLines = lines.map((l) => ({ category_id: l.prod.category_id, amount: l.prod.price * l.qty }));
        const sub = catLines.reduce((s, l) => s + l.amount, 0);
        const cp = coupon_code ? applyCoupon(tx, ctx, { code: coupon_code, user_id: a.userId, subtotal: sub, lines: catLines }) : null;
        const totals = computeTotals({ items: lines.map((l) => ({ unit_price: l.prod.price, qty: l.qty, tax_rate_bp: l.prod.tax_rate_bp })), discount: cp ? cp.discount : 0, area: hit.area, freeDelivery: cp ? cp.free_delivery : false });
        const available = lines.map((l) => { const inv = tx.get("inventory", `${hit.store.id}:${l.prod.id}`); return { slug: l.prod.slug, qty: l.qty, in_stock: !!inv && inv.physical - inv.reserved >= l.qty }; });
        return { store_id: hit.store.id, eta_minutes: hit.area.eta_minutes, min_order_value: hit.area.min_order_value, meets_minimum: sub >= hit.area.min_order_value, ...totals, availability: available };
      });
    },
  };
}
