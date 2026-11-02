// Local repository adapter: localStorage (or any injected getItem/setItem storage, or an in-memory Map when there
// is no window). Implements the repository port from ARCHITECTURE.md section 2.2.
//
// transact(fn) loads the touched collections into a working copy, runs fn synchronously, then writes everything back
// in one pass; if fn throws, nothing is written. localStorage is synchronous, so a read-check-write inside one
// transact is atomic within a tab. Across tabs every mutable aggregate carries `version` and update() checks it.

import { PlatformError } from "../errors.js";
import { APPEND_ONLY, UNIQUE } from "./schema.js";

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

export function createMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  };
}

function defaultStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* blocked storage */ }
  return createMemoryStorage();
}

function matches(row, where) {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    const v = row[k];
    if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
      if ("in" in cond && !cond.in.includes(v)) return false;
      if ("ne" in cond && v === cond.ne) return false;
      if ("gt" in cond && !(v > cond.gt)) return false;
      if ("gte" in cond && !(v >= cond.gte)) return false;
      if ("lt" in cond && !(v < cond.lt)) return false;
      if ("lte" in cond && !(v <= cond.lte)) return false;
    } else if (v !== cond) return false;
  }
  return true;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).map((k) => (k.startsWith("-") ? [k.slice(1), -1] : [k, 1]));
  return rows.slice().sort((a, b) => {
    for (const [k, dir] of keys) {
      if (a[k] === b[k]) continue;
      if (a[k] == null) return 1 * dir;
      if (b[k] == null) return -1 * dir;
      return (a[k] < b[k] ? -1 : 1) * dir;
    }
    return 0;
  });
}

