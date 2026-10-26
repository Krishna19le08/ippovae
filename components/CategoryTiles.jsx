"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categories as baseCats, SHOP } from "@/lib/data";
import { useCatalog, liveCategories } from "@/lib/admin/catalog";

// Round category icons, like a shopping app's top row.
export default function CategoryTiles() {
  const { list } = useCatalog();
  const categories = liveCategories(list, baseCats);
  return (
    <div className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-2 no-scrollbar md:justify-between md:gap-4">
      {categories.map((c) => (
        <Link
          key={c.name}
          href={`/products?cat=${encodeURIComponent(c.name)}`}
          className="group flex w-24 shrink-0 flex-col items-center text-center md:w-28"
        >
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-border bg-white transition-all duration-300 group-hover:border-foreground group-hover:shadow-[0_12px_30px_-12px_rgb(11_11_11/0.25)] md:size-28">
            <img
              src={c.img}
              alt=""
              loading="lazy"
              className="size-4/5 object-contain mix-blend-multiply brightness-[1.06] contrast-[1.12] transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div className="mt-2.5 text-sm leading-tight font-semibold group-hover:text-foreground">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.count} {c.count === 1 ? "item" : "items"}</div>
        </Link>
      ))}
      <a href={SHOP} className="group flex w-24 shrink-0 flex-col items-center text-center md:w-28">
        <div className="flex size-24 items-center justify-center rounded-full border border-dashed border-foreground/40 bg-accent text-foreground transition-all duration-300 group-hover:border-foreground group-hover:bg-accent md:size-28">
          <ArrowRight className="size-7" aria-hidden="true" />
        </div>
        <div className="mt-2.5 text-sm leading-tight font-semibold text-foreground">View on oknow.co.in</div>
      </a>
    </div>
  );
}
