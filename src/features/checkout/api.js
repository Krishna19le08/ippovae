// Checkout against the in-browser platform (no backend): price quote and order placement.
// Loaded on demand from CartDrawer so the simulated platform stays out of the initial bundle.
// All money here is integer paise.
import { getPlatform } from "@/providers/PlatformProvider";

const fail = (message, code = "INTERNAL") => ({ ok: false, error: { code, message } });

function signedInActor(p) {
  const email = (localStorage.getItem("kn-user") || "").trim().toLowerCase();
  if (!email) return { error: fail("Sign in to place your order.", "UNAUTHENTICATED") };
  const si = p.auth.signIn({ email, name: localStorage.getItem("kn-user-name") || undefined });
  return si.ok ? { actor: si.data } : { error: si };
}

const toItems = (items) => items.map((i) => ({ slug: i.slug, qty: i.qty }));

const toAddress = (a) => ({
  recipient_name: a.name, phone: a.phone, line1: a.flat, line2: a.area || null, landmark: a.landmark || null,
  city: a.city, state: a.state, pincode: a.pincode,
});

/** Prices the basket exactly as placing it would. Returns { ok, data: { subtotal, delivery_fee, tax, total, meets_minimum, min_order_value } } or { ok:false, error }. */
export function quoteCheckout({ items, address }) {
  try {
    const p = getPlatform();
    const { actor, error } = signedInActor(p);
    if (error) return error;
    return p.catalog.quote(actor, { items: toItems(items), pincode: address.pincode });
  } catch (e) {
    return fail(String(e?.message || e));
  }
}

/** Places the order and, for online methods, settles the demo payment. Never throws. */
export function placeCheckout({ items, method, address, key }) {
  try {
    const p = getPlatform();
    const { actor, error } = signedInActor(p);
    if (error) return error;
    const r = p.orders.placeOrder(actor, {
      items: toItems(items),
      address: toAddress(address),
      payment_method: method,
      idempotency_key: key,
    });
    if (!r.ok) return r;
    if (method !== "cod") p.payments.payMock(actor, { order_id: r.data.order.id, handle: "success" });
    const o = r.data.order;
    return { ok: true, data: { order_id: o.id, display_no: o.display_no, total: o.total, delivery_fee: o.delivery_fee } };
  } catch (e) {
    return fail(String(e?.message || e));
  }
}
