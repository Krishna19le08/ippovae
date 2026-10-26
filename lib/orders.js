import { useCallback, useEffect, useState } from "react";
import { currentUser, USER_EVENT } from "@/lib/addresses";

// Placed orders live only in this browser (localStorage), per signed-in user: "kn-orders:<email>". There is no backend,
// so an order has no shipping status; it records what was bought, at what price, where it goes and how it is paid.
export const ORDERS_KEY = "kn-orders";
export const ORDERS_EVENT = "kn-orders-changed";
const MAX_ORDERS = 50;

const key = (u) => `${ORDERS_KEY}:${u}`;

export function getOrders() {
  if (typeof window === "undefined") return [];
  const u = currentUser();
  if (!u) return [];
  try {
    const list = JSON.parse(localStorage.getItem(key(u)));
    return Array.isArray(list) ? list.filter((o) => o && o.id && Array.isArray(o.items)) : [];
  } catch {
    return [];
  }
}

// Tracking: with no server nothing moves an order along by itself, so the status is whatever the shop (the admin) last set.
// Each change is stamped with its time; the customer's Orders page shows that timeline. No delivery times are promised.
export const STATUSES = [
  { id: "placed", label: "Order placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "packed", label: "Packed" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
];
export const CANCELLED = { id: "cancelled", label: "Cancelled" };
export const ALL_STATUSES = [...STATUSES, CANCELLED];

export const statusOf = (o) => (ALL_STATUSES.some((s) => s.id === o?.status) ? o.status : "placed");
export const statusLabel = (id) => ALL_STATUSES.find((s) => s.id === id)?.label || "Order placed";
// older orders have no history: they were placed when they were saved
export const historyOf = (o) => (Array.isArray(o?.history) && o.history.length ? o.history : [{ status: "placed", at: o?.date }]);

// order: { id, items: [{ slug, name, img, price, qty }], total, method, address, date }; newest first
export function saveOrder(order) {
  const u = currentUser();
  if (!u) return;
  const placed = { ...order, status: "placed", history: [{ status: "placed", at: order.date }] };
  try {
    localStorage.setItem(key(u), JSON.stringify([placed, ...getOrders()].slice(0, MAX_ORDERS)));
  } catch {}
  window.dispatchEvent(new Event(ORDERS_EVENT));
}

// Sets an order's status in the given customer's saved orders (this browser). Returns { ok, error }.
export function updateOrderStatus(email, id, status) {
  if (!ALL_STATUSES.some((s) => s.id === status)) return { ok: false, error: "Unknown status." };
  try {
    const k = key(String(email).trim().toLowerCase());
    const list = JSON.parse(localStorage.getItem(k));
    const i = Array.isArray(list) ? list.findIndex((o) => o && o.id === id) : -1;
    if (i < 0) return { ok: false, error: "Order not found." };
    if (statusOf(list[i]) === status) return { ok: true };
    list[i] = { ...list[i], status, history: [...historyOf(list[i]), { status, at: new Date().toISOString() }] };
    localStorage.setItem(k, JSON.stringify(list));
  } catch {
    return { ok: false, error: "Could not save the new status to browser storage." };
  }
  window.dispatchEvent(new Event(ORDERS_EVENT));
  return { ok: true };
}

export function useOrders() {
  const [state, setState] = useState({ list: [], ready: false });
  const refresh = useCallback(() => setState({ list: getOrders(), ready: true }), []);
  useEffect(() => {
    refresh();
    window.addEventListener(ORDERS_EVENT, refresh);
    window.addEventListener(USER_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ORDERS_EVENT, refresh);
      window.removeEventListener(USER_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return state;
}
