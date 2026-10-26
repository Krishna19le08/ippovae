// Catalog storage adapter for the LOCAL DEMO admin.
//
// Everything here reads/writes browser localStorage only. Changes are visible in this browser alone.
// A real backend can replace this module: keep the same exports (getCatalog, addProduct, editProduct,
// setHidden, deleteProduct, resetOverrides, export/importOverrides, uniqueSlug, categoryList, useCatalog)
// and have the write functions call the API instead of localStorage.
//
// Storage shape, key "kn-catalog-overrides":
//   { v:1, edits:{[slug]:{name?,price?,cat?,brand?,img?,was?,hidden?}},
//     added:[{slug,name,price,cat,brand?,img?,hidden?,createdAt}], deleted:[slug] }
// Every write dispatches "kn-catalog-changed" on window. Writes return { ok:true } or { ok:false, error }.
import { useEffect, useState } from "react";
import { products as baseProducts } from "@/lib/data";
import { withBase } from "@/lib/asset";

export const KEY = "kn-catalog-overrides";
export const EVENT = "kn-catalog-changed";
export const baseCatalog = baseProducts;

const empty = () => ({ v: 1, edits: {}, added: [], deleted: [], categories: [] });
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

function read() {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (!isObj(d)) return empty();
    return {
      v: 1,
      edits: isObj(d.edits) ? d.edits : {},
      added: Array.isArray(d.added) ? d.added.filter((p) => isObj(p) && p.slug) : [],
      deleted: Array.isArray(d.deleted) ? d.deleted.filter((s) => typeof s === "string") : [],
      categories: Array.isArray(d.categories) ? d.categories.filter((s) => typeof s === "string" && s.trim()) : [],
    };
  } catch {
    return empty();
  }
}

function write(data) {
  if (typeof window === "undefined") return { ok: false, error: "Storage is not available." };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    const full = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    return { ok: false, error: full ? "Browser storage is full. Remove an image or some products and try again." : "Could not save to browser storage." };
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {}
  return { ok: true };
}

// user-entered image paths are stored without the site base path, so add it back when rendering
const resolveImg = (img) => (typeof img === "string" && img.startsWith("/") ? withBase(img) : img);
export const storableImg = (img) => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return base && typeof img === "string" && img.startsWith(base + "/") ? img.slice(base.length) : img;
};

function merge(data, includeHidden) {
  const gone = new Set(data.deleted);
  const out = [];
  for (const p of baseProducts) {
    if (gone.has(p.slug)) continue;
    const e = data.edits[p.slug];
    const item = e ? { ...p, ...e, ...(e.img ? { img: resolveImg(e.img) } : {}) } : { ...p };
    out.push(item);
  }
  for (const a of data.added) {
    if (gone.has(a.slug)) continue;
    const e = data.edits[a.slug];
    const item = { ...a, ...(e || {}) };
    out.push({ ...item, img: resolveImg(item.img) || withBase("/logo.png") });
  }
  return includeHidden ? out : out.filter((p) => !p.hidden);
}

export function getCatalog({ includeHidden = false } = {}) {
  return merge(read(), includeHidden);
}

export function getCatalogEntry(slug) {
  return merge(read(), true).find((p) => p.slug === slug);
}

const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function slugFromName(name) {
  return slugify(name);
}

export function slugTaken(slug) {
  const d = read();
  return baseProducts.some((p) => p.slug === slug) || d.added.some((p) => p.slug === slug);
}

