import { useEffect, useState } from "react";
import { useAddresses } from "@/components/checkout/addresses";
import { useCatalog } from "@/components/catalog/catalogStore";

const readCart = () => {
  try {
    return JSON.parse(localStorage.getItem("kn-cart-items")) || {};
  } catch {
    return {};
  }
};

// What the checkout pages need: the stored cart matched to catalogue products, and the chosen delivery address.
// `ready` is false until the cart, catalogue and addresses have all loaded.
export function useCheckoutData() {
  const [items, setItems] = useState(null); // null until the stored cart has been read
  const { selected: address, ready: addressesReady } = useAddresses();
  const { list: catalog, ready: catalogReady } = useCatalog({ includeHidden: true });

  useEffect(() => setItems(readCart()), []);

  const lines = Object.entries(items || {})
    .map(([slug, qty]) => ({ slug, qty, p: catalog.find((x) => x.slug === slug) }))
    .filter((l) => l.p);
  const total = lines.reduce((sum, l) => sum + l.p.price * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return { lines, total, count, address, ready: items !== null && addressesReady && catalogReady };
}
