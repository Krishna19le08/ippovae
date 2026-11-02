import { Fragment } from "react";
import ProductDetail from "@/features/catalog/components/ProductDetail";
import { products } from "@/data";

// Seed products are pre-built; other slugs (added in the local admin) render on demand. The body is a client
// component, so it shows this browser's catalog and its own not-found state.
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = products.find((x) => x.slug === slug);
  return { title: p ? `${p.name} | ippovae` : "Product not found | ippovae" };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  return (
    <Fragment>
      <ProductDetail slug={slug} />
    </Fragment>
  );
}