export function createLocalRepo({ storage, seed, namespace = "kn:v1", clock }) {
  const store = storage || defaultStorage();
  const key = (c) => `${namespace}:${c}`;
  const listeners = new Set();
  let active = null; // current transaction (nested transact joins it)

  function readRaw(c) {
    try { return store.getItem(key(c)); } catch { throw new PlatformError("DATA_CORRUPT", "Storage is not readable.", { collection: c }); }
  }
  function readRows(c) {
    const raw = readRaw(c);
    if (raw == null) return [];
    try {
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) throw new Error("not an array");
      return v;
    } catch {
      throw new PlatformError("DATA_CORRUPT", `Collection ${c} is corrupted.`, { collection: c });
    }
  }
  function writeRaw(c, value) {
    try { store.setItem(key(c), value); } catch (e) {
      throw new PlatformError("STORAGE_FULL", "Could not save. Storage may be full.", { collection: c });
    }
  }

  function loadMeta() {
    const raw = readRaw("meta");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function seedAll() {
    const cols = (seed && seed.collections) || {};
    const names = Object.keys(cols);
    for (const c of names) writeRaw(c, JSON.stringify(cols[c]));
    writeRaw("meta", JSON.stringify({ schema: 1, seededAt: clock ? clock.iso() : null, seeded: names }));
  }
  if (!loadMeta()) seedAll();

  function makeTx(working) {
    const load = (c) => {
      let w = working.get(c);
      if (!w) { w = { rows: readRows(c), dirty: false }; working.set(c, w); }
      return w;
    };
    const checkUnique = (c, rec, selfId) => {
      const defs = UNIQUE[c];
      if (!defs || !defs.length) return;
      const rows = load(c).rows;
      for (const u of defs) {
        if (u.when && !u.when(rec)) continue;
        if (!u.keepNull && u.fields.some((f) => rec[f] == null)) continue;
        const tuple = (r) => u.fields.map((f) => { const v = r[f] ?? null; return u.lower && u.lower.includes(f) && typeof v === "string" ? v.toLowerCase() : v; });
        const mine = JSON.stringify(tuple(rec));
        for (const o of rows) {
          if (o.id === selfId) continue;
          if (u.when && !u.when(o)) continue;
          if (!u.keepNull && u.fields.some((f) => o[f] == null)) continue;
          if (JSON.stringify(tuple(o)) === mine) throw new PlatformError("CONFLICT", `Duplicate value for ${u.name}.`, { unique: u.name, collection: c, existing_id: o.id });
        }
      }
    };
    const tx = {
      get(c, id) { const r = load(c).rows.find((x) => x.id === id); return r ? clone(r) : null; },
      list(c, { where, orderBy, limit } = {}) {
        let out = load(c).rows.filter((r) => matches(r, where));
        out = sortRows(out, orderBy);
        if (limit != null) out = out.slice(0, limit);
        return clone(out);
      },
      count(c, where) { return load(c).rows.filter((r) => matches(r, where)).length; },
      insert(c, record) {
        if (!record || !record.id) throw new PlatformError("VALIDATION_FAILED", "Record needs an id.", { collection: c });
        const w = load(c);
        if (w.rows.some((r) => r.id === record.id)) throw new PlatformError("CONFLICT", "Duplicate id.", { collection: c, id: record.id });
        const now = clock ? clock.iso() : null;
        const rec = clone(record);
        if (rec.created_at === undefined && now) rec.created_at = now;
        if (rec.updated_at === undefined && now && !APPEND_ONLY.has(c)) rec.updated_at = now;
        checkUnique(c, rec, null);
        w.rows.push(rec); w.dirty = true;
        return clone(rec);
      },
      update(c, id, patch, { expectedVersion } = {}) {
        if (APPEND_ONLY.has(c)) throw new PlatformError("APPEND_ONLY", `${c} is append-only.`, { collection: c });
        const w = load(c);
        const idx = w.rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new PlatformError("NOT_FOUND", "Record not found.", { collection: c, id });
        const cur = w.rows[idx];
        if (expectedVersion !== undefined && expectedVersion !== null && cur.version !== expectedVersion) {
          throw new PlatformError("VERSION_CONFLICT", "The record changed. Refresh and try again.", { collection: c, id, current_version: cur.version });
        }
        const next = { ...cur, ...clone(patch) };
        if (typeof cur.version === "number") next.version = cur.version + 1;
        if (clock) next.updated_at = clock.iso();
        next.id = cur.id;
        checkUnique(c, next, id);
        w.rows[idx] = next; w.dirty = true;
        return clone(next);
      },
      remove(c, id) {
        if (APPEND_ONLY.has(c)) throw new PlatformError("APPEND_ONLY", `${c} is append-only.`, { collection: c });
        const w = load(c);
        const idx = w.rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new PlatformError("NOT_FOUND", "Record not found.", { collection: c, id });
        w.rows.splice(idx, 1); w.dirty = true;
      },
      counter(name) {
        const w = load("counters");
        const row = w.rows.find((r) => r.id === name);
        if (row) { row.n += 1; w.dirty = true; return row.n; }
        w.rows.push({ id: name, n: 1 }); w.dirty = true;
        return 1;
      },
      // Sortable prefixed id: <prefix>_<time base36><per-prefix counter base36>
      nextId(prefix) {
        const n = tx.counter(`id:${prefix}`);
        const t = (clock ? clock.now() : 0).toString(36).padStart(9, "0");
        return `${prefix}_${t}${n.toString(36).padStart(5, "0")}`;
      },
      nextNo(prefixLabel, kind) {
        return `${prefixLabel}-${String(tx.counter(`no:${kind}`)).padStart(6, "0")}`;
      },
    };
    return tx;
  }

  function commit(working) {
    const dirty = [...working.entries()].filter(([, w]) => w.dirty);
    if (!dirty.length) return [];
    const encoded = dirty.map(([c, w]) => [c, JSON.stringify(w.rows)]);
    const undo = [];
    try {
      for (const [c, json] of encoded) {
        undo.push([c, readRaw(c)]);
        writeRaw(c, json);
      }
    } catch (e) {
      for (const [c, old] of undo.reverse()) {
        try { old == null ? store.removeItem(key(c)) : store.setItem(key(c), old); } catch { /* best effort */ }
      }
      throw e;
    }
    return dirty.map(([c]) => c);
  }

  function emit(collections) {
    if (!collections.length) return;
    for (const l of listeners) { try { l({ collections }); } catch { /* listener errors must not break commits */ } }
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("kn-platform-changed", { detail: { collections } }));
      }
    } catch { /* not in a browser */ }
  }

  const repo = {
    storage: store,
    namespace,
    transact(fn) {
      if (active) return fn(active);
      const working = new Map();
      const tx = makeTx(working);
      active = tx;
      let result;
      try { result = fn(tx); } finally { active = null; }
      const changed = commit(working);
      emit(changed);
      return result;
    },
    // read-only convenience: same API, nothing is written even if fn mutates
    read(fn) {
      if (active) return fn(active);
      const tx = makeTx(new Map());
      active = tx;
      try { return fn(tx); } finally { active = null; }
    },
    get: (c, id) => repo.read((tx) => tx.get(c, id)),
    list: (c, opts) => repo.read((tx) => tx.list(c, opts)),
    insert: (c, rec) => repo.transact((tx) => tx.insert(c, rec)),
    update: (c, id, patch, opts) => repo.transact((tx) => tx.update(c, id, patch, opts)),
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    // Replace one collection with its seeded content (used after DATA_CORRUPT) or empty if it was never seeded.
    repair(c) {
      const rows = (seed && seed.collections && seed.collections[c]) || [];
      writeRaw(c, JSON.stringify(rows));
      emit([c]);
    },
    reset() {
      const meta = loadMeta();
      const names = new Set([...(meta && meta.seeded ? meta.seeded : []), "meta", "counters"]);
      for (const c of Object.keys(UNIQUE)) names.add(c);
      for (const c of ["stock_movements", "reservations", "orders", "order_items", "payments", "refunds", "assignments", "delivery_events", "tickets", "ticket_messages", "attachments", "coupon_redemptions", "notifications", "audit_logs", "gateway_inbox"]) names.add(c);
      for (const c of names) { try { store.removeItem(key(c)); } catch { /* ignore */ } }
      seedAll();
      emit([...names]);
    },
  };
  return repo;
}
