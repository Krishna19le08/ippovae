"use client";
import { Search } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import FilterSection from "./FilterSection";
import FilterCheckbox from "./FilterCheckbox";

// Quick price ranges: [label, min, max]. An empty string means "no limit".
const PRICE_PRESETS = [
  ["Under ₹500", "", "500"],
  ["₹500–2,000", "500", "2000"],
  ["Over ₹2,000", "2000", ""],
];

function PriceInput({ value, onChange, placeholder, label }) {
  return (
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
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// The filter groups (category, brand, price, offers). Rendered in the desktop sidebar and in the mobile drawer.
export default function FilterPanel({ filters, categories, brandNames, categorySearch, onCategorySearch }) {
  const { cats, brands, min, max, onSale, newOnly, catCounts, brandCounts } = filters;
  const visibleCategories = categories.filter((c) => c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()));

  return (
    <div className="divide-y divide-slate-200/80">
      <FilterSection title="Category">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={categorySearch}
            onChange={(e) => onCategorySearch(e.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="grid gap-0.5">
          {visibleCategories.map((c) => (
            <FilterCheckbox
              key={c.name}
              checked={cats.includes(c.name)}
              onChange={() => filters.toggleCat(c.name)}
              label={c.name}
              count={catCounts[c.name] || 0}
            />
          ))}
          {!visibleCategories.length && <p className="px-2.5 py-2 text-sm text-muted-foreground">No categories found</p>}
        </div>
      </FilterSection>

      {brandNames.length >= 2 && (
        <FilterSection title="Brand">
          <div className="grid gap-0.5">
            {brandNames.map((b) => (
              <FilterCheckbox
                key={b}
                checked={brands.includes(b)}
                onChange={() => filters.toggleBrand(b)}
                label={b}
                count={brandCounts[b] || 0}
              />
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="Price">
        <div className="flex items-center gap-2">
          <PriceInput value={min} onChange={filters.setMin} placeholder="Min" label="Minimum price" />
          <span className="text-muted-foreground">–</span>
          <PriceInput value={max} onChange={filters.setMax} placeholder="Max" label="Maximum price" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRICE_PRESETS.map(([label, lo, hi]) => {
            const selected = min === lo && max === hi;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => (selected ? filters.setPriceRange("", "") : filters.setPriceRange(lo, hi))}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  selected ? "border-foreground bg-accent text-foreground" : "border-input hover:border-foreground/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Offers">
        <div className="grid gap-0.5">
          <FilterCheckbox checked={onSale} onChange={() => filters.setOnSale(!onSale)} label="On sale" />
          <FilterCheckbox checked={newOnly} onChange={() => filters.setNewOnly(!newOnly)} label="New arrivals" />
        </div>
      </FilterSection>
    </div>
  );
}
