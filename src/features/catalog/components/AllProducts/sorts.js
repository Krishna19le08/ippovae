// Sort options for the product list: key -> [label, comparator]. "featured" keeps the catalog order.
export const sorts = {
  featured: ["Featured", null],
  low: ["Price: Low to High", (a, b) => a.price - b.price],
  high: ["Price: High to Low", (a, b) => b.price - a.price],
  name: ["Name: A to Z", (a, b) => a.name.localeCompare(b.name)],
};
