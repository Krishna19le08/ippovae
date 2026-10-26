import { useCallback, useEffect, useState } from "react";

// Saved delivery addresses live only in this browser (localStorage). There is no backend.
// Data is kept per signed-in user: "kn-addresses:<email>" and "kn-address-selected:<email>". Signed-out visitors have none.
// The old unscoped keys ("kn-addresses", "kn-address", "kn-profile") are handed to the FIRST user who reads them
// (see the *-migrated flags) and left untouched afterwards, so a second account never inherits them.
export const ADDR_KEY = "kn-addresses";
export const SEL_KEY = "kn-address-selected";
export const PROFILE_KEY = "kn-profile";
export const ADDR_EVENT = "kn-addresses-changed";
export const USER_EVENT = "kn-user-changed";
const ADDR_MIGRATED = "kn-addresses-migrated";
const PROFILE_MIGRATED = "kn-profile-migrated";
export const PHONE_RE = /^[6-9]\d{9}$/;
export const PIN_RE = /^[1-9]\d{5}$/;

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {}
};

export function currentUser() {
  try {
    return (localStorage.getItem("kn-user") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}
const addrKey = (u) => `${ADDR_KEY}:${u}`;
const selKey = (u) => `${SEL_KEY}:${u}`;
const profileKey = (u) => `${PROFILE_KEY}:${u}`;
const flagged = (flag) => {
  try {
    return !!localStorage.getItem(flag);
  } catch {
    return true;
  }
};

// Old unscoped data (shared profile + addresses) is handed to the FIRST signed-in account, both together,
// so a later account can never inherit someone else's name, mobile or address.
function settleLegacy(u) {
  if (flagged(ADDR_MIGRATED) || flagged(PROFILE_MIGRATED)) return;
  write(ADDR_MIGRATED, u);
  write(PROFILE_MIGRATED, u);
  const legacyProfile = read(PROFILE_KEY);
  if (legacyProfile && typeof legacyProfile === "object" && !read(profileKey(u))) write(profileKey(u), legacyProfile);
  const migrated = migrate();
  if (migrated.length && !Array.isArray(read(addrKey(u)))) {
    write(addrKey(u), migrated);
    let oldSel = "";
    try {
      oldSel = localStorage.getItem(SEL_KEY) || "";
    } catch {}
    if (oldSel) write(selKey(u), oldSel);
  }
}

// the signed-in user's profile (name + mobile); null when signed out
export function getProfile() {
  if (typeof window === "undefined") return null;
  const u = currentUser();
  if (!u) return null;
  const own = read(profileKey(u));
  if (own) return own;
  settleLegacy(u);
  return read(profileKey(u)) || null;
}
export function setProfile(p) {
  const u = currentUser();
  if (!u) return;
  getProfile(); // settle the one-time migration before writing
  write(profileKey(u), p);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("kn-profile-changed"));
}

export const newId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// name / mobile we already know about (profile, or the registered name)
export function profileDefaults() {
  const p = getProfile();
  let name = p?.name || "";
  if (!name) {
    try {
      name = localStorage.getItem("kn-user-name") || "";
    } catch {}
  }
  return { name, phone: p?.phone || "" };
}

// old single-address data -> one saved address. The old line goes into `area` whole; legacy keys are left in place.
function migrate() {
  const legacyList = read(ADDR_KEY);
  if (Array.isArray(legacyList)) {
    const list = legacyList.filter((a) => a && typeof a === "object" && a.id);
    if (list.length) return list;
  }
  const legacy = read("kn-address");
  if (!legacy || typeof legacy.address !== "string" || !legacy.address.trim()) return [];
  const { name, phone } = profileDefaults();
  const a = {
    id: newId(),
    name: name || "",
    phone: phone || legacy.phone || "",
    pincode: String(legacy.pincode || ""),
    city: legacy.place?.district || "",
    state: legacy.place?.state || "",
    flat: "",
    area: legacy.address.trim(),
    landmark: "",
    type: "home",
    isDefault: true,
  };
  if (legacy.coords) a.coords = legacy.coords;
  return [a];
}

// exactly one default when there is at least one address
const normalise = (list) => {
  if (!list.length) return list;
  const i = list.findIndex((a) => a.isDefault);
  return list.map((a, n) => ({ ...a, isDefault: n === (i < 0 ? 0 : i) }));
};

export function getAddresses() {
  if (typeof window === "undefined") return [];
  const u = currentUser();
  if (!u) return [];
  const stored = read(addrKey(u));
  if (Array.isArray(stored)) return stored.filter((a) => a && typeof a === "object" && a.id);
  settleLegacy(u);
  const settled = read(addrKey(u));
  return Array.isArray(settled) ? settled.filter((a) => a && typeof a === "object" && a.id) : [];
}

function commit(list) {
  const u = currentUser();
  const next = normalise(list);
  if (!u) return next;
  write(addrKey(u), next);
  // keep the selection pointing at something that still exists
  const sel = getSelectedId();
  if (sel && !next.some((a) => a.id === sel)) {
    try {
      localStorage.removeItem(selKey(u));
    } catch {}
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADDR_EVENT));
  return next;
}

