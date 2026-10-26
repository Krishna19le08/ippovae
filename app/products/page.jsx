import { Suspense } from "react";
import Choreo from "@/components/Choreo";
import Header from "@/components/Header";
import AllProducts from "@/components/AllProducts";

// Title follows the filter: one category, a search query, or the plain listing.
export async function generateMetadata({ searchParams }) {
  // a static export (GitHub Pages) cannot read the query string on the server
  if (process.env.NEXT_PUBLIC_BASE_PATH) return { title: "All Products | ippovae" };
  const sp = await searchParams;
  const one = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const q = one(sp?.q).trim();
  const cats = one(sp?.cat).split(",").filter(Boolean);
  if (q) return { title: `Results for “${q}” | ippovae` };
  if (cats.length === 1) return { title: `${cats[0]} | ippovae` };
  return { title: "All Products | ippovae" };
}

export default function ProductsPage() {
  return (
    <>
      <Choreo />
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1312px] px-4 pt-10 pb-10 outline-none max-lg:pt-0 lg:pb-0">
        <Suspense>
          <AllProducts />
        </Suspense>
      </main>
    </>
  );
}
