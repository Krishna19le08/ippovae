"use client";
import { useEffect } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronRight, PackageX, ShieldCheck, Truck } from "@/components/icons";
import MessageUs from "@/components/MessageUs";
import ProductCard from "@/components/ProductCard";
import AddToCart from "@/components/AddToCart";
import BackButton from "@/components/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/data";
import { useCatalog } from "@/lib/admin/catalog";

const ABOUT = {
  "Ball Bearings": "Ball bearings use rolling steel balls to reduce friction between moving parts. They suit electric motors, pumps, fans and general machinery, handling both radial and light axial loads at high speeds.",
  "Roller Bearings": "Roller bearings use cylindrical or spherical rollers to carry heavier loads than ball bearings. They are used in gearboxes, crushers, conveyors and other heavy-duty industrial equipment.",
  "Mounted Bearings": "Mounted bearings come pre-assembled in a housing, so they bolt straight onto a frame. They make shaft installation and replacement quick on conveyors, agricultural and industrial machines.",
  "Thrust Bearings": "Thrust bearings are designed to carry axial loads along the shaft. They are used in vertical pumps, gearboxes and other equipment where the main force pushes along the shaft.",
  Belts: "Power transmission belts move drive from the motor to the machine smoothly and quietly. Choose the belt section and length that match your pulleys.",
  Sleeves: "Adapter sleeves fix a bearing with a tapered bore onto a straight shaft, giving a secure fit and easy mounting and removal.",
  "Hardware & Machines": "Industrial hardware and machines supplied for workshops, farms and factories.",
};

const mainCls = "mx-auto max-w-[1312px] px-4 pt-6 pb-28 outline-none md:pb-16";

// Product page body. Reads the entry from the catalogue: the seed data on first render (matches the exported HTML),
// then the merged list including this browser's admin edits.
export default function ProductDetail({ slug }) {
  const { list, ready } = useCatalog({ includeHidden: true });
  const p = list.find((x) => x.slug === slug);
  const title = p && !p.hidden ? `${p.name} | ippovae` : ready ? "Product unavailable | ippovae" : "";
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  if (!p || p.hidden) {
    // an admin-added product is not in the seed list: wait for the stored catalogue before calling it unavailable
    if (!ready) return <main id="main-content" tabIndex={-1} className={`${mainCls} min-h-[50vh]`} aria-busy="true" />;
    return (
      <main id="main-content" tabIndex={-1} className={mainCls}>
        <div className="mb-5">
          <BackButton label="" className="mb-0 size-9 max-md:size-11 shrink-0 justify-center rounded-full border border-border hover:bg-accent hover:no-underline" />
        </div>
        <div role="status" className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
          <PackageX className="size-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-bold">This product is unavailable</h1>
          <p className="text-sm text-muted-foreground">It is no longer listed. You can browse the rest of our parts.</p>
          <Button asChild className="mt-2 h-11 rounded-xl px-8">
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      </main>
    );
  }

  const related = list.filter((x) => !x.hidden && x.cat === p.cat && x.slug !== p.slug).slice(0, 4);

  return (
      <main id="main-content" tabIndex={-1} className={mainCls}>
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 md:flex-nowrap">
        <BackButton label="" className="mb-0 size-9 max-md:size-11 shrink-0 justify-center rounded-full border border-border hover:bg-accent hover:no-underline" />
        <span className="hidden h-4 w-px bg-slate-300 sm:block" />
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted-foreground max-md:basis-full">
          <Link href="/" className="shrink-0 py-1.5 max-md:py-3 hover:text-foreground">Home</Link>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          <Link href="/products" className="shrink-0 py-1.5 max-md:py-3 hover:text-foreground">Products</Link>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
          <Link href={`/products?cat=${encodeURIComponent(p.cat)}`} className="hidden shrink-0 py-1.5 max-md:py-3 hover:text-foreground sm:block">{p.cat}</Link>
          <ChevronRight className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
          <span aria-current="page" className="truncate font-medium text-foreground">{p.name}</span>
        </nav>
        </div>

        <div className="grid items-start gap-6 rounded-md border border-border bg-white p-4 md:grid-cols-[minmax(0,460px)_1fr] md:p-8 lg:gap-12">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-paper md:sticky md:top-24">
            <img src={p.img} alt={p.name} className="size-full object-contain p-8 mix-blend-multiply" />
            {p.tag && <Badge className="absolute top-3 left-3">{p.tag}</Badge>}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <Badge variant="secondary" className="mb-3">{p.cat}</Badge>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{p.name}</h1>
              {p.brand && <p className="mt-1 text-sm text-muted-foreground">by {p.brand}</p>}
            </div>

            <div className="rounded-md border-l-4 border-foreground bg-accent p-4">
              <div className="flex items-baseline gap-3">
                <span className="tnum text-4xl font-extrabold text-foreground">{inr(p.price)}</span>
                {p.was && <span className="text-lg text-muted-foreground line-through">{inr(p.was)}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>
            </div>

            <section>
              <h2 className="mb-1 text-sm font-semibold">Description</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.name} is available from ippovae at {inr(p.price)}. {ABOUT[p.cat] || ""}
              </p>
            </section>

            <AddToCart slug={p.slug} price={p.price} />

            <div className="flex flex-col gap-3 rounded-md border border-dashed border-foreground/40 p-3 text-sm xl:flex-row xl:items-center xl:justify-between">
              <p className="text-muted-foreground">Need a larger quantity? Ask for a bulk quote.</p>
              <MessageUs
                label="Request a quote"
                title="Request a quote"
                hint={`Tell us how many you need. We'll reply on WhatsApp with a quote for ${p.name}.`}
                prefill={`I'd like a quote for ${p.name} (${p.cat}). Quantity needed: `}
                placeholder="Quantity needed"
                icon="quote"
                className="h-11 w-full shrink-0 rounded-xl border-foreground px-5 text-foreground xl:w-auto"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-5 text-xs min-[460px]:grid-cols-3 min-[460px]:text-center">
              {[
                [Truck, "Fast delivery", "Across India"],
                [BadgeCheck, "Clear pricing", "No hidden costs"],
                [ShieldCheck, "Secure payment", "UPI, card, COD"],
              ].map(([Icon, t, d]) => (
                <div key={t} className="flex items-center gap-3 rounded-md bg-paper p-3 min-[460px]:flex-col min-[460px]:gap-1">
                  <Icon className="size-6 shrink-0 text-foreground" />
                  <span className="flex flex-col min-[460px]:items-center">
                    <span className="font-semibold">{t}</span>
                    <span className="text-muted-foreground">{d}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight">More in {p.cat}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.slug} p={r} />
              ))}
            </div>
          </section>
        )}
      </main>
  );
}
