"use client";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import ProductCard from "@/components/ProductCard";
import { FEATURED } from "@/lib/data";
import { useCatalog } from "@/lib/admin/catalog";

// A horizontal shelf of products. With no props it shows the featured parts.
export default function Products({ title = "Popular parts", cat, href = "/products" }) {
  const { list: products } = useCatalog();
  const items = cat
    ? products.filter((p) => p.cat === cat).slice(0, 5)
    : FEATURED.map((slug) => products.find((p) => p.slug === slug))
        .filter(Boolean)
        .slice(0, 5);
  return (
    <section id={cat ? undefined : "products"} className="mx-auto max-w-[1312px] scroll-mt-40 px-4 pt-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <Link
          href={href}
          aria-label={`See more ${title}`}
          className="group flex shrink-0 items-center gap-1.5 py-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          See more
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 no-scrollbar">
        {items.map((p) => (
          <div key={p.slug} className="flex w-[46%] shrink-0 snap-start [&>*]:w-full md:w-[31%] xl:w-[calc((100%-4rem)/5)]">
            <ProductCard p={p} />
          </div>
        ))}
        <div className="flex w-[46%] shrink-0 snap-start md:w-[31%] xl:w-[calc((100%-4rem)/5)]">
          <Link
            href={href}
            aria-label={`See all ${title}`}
            className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-foreground/40 bg-accent p-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent active:bg-accent"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="size-5" aria-hidden="true" />
            </span>
            See all
          </Link>
        </div>
      </div>
    </section>
  );
}
