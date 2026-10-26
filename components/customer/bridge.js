// Bridge from the legacy checkout to the platform. Call it right after `saveOrder(...)` in CartDrawer:
//
//   import { mirrorToPlatform } from "@/components/customer/bridge";
//   mirrorToPlatform({ id, items, method, address });   // never throws, never blocks checkout
//
// It places the same basket as a platform order (idempotent per legacy id) so the customer gets live tracking,
// cancellation, invoice and support. If the platform cannot take the order (pincode outside every service area, store
// closed, a slug it does not know, not enough stock) it returns { ok:false } and the legacy order stands on its own.
import { getPlatform } from "@/lib/platform-ui/PlatformProvider";

export function mirrorToPlatform(legacy) {
  try {
    const p = getPlatform();
    const email = (localStorage.getItem("kn-user") || "").trim().toLowerCase();
    if (!email || !legacy?.id || !legacy.address) return { ok: false, skipped: "no user or address" };
    const si = p.auth.signIn({ email, name: localStorage.getItem("kn-user-name") || undefined });
    if (!si.ok) return si;
    const actor = si.data;
    const a = legacy.address;
    const r = p.orders.placeOrder(actor, {
      items: legacy.items.map((i) => ({ slug: i.slug, qty: i.qty })),
      address: {
        recipient_name: a.name, phone: a.phone, line1: a.flat, line2: a.area || null, landmark: a.landmark || null,
        city: a.city, state: a.state, pincode: a.pincode,
      },
      payment_method: legacy.method,
      legacy_id: legacy.id,
      idempotency_key: `legacy-${legacy.id}`,
    });
    if (!r.ok) return r;
    // the legacy checkout treats online methods as paid on the spot, so settle the demo payment the same way
    if (legacy.method !== "cod") p.payments.payMock(actor, { order_id: r.data.order.id, handle: "success" });
    const o = r.data.order;
    return { ok: true, data: { order_id: o.id, display_no: o.display_no, total: o.total, delivery_fee: o.delivery_fee } }; // paise
  } catch (e) {
    return { ok: false, error: { code: "INTERNAL", message: String(e?.message || e) } };
  }
}
