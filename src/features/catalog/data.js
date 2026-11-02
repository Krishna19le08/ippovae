import { withBase } from "@/lib/asset";
import data from "@/features/catalog/markdown.json";

// All catalogue and site data lives in lib/markdown.json.
export const SITE = data.site;
export const SHOP = `${SITE}/copy-of-bearings`;
export const HUB = `${SITE}/k-now-hub`;
// Digits only, with country code (e.g. "919876543210"). Until set, WhatsApp opens and lets the sender pick who to message.
export const WHATSAPP = data.whatsapp;
export const whatsappHref = (text = "") => `https://wa.me/${WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const product = (slug) => `${SITE}/product-page/${slug}`;

export const socials = data.socials;

// Prices in INR, taken from the ippovae shop (apparel, firewood and fertiliser listings left out).
export const products = data.products.map((p) => ({ ...p, img: withBase(p.img) }));

export const FEATURED = data.featured;

export const categories = data.categories.map((c) => (c.img ? { ...c, img: withBase(c.img) } : c));

// whole rupees print plain (₹450); anything with paise always shows two decimals (₹359.70)
export const inr = (n) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