export function getSelectedId() {
  const u = currentUser();
  if (!u) return "";
  getAddresses(); // settle the one-time migration first
  try {
    return localStorage.getItem(selKey(u)) || "";
  } catch {
    return "";
  }
}
export function setSelectedId(id) {
  const u = currentUser();
  if (u) write(selKey(u), id || "");
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADDR_EVENT));
}

// the address checkout will use: the chosen one, else the default, else the first
export function pickSelected(list, id = getSelectedId()) {
  return list.find((a) => a.id === id) || list.find((a) => a.isDefault) || list[0] || null;
}

// add (no id / unknown id) or replace; returns the saved address
export function saveAddress(addr) {
  const list = getAddresses();
  const id = addr.id && list.some((a) => a.id === addr.id) ? addr.id : newId();
  const item = { ...addr, id };
  const others = list.filter((a) => a.id !== id);
  const exists = list.length !== others.length;
  let next = exists ? list.map((a) => (a.id === id ? item : a)) : [...list, item];
  if (item.isDefault) {
    next = next.map((a) => ({ ...a, isDefault: a.id === id }));
    if (!list.find((a) => a.id === id)?.isDefault) setSelectedId(id); // a newly made default is also the chosen address (see makeDefault)
  } else if (!others.some((a) => a.isDefault)) next = next.map((a) => ({ ...a, isDefault: a.id === id }));
  commit(next);
  return item;
}
export function removeAddress(id) {
  return commit(getAddresses().filter((a) => a.id !== id));
}
// Rule: the header and checkout both show pickSelected() = chosen card, else default, else first.
// Making an address the default also makes it the chosen one, so the Default tag, the selected card and the header agree.
export function makeDefault(id) {
  const u = currentUser();
  if (u) write(selKey(u), id || "");
  return commit(getAddresses().map((a) => ({ ...a, isDefault: a.id === id })));
}

// keep the account profile (name + mobile) filled in from the first address saved, so it is never asked twice
export function ensureProfile(a) {
  const p = getProfile();
  if (p?.name && PHONE_RE.test(p?.phone || "")) return;
  setProfile({ name: p?.name || a.name, phone: PHONE_RE.test(p?.phone || "") ? p.phone : a.phone });
  try {
    if (!localStorage.getItem("kn-user-name")) localStorage.setItem("kn-user-name", a.name);
  } catch {}
}

// "Flat 4B, Sunrise Apts" / "Sector 5, Pune, Maharashtra 411001"
export function addressLines(a) {
  const line1 = [a.flat, a.area].filter(Boolean).join(", ");
  const line2 = [a.landmark && `Landmark: ${a.landmark}`, a.city, [a.state, a.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { line1, line2 };
}

export function useAddresses() {
  const [state, setState] = useState({ list: [], selected: null, ready: false });
  const refresh = useCallback(() => {
    const list = getAddresses();
    setState({ list, selected: pickSelected(list), ready: true });
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(ADDR_EVENT, refresh);
    window.addEventListener(USER_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ADDR_EVENT, refresh);
      window.removeEventListener(USER_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);
  return { ...state, refresh };
}
