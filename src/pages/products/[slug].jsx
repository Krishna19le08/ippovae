import { Fragment } from "react";
import Head from "next/head";
import ProductDetail from "@/components/pages/ProductDetail";
import { products } from "@/data";

// Seed products are pre-built; other slugs (added in the local admin) render on demand. The body is a client
// component, so it shows this browser's catalog and its own not-found state.
export function getStaticPaths() {
  return { paths: products.map((p) => ({ params: { slug: p.slug } })), fallback: "blocking" };
}

export function getStaticProps({ params }) {
  return { props: { slug: params.slug } };
}

export default function ProductPage({ slug }) {
  const p = products.find((x) => x.slug === slug);
  return (
    <Fragment>
      <Head><title>{p ? `${p.name} | ippovae` : "Product not found | ippovae"}</title></Head>
      <ProductDetail slug={slug} />
    </Fragment>
  );
}
