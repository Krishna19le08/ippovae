import { Fragment, Suspense } from "react";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import AllProducts from "@/components/pages/AllProducts";

// Title follows the filter: one category, a search query, or the plain listing.
function useTitle() {
  const sp = useSearchParams();
  const q = (sp?.get("q") || "").trim();
  const cats = (sp?.get("cat") || "").split(",").filter(Boolean);
  if (q) return `Results for “${q}” | ippovae`;
  if (cats.length === 1) return `${cats[0]} | ippovae`;
  return "All Products | ippovae";
}

export default function ProductsPage() {
  const title = useTitle();
  return (
    <Fragment>
      <Head><title>{title}</title></Head>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1312px] px-4 pt-10 pb-10 outline-none max-lg:pt-0 lg:pb-0">
        <Suspense>
          <AllProducts />
        </Suspense>
      </main>
    </Fragment>
  );
}
