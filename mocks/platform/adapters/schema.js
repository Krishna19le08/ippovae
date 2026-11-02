// Storage rules shared by every adapter: unique indexes and append-only collections (DATA-MODEL.md section 1 and 3).

const LIVE_ASSIGNMENT = ["offered", "accepted", "picked_up"];
const LIVE_REFUND_EXCLUDED = ["rejected", "cancelled", "failed"];

export const APPEND_ONLY = new Set([
  "order_status_history", "payment_transactions", "stock_movements", "delivery_events", "ticket_messages", "audit_logs", "coupon_redemptions",
]);

// { name, fields, lower?: fields compared case-insensitively, when?: partial-index predicate }
export const UNIQUE = {
  users: [{ name: "users_email", fields: ["email"], lower: ["email"] }, { name: "users_phone", fields: ["phone"] }],
  user_roles: [{ name: "user_roles_uq", fields: ["user_id", "role", "store_id"], keepNull: true }],
  stores: [{ name: "stores_code", fields: ["code"] }],
  service_areas: [{ name: "sva_store_pin", fields: ["store_id", "pincode"] }],
  categories: [{ name: "categories_slug", fields: ["slug"] }, { name: "categories_name", fields: ["name"], lower: ["name"] }],
  products: [{ name: "products_slug", fields: ["slug"] }, { name: "products_sku", fields: ["sku"] }],
  orders: [
    { name: "orders_display_no", fields: ["display_no"] },
    { name: "orders_user_idem", fields: ["user_id", "idempotency_key"] },
  ],
  order_items: [{ name: "oit_order_product", fields: ["order_id", "product_id"] }],
  order_status_history: [{ name: "osh_order_seq", fields: ["order_id", "seq"] }],
  payments: [
    { name: "pay_provider_order", fields: ["provider", "provider_order_id"] },
    { name: "pay_order_idem", fields: ["order_id", "idempotency_key"] },
  ],
  payment_transactions: [{ name: "ptx_provider_event", fields: ["provider", "provider_event_id"] }],
  refunds: [
    { name: "refunds_live_scope", fields: ["payment_id", "scope_key"], when: (r) => !LIVE_REFUND_EXCLUDED.includes(r.status) },
    { name: "refunds_idem", fields: ["payment_id", "idempotency_key"] },
    { name: "refunds_provider", fields: ["provider_refund_id"] },
  ],
  assignments: [{ name: "assignments_one_live", fields: ["order_id"], when: (r) => LIVE_ASSIGNMENT.includes(r.status) }],
  tickets: [{ name: "tickets_display_no", fields: ["display_no"] }],
  coupons: [{ name: "coupons_code", fields: ["code"] }],
  coupon_redemptions: [{ name: "cpr_coupon_order_status", fields: ["coupon_id", "order_id", "status"] }],
  notifications: [{ name: "ntf_dedupe", fields: ["user_id", "channel", "dedupe_key"] }],
  webhook_events: [{ name: "webhook_provider_event", fields: ["provider", "event_id"] }],
  idempotency_keys: [],
  inventory: [{ name: "inventory_pair", fields: ["store_id", "product_id"] }],
};

export const COLLECTIONS = [
  "users", "user_roles", "addresses", "stores", "service_areas", "categories", "products", "inventory", "stock_movements", "reservations",
  "orders", "order_items", "order_status_history", "payments", "payment_transactions", "refunds", "delivery_partners", "assignments",
  "delivery_events", "tickets", "ticket_messages", "attachments", "coupons", "coupon_redemptions", "notifications", "audit_logs",
  "idempotency_keys", "webhook_events", "gateway_inbox", "counters",
];
