import { notFound } from "next/navigation";
import Choreo from "@/components/Choreo";
import Header from "@/components/Header";
import ProductDetail from "@/components/ProductDetail";
import { products } from "@/lib/data";

// Seed products are exported as static pages; the body is a client component so this browser's admin edits apply.
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
  if (!products.some((x) => x.slug === slug)) notFound();

  return (
    <>
      <Choreo />
      <Header />
      <ProductDetail slug={slug} />
    </>
  );
}
