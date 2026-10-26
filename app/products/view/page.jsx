"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import ProductDetail from "@/components/ProductDetail";

// Product page for products added in the local admin: they have no pre-built page, so the slug comes from ?slug=.
function View() {
  const slug = useSearchParams().get("slug") || "";
  return <ProductDetail slug={slug} />;
}

export default function ProductViewPage() {
  return (
    <>
      <Header />
      <Suspense>
        <View />
      </Suspense>
    </>
  );
}