// a free slug based on the name (checks base + added; deleted base slugs stay reserved)
export function uniqueSlug(name) {
  const root = slugify(name) || "product";
  let s = root;
  for (let i = 2; slugTaken(s); i++) s = `${root}-${i}`;
  return s;
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export function addProduct({ slug, name, price, cat, brand, img }) {
  const d = read();
  const finalSlug = slug && !slugTaken(slug) ? slug : uniqueSlug(slug || name);
  d.added.push(clean({ slug: finalSlug, name, price: Number(price), cat, brand, img: storableImg(img), createdAt: new Date().toISOString() }));
  const r = write(d);
  return r.ok ? { ok: true, slug: finalSlug } : r;
}

export function editProduct(slug, patch) {
  const d = read();
  const p = { ...patch };
  if ("price" in p) p.price = Number(p.price);
  if ("img" in p) p.img = storableImg(p.img);
  const idx = d.added.findIndex((a) => a.slug === slug);
  if (idx >= 0) {
    d.added[idx] = clean({ ...d.added[idx], ...p });
  } else {
    d.edits[slug] = { ...(d.edits[slug] || {}), ...p };
    // an edit equal to the base value is not an override
    const base = baseProducts.find((b) => b.slug === slug);
    if (base) for (const k of Object.keys(d.edits[slug])) if (k !== "hidden" && d.edits[slug][k] === base[k]) delete d.edits[slug][k];
    if (!Object.keys(d.edits[slug]).length) delete d.edits[slug];
  }
  return write(d);
}

export function setHidden(slug, hidden) {
  const d = read();
  const idx = d.added.findIndex((a) => a.slug === slug);
  if (idx >= 0) {
    const next = { ...d.added[idx], hidden: !!hidden };
    if (!hidden) delete next.hidden;
    d.added[idx] = next;
  } else {
    const e = { ...(d.edits[slug] || {}), hidden: !!hidden };
    if (!hidden) delete e.hidden;
    if (Object.keys(e).length) d.edits[slug] = e;
    else delete d.edits[slug];
  }
  return write(d);
}

export function deleteProduct(slug) {
  const d = read();
  d.added = d.added.filter((a) => a.slug !== slug);
  delete d.edits[slug];
  if (baseProducts.some((p) => p.slug === slug) && !d.deleted.includes(slug)) d.deleted.push(slug);
  return write(d);
}

export function resetOverrides() {
  if (typeof window === "undefined") return { ok: false, error: "Storage is not available." };
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    return { ok: false, error: "Could not clear browser storage." };
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {}
  return { ok: true };
}

export const exportOverrides = () => JSON.stringify(read(), null, 2);

export function importOverrides(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not valid JSON." };
  }
  if (!isObj(d) || d.v !== 1) return { ok: false, error: "That file is not a catalog export." };
  return write({
    v: 1,
    edits: isObj(d.edits) ? d.edits : {},
    added: Array.isArray(d.added) ? d.added : [],
    deleted: Array.isArray(d.deleted) ? d.deleted : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
  });
}

// Categories the admin created before any product uses them. Shop filters still hide a category until it has a visible product.
export const extraCategories = () => read().categories;

export const CATEGORY_MAX = 40;

// every category name in use: from products (admin view, hidden included) plus the admin's own
function allCategoryNames() {
  const names = new Set(categoryList(getCatalog({ includeHidden: true })).map((c) => c.name));
  return names;
}

export function addCategory(raw) {
  const name = String(raw || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Enter a category name of at least 2 characters." };
  if (name.length > CATEGORY_MAX) return { ok: false, error: `Use ${CATEGORY_MAX} characters or fewer.` };
  const lower = name.toLowerCase();
  if ([...allCategoryNames()].some((n) => n.toLowerCase() === lower)) return { ok: false, error: `"${name}" already exists.` };
  const d = read();
  d.categories.push(name);
  const res = write(d);
  return res.ok ? { ok: true, name } : res;
}

// only categories the admin created and that no product uses can be removed
export function removeCategory(name) {
  if (getCatalog({ includeHidden: true }).some((p) => p.cat === name)) return { ok: false, error: "This category still has products." };
  const d = read();
  d.categories = d.categories.filter((n) => n !== name);
  return write(d);
}

// name / count / visibleCount derived from the given catalog (pass getCatalog({includeHidden:true}))
export function categoryList(catalog) {
  const map = new Map();
  for (const p of catalog) {
    if (!p.cat) continue;
    const c = map.get(p.cat) || { name: p.cat, count: 0, visibleCount: 0 };
    c.count += 1;
    if (!p.hidden) c.visibleCount += 1;
    map.set(p.cat, c);
  }
  for (const name of read().categories) if (!map.has(name)) map.set(name, { name, count: 0, visibleCount: 0, custom: true });
  return [...map.values()];
}

// Renders the BASE list on first render (matches server HTML), then the merged list after mount.
export function useCatalog({ includeHidden = false } = {}) {
  const [list, setList] = useState(baseCatalog);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => {
      setList(getCatalog({ includeHidden }));
      setReady(true);
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [includeHidden]);
  return { list, ready };
}

// Link to a product page: seed products have a pre-built static page, admin-added ones use the client view page.
export function productHref(p) {
  const slug = typeof p === "string" ? p : p.slug;
  return baseProducts.some((b) => b.slug === slug) ? `/products/${slug}` : `/products/view?slug=${encodeURIComponent(slug)}`;
}

// Shop categories for the given (visible) catalog: seed categories keep their image and order, new ones follow;
// counts come from the catalog and categories with no products are left out.
export function liveCategories(catalog, baseCats) {
  const counts = new Map();
  const sample = new Map();
  for (const p of catalog) {
    if (!p.cat) continue;
    counts.set(p.cat, (counts.get(p.cat) || 0) + 1);
    if (!sample.has(p.cat)) sample.set(p.cat, p.img);
  }
  const out = [];
  for (const c of baseCats) if (counts.has(c.name)) out.push({ ...c, count: counts.get(c.name) });
  for (const [name, count] of counts) if (!baseCats.some((c) => c.name === name)) out.push({ name, count, img: sample.get(name) });
  return out;
}
