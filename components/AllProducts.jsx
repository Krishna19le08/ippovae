"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProductCard from "@/components/ProductCard";
import BackButton from "@/components/BackButton";
import { categories as baseCats } from "@/lib/data";
import { useCatalog, liveCategories } from "@/lib/admin/catalog";

const parseList = (v) => (v ? v.split(",").filter(Boolean) : []);
import { useDialogFocus } from "@/lib/useDialogFocus";

const STEP = 12;

const sorts = {
  featured: ["Featured", null],
  low: ["Price: Low to High", (a, b) => a.price - b.price],
  high: ["Price: High to Low", (a, b) => b.price - a.price],
  name: ["Name: A to Z", (a, b) => a.name.localeCompare(b.name)],
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-sm font-semibold"
      >
        {title}
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Check2({ on, onChange, label, count }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 max-lg:min-h-11 text-sm transition-colors ${
        on ? "bg-accent font-medium text-foreground" : "hover:bg-slate-50"
      }`}
    >
      <input type="checkbox" checked={on} onChange={onChange} className="peer sr-only" />
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-1 ${
          on ? "border-foreground bg-primary text-primary-foreground" : "border-input bg-white"
        }`}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {count != null && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] leading-none ${
            on ? "bg-accent text-foreground" : "bg-slate-100 text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );
}

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const panelId = useId();

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // focus the current choice so the keyboard starts where the user is
    (listRef.current?.querySelector('[aria-current="true"]') || listRef.current?.querySelector("button"))?.focus();
    const outside = (e) => {
      if (ref.current?.contains(e.target)) return;
      setOpen(false);
      // a click on something non-focusable would otherwise drop focus to <body>
      setTimeout(() => {
        const a = document.activeElement;
        if (!a || a === document.body) btnRef.current?.focus();
      }, 0);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
      return;
    }
    if (!open || !listRef.current?.contains(e.target)) return;
    if (e.key === "Tab") return setOpen(false); // focus moves on naturally
    const btns = [...listRef.current.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    const to = { ArrowDown: (i + 1) % btns.length, ArrowUp: (i - 1 + btns.length) % btns.length, Home: 0, End: btns.length - 1 }[e.key];
    if (to !== undefined) {
      e.preventDefault();
      btns[to].focus();
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex h-10 items-center gap-2 rounded-lg border border-input bg-white px-3 text-sm shadow-xs transition-colors hover:border-foreground/40"
      >
        <span className="text-muted-foreground">Sort:</span>
        <span className="font-medium">{sorts[value][0]}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={panelId}
          ref={listRef}
          aria-label="Sort products by"
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {Object.entries(sorts).map(([k, [label]]) => (
            <li key={k}>
              <button
                type="button"
                aria-current={k === value ? "true" : undefined}
                onClick={() => {
                  onChange(k);
                  close();
                }}
                className={`flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-offset-[-2px] ${
                  k === value ? "font-medium text-foreground" : ""
                }`}
              >
                {label}
                {k === value && <Check className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AllProducts() {
  const { list: products } = useCatalog();
  const brandNames = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const categories = useMemo(() => liveCategories(products, baseCats), [products]);
  const params = useSearchParams();
  const urlCats = params.get("cat");
  const urlBrands = params.get("brand");
  const urlQ = params.get("q") || "";

  const urlKey = `${urlCats || ""}|${urlQ}|${urlBrands || ""}`;
  // seeded from the URL so server HTML matches the filtered view
  const [cats, setCats] = useState(() => (urlCats ? urlCats.split(",") : []));
  const [brands, setBrands] = useState(() => parseList(urlBrands).filter((b) => brandNames.includes(b)));
  const [prevKey, setPrevKey] = useState(urlKey);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [sort, setSort] = useState("featured");
  const [shown, setShown] = useState(STEP);
  const [open, setOpen] = useState(false); // mobile filter drawer
  const [sale, setSale] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [catQ, setCatQ] = useState("");
  const drawerRef = useDialogFocus(open);

  // the drawer is for small screens only: close it if the window grows past the sidebar breakpoint
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    mq.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      mq.removeEventListener("change", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // header links / search change the URL: re-seed the filters during render (no effect, no flash)
  if (prevKey !== urlKey) {
    setPrevKey(urlKey);
    setCats(urlCats ? urlCats.split(",") : []);
    setBrands(parseList(urlBrands).filter((b) => brandNames.includes(b)));
    setShown(STEP);
  }

  const toggleCat = (name) => {
    setCats((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]));
    setShown(STEP);
  };

  const toggleBrand = (name) => {
    setBrands((b) => (b.includes(name) ? b.filter((x) => x !== name) : [...b, name]));
    setShown(STEP);
  };

  const clear = () => {
    setCats([]);
    setBrands([]);
    setMin("");
    setMax("");
    setSale(false);
    setFresh(false);
    setShown(STEP);
  };

  // everything except the category choice, so category counts reflect the other filters
  const base = useMemo(() => {
    const q = urlQ.trim().toLowerCase();
    const lo = min === "" ? -Infinity : Number(min);
    const hi = max === "" ? Infinity : Number(max);
    return products.filter(
      (p) =>
        p.price >= lo &&
        p.price <= hi &&
        (!sale || p.was) &&
        (!fresh || p.tag === "New") &&
        (!q || `${p.name} ${p.cat} ${p.brand || ""}`.toLowerCase().includes(q)),
    );
  }, [products, min, max, sale, fresh, urlQ]);

  // category counts respect the brand choice, brand counts respect the category choice
  const counts = useMemo(() => {
    const c = {};
    base.forEach((p) => {
      if (brands.length && !brands.includes(p.brand)) return;
      c[p.cat] = (c[p.cat] || 0) + 1;
    });
    return c;
  }, [base, brands]);

  const brandCounts = useMemo(() => {
    const c = {};
    base.forEach((p) => {
      if (!p.brand || (cats.length && !cats.includes(p.cat))) return;
      c[p.brand] = (c[p.brand] || 0) + 1;
    });
    return c;
  }, [base, cats]);

  const list = useMemo(() => {
    const out = base.filter((p) => (!cats.length || cats.includes(p.cat)) && (!brands.length || brands.includes(p.brand)));
    const cmp = sorts[sort][1];
    return cmp ? [...out].sort(cmp) : out;
  }, [base, cats, brands, sort]);

  const active = cats.length + brands.length + (min !== "") + (max !== "") + sale + fresh;
  const priceLabel = min !== "" || max !== "" ? `₹${min || 0} – ${max ? `₹${max}` : "any"}` : "";

  const heading = urlQ ? `Results for “${urlQ}”` : cats.length === 1 ? cats[0] : "All Products";

  const shownCats = categories.filter((c) => c.name.toLowerCase().includes(catQ.trim().toLowerCase()));

  const priceInput = (value, set, placeholder, label) => (
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input
        type="number"
        min="0"
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        className="h-10 pl-6"
        onChange={(e) => {
          set(e.target.value);
          setShown(STEP);
        }}
      />
    </div>
  );

  const filters = (
    <div className="divide-y divide-slate-200/80">
      <Section title="Category">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={catQ}
            onChange={(e) => setCatQ(e.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="grid gap-0.5">
          {shownCats.map((c) => (
            <Check2
              key={c.name}
              on={cats.includes(c.name)}
              onChange={() => toggleCat(c.name)}
              label={c.name}
              count={counts[c.name] || 0}
            />
          ))}
          {!shownCats.length && <p className="px-2.5 py-2 text-sm text-muted-foreground">No categories found</p>}
        </div>
      </Section>

      {brandNames.length >= 2 && (
        <Section title="Brand">
          <div className="grid gap-0.5">
            {brandNames.map((b) => (
              <Check2 key={b} on={brands.includes(b)} onChange={() => toggleBrand(b)} label={b} count={brandCounts[b] || 0} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Price">
        <div className="flex items-center gap-2">
          {priceInput(min, setMin, "Min", "Minimum price")}
          <span className="text-muted-foreground">–</span>
          {priceInput(max, setMax, "Max", "Maximum price")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["Under ₹500", "", "500"],
            ["₹500–2,000", "500", "2000"],
            ["Over ₹2,000", "2000", ""],
          ].map(([label, lo, hi]) => (
            <button
              key={label}
              type="button"
              aria-pressed={min === lo && max === hi}
              onClick={() => {
                const same = min === lo && max === hi;
                setMin(same ? "" : lo);
                setMax(same ? "" : hi);
                setShown(STEP);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                min === lo && max === hi
                  ? "border-foreground bg-accent text-foreground"
                  : "border-input hover:border-foreground/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Offers">
        <div className="grid gap-0.5">
          <Check2 on={sale} onChange={() => { setSale(!sale); setShown(STEP); }} label="On sale" />
          <Check2 on={fresh} onChange={() => { setFresh(!fresh); setShown(STEP); }} label="New arrivals" />
        </div>
      </Section>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
      {/* desktop sidebar */}
      <aside className="hidden self-start overflow-hidden rounded-md border border-border bg-white lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100svh-7rem)] lg:flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <p className="flex items-center gap-2 text-base font-bold">
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters
            {active > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full border border-foreground bg-primary text-[11px] leading-none font-semibold text-primary-foreground">
                {active}
              </span>
            )}
          </p>
          {active > 0 && (
            <button onClick={clear} className="text-xs font-medium text-foreground underline underline-offset-4">
              Clear all
            </button>
          )}
        </div>
        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-2 pl-5">
          <div className="pr-1">{filters}</div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-white to-transparent" aria-hidden />
      </aside>

      {/* mobile drawer: a modal dialog, portaled to <body> like the other overlays */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div
              ref={drawerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
             
              className="slim-scroll absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-5 text-foreground"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold">Filters</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close filters"
                  className="-m-1 flex size-10 items-center justify-center rounded-md"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {filters}
              {/* stays at the bottom of the drawer so the filters can be applied without scrolling back down */}
              <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 space-y-3 border-t border-slate-200 bg-white px-5 pt-3 pb-5">
                {active > 0 && (
                  <Button variant="outline" className="w-full" onClick={clear}>
                    Clear all
                  </Button>
                )}
                <Button className="w-full" onClick={() => setOpen(false)}>
                  Show {list.length} {list.length === 1 ? "product" : "products"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div className="min-w-0">
        <div className="sticky top-[63px] z-20 -mx-4 mb-4 border-b border-slate-200/70 bg-white px-4 pt-4 pb-3 md:top-[68px]">
        <div className="flex items-center gap-3">
          <BackButton fallback="/" label="" className="mb-0 size-9 max-md:size-11 justify-center rounded-full border border-border hover:bg-accent hover:no-underline" />
          <h1 className="text-2xl font-bold">{heading}</h1>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {list.length} {list.length === 1 ? "product" : "products"}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "product" : "products"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-10 lg:hidden" onClick={() => setOpen(true)}>
              <SlidersHorizontal /> Filters{active > 0 && ` (${active})`}
            </Button>
            <SortMenu value={sort} onChange={setSort} />
          </div>
        </div>
        </div>

        {active > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[
              ...cats.map((c) => [c, () => toggleCat(c)]),
              ...brands.map((b) => [b, () => toggleBrand(b)]),
              ...(priceLabel ? [[priceLabel, () => { setMin(""); setMax(""); }]] : []),
              ...(sale ? [["On sale", () => setSale(false)]] : []),
              ...(fresh ? [["New arrivals", () => setFresh(false)]] : []),
            ].map(([label, remove]) => (
              <button
                key={label}
                onClick={remove}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-2 max-md:py-3 text-xs font-medium text-foreground hover:bg-accent"
              >
                {label} <X className="size-3" />
              </button>
            ))}
            <button onClick={clear} className="px-2 py-2 max-md:py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>
        )}

        {list.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {list.slice(0, shown).map((p) => (
              <ProductCard key={p.slug} p={p} />
            ))}
          </div>
        ) : (
          <div role="status" className="rounded-2xl border border-dashed p-10 text-center md:p-12">
            <p className="text-lg font-semibold text-foreground">
              {urlQ ? `No products found for “${urlQ}”` : "No products match these filters"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {active > 0 ? "Try removing a filter, or " : "Check the part number, or "}browse a category instead.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {active > 0 && (
                <Button className="h-10 rounded-full px-5" onClick={clear}>
                  Clear filters
                </Button>
              )}
              {urlQ && (
                <Button asChild variant="outline" className="h-10 rounded-full px-5">
                  <Link href="/products">See all products</Link>
                </Button>
              )}
              {categories.slice(0, 4).map((c) => (
                <a
                  key={c.name}
                  href={`/products?cat=${encodeURIComponent(c.name)}`}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:border-foreground hover:text-foreground"
                >
                  {c.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {shown < list.length && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" className="h-10 w-52" onClick={() => setShown(shown + STEP)}>
              Load More
            </Button>
          </div>
        )}
        <div className="hidden h-16 lg:block" aria-hidden />
      </div>
    </div>
  );
}
