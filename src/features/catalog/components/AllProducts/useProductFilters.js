import { useMemo, useState } from "react";
import { sorts } from "./sorts";

export const PAGE_SIZE = 12;

const splitList = (value) => (value ? value.split(",") : []);
const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

// { key: how many items have that key }, skipping items without a key
function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) {
    const key = keyOf(item);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// Filter, sort and "load more" state for the product list, plus the resulting products and facet counts.
// ?cat=, ?brand= and ?q= from the URL seed the filters; `query` is the search text.
export function useProductFilters({ products, brandNames, urlCats, urlBrands, query }) {
  const brandsFromUrl = () => splitList(urlBrands).filter((b) => b && brandNames.includes(b));

  // seeded from the URL so server HTML matches the filtered view
  const [cats, setCats] = useState(() => splitList(urlCats));
  const [brands, setBrands] = useState(brandsFromUrl);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [onSale, setOnSale] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState("featured");
  const [shown, setShown] = useState(PAGE_SIZE);

  // header links / search change the URL: re-seed the filters during render (no effect, no flash)
  const urlKey = `${urlCats || ""}|${query}|${urlBrands || ""}`;
  const [seenUrlKey, setSeenUrlKey] = useState(urlKey);
  if (seenUrlKey !== urlKey) {
    setSeenUrlKey(urlKey);
    setCats(splitList(urlCats));
    setBrands(brandsFromUrl());
    setShown(PAGE_SIZE);
  }

  // Changing a filter sends the list back to the first page.
  const resetting = (setter) => (value) => {
    setter(value);
    setShown(PAGE_SIZE);
  };

  // everything except category and brand, so their counts reflect the other filters
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lo = min === "" ? -Infinity : Number(min);
    const hi = max === "" ? Infinity : Number(max);
    return products.filter(
      (p) =>
        p.price >= lo &&
        p.price <= hi &&
        (!onSale || p.was) &&
        (!newOnly || p.tag === "New") &&
        (!q || `${p.name} ${p.cat} ${p.brand || ""}`.toLowerCase().includes(q)),
    );
  }, [products, min, max, onSale, newOnly, query]);

  // category counts respect the brand choice, brand counts respect the category choice
  const catCounts = useMemo(
    () => countBy(matching.filter((p) => !brands.length || brands.includes(p.brand)), (p) => p.cat),
    [matching, brands],
  );
  const brandCounts = useMemo(
    () => countBy(matching.filter((p) => !cats.length || cats.includes(p.cat)), (p) => p.brand),
    [matching, cats],
  );

  const list = useMemo(() => {
    const result = matching.filter((p) => (!cats.length || cats.includes(p.cat)) && (!brands.length || brands.includes(p.brand)));
    const compare = sorts[sort][1];
    return compare ? [...result].sort(compare) : result;
  }, [matching, cats, brands, sort]);

  const activeCount =
    cats.length + brands.length + Number(min !== "") + Number(max !== "") + Number(onSale) + Number(newOnly);
  const priceLabel = min !== "" || max !== "" ? `₹${min || 0} – ${max ? `₹${max}` : "any"}` : "";

  return {
    cats,
    brands,
    min,
    max,
    onSale,
    newOnly,
    sort,
    shown,
    list,
    catCounts,
    brandCounts,
    activeCount,
    priceLabel,
    toggleCat: (name) => resetting(setCats)(toggle(cats, name)),
    toggleBrand: (name) => resetting(setBrands)(toggle(brands, name)),
    setMin: resetting(setMin),
    setMax: resetting(setMax),
    setPriceRange: (lo, hi) => {
      setMin(lo);
      setMax(hi);
      setShown(PAGE_SIZE);
    },
    setOnSale: resetting(setOnSale),
    setNewOnly: resetting(setNewOnly),
    setSort,
    showMore: () => setShown(shown + PAGE_SIZE),
    clear: () => {
      setCats([]);
      setBrands([]);
      setMin("");
      setMax("");
      setOnSale(false);
      setNewOnly(false);
      setShown(PAGE_SIZE);
    },
  };
}
