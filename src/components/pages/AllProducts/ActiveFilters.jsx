import { X } from "@/components/ui/icons";

// The applied filters as removable chips, plus a "Clear all" button.
export default function ActiveFilters({ filters }) {
  const chips = [
    ...filters.cats.map((name) => [name, () => filters.toggleCat(name)]),
    ...filters.brands.map((name) => [name, () => filters.toggleBrand(name)]),
    ...(filters.priceLabel ? [[filters.priceLabel, () => filters.setPriceRange("", "")]] : []),
    ...(filters.onSale ? [["On sale", () => filters.setOnSale(false)]] : []),
    ...(filters.newOnly ? [["New arrivals", () => filters.setNewOnly(false)]] : []),
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map(([label, remove]) => (
        <button
          key={label}
          onClick={remove}
          className="flex items-center gap-1 rounded-full bg-accent px-3 py-2 max-md:py-3 text-xs font-medium text-foreground hover:bg-accent"
        >
          {label} <X className="size-3" />
        </button>
      ))}
      <button onClick={filters.clear} className="px-2 py-2 max-md:py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
        Clear all
      </button>
    </div>
  );
}
