"use client";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/common/BackButton";
import ProductCard from "@/components/catalog/ProductCard";
import { categories as seedCategories } from "@/data";
import { useCatalog, liveCategories } from "@/components/catalog/catalogStore";
import ActiveFilters from "./ActiveFilters";
import EmptyResults from "./EmptyResults";
import FilterDrawer from "./FilterDrawer";
import FilterPanel from "./FilterPanel";
import SortMenu from "./SortMenu";
import { useProductFilters } from "./useProductFilters";

const countLabel = (n) => `${n} ${n === 1 ? "product" : "products"}`;

// The /products page body: filters (sidebar on desktop, drawer on mobile), sort, and the product grid.
export default function AllProducts() {
  const { list: products } = useCatalog();
  const params = useSearchParams() ?? new URLSearchParams();
  const query = params.get("q") || "";

  const brandNames = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const categories = useMemo(() => liveCategories(products, seedCategories), [products]);

  const filters = useProductFilters({
    products,
    brandNames,
    urlCats: params.get("cat"),
    urlBrands: params.get("brand"),
    query,
  });
  const { list, shown, activeCount } = filters;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [categorySearch, setCategorySearch] = useState("");

  const heading = query ? `Results for “${query}”` : filters.cats.length === 1 ? filters.cats[0] : "All Products";

  const panel = (
    <FilterPanel
      filters={filters}
      categories={categories}
      brandNames={brandNames}
      categorySearch={categorySearch}
      onCategorySearch={setCategorySearch}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
      {/* desktop sidebar */}
      <aside className="hidden self-start overflow-hidden rounded-md border border-border bg-white lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100svh-7rem)] lg:flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <p className="flex items-center gap-2 text-base font-bold">
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full border border-foreground bg-primary text-[11px] leading-none font-semibold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </p>
          {activeCount > 0 && (
            <button onClick={filters.clear} className="text-xs font-medium text-foreground underline underline-offset-4">
              Clear all
            </button>
          )}
        </div>
        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-2 pl-5">
          <div className="pr-1">{panel}</div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-white to-transparent" aria-hidden />
      </aside>

      <FilterDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        activeCount={activeCount}
        resultCount={list.length}
        onClear={filters.clear}
      >
        {panel}
      </FilterDrawer>

      <div className="min-w-0">
        <div className="sticky top-[63px] z-20 -mx-4 mb-4 border-b border-slate-200/70 bg-white px-4 pt-4 pb-3 md:top-[68px]">
          <div className="flex items-center gap-3">
            <BackButton fallback="/" label="" className="mb-0 size-9 max-md:size-11 justify-center rounded-full border border-border hover:bg-accent hover:no-underline" />
            <h1 className="text-2xl font-bold">{heading}</h1>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {countLabel(list.length)}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">{countLabel(list.length)}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-10 lg:hidden" onClick={() => setDrawerOpen(true)}>
                <SlidersHorizontal /> Filters{activeCount > 0 && ` (${activeCount})`}
              </Button>
              <SortMenu value={filters.sort} onChange={filters.setSort} />
            </div>
          </div>
        </div>

        {activeCount > 0 && <ActiveFilters filters={filters} />}

        {list.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {list.slice(0, shown).map((p) => (
              <ProductCard key={p.slug} p={p} />
            ))}
          </div>
        ) : (
          <EmptyResults query={query} hasFilters={activeCount > 0} categories={categories} onClear={filters.clear} />
        )}

        {shown < list.length && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" className="h-10 w-52" onClick={filters.showMore}>
              Load More
            </Button>
          </div>
        )}
        <div className="hidden h-16 lg:block" aria-hidden />
      </div>
    </div>
  );
}
