"use client";
import { withBase } from "@/lib/asset";
import Link from "next/link";
import MessageUs from "@/components/MessageUs";
import { ArrowRight, Truck, BadgeCheck, Headset, CreditCard } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/data";
import { useCatalog, productHref } from "@/lib/admin/catalog";

const tiles = [
  { cat: "Belts", title: "Belts", href: "/products?cat=Belts", tone: "bg-accent" },
  { cat: "Mounted Bearings", title: "Mounted bearings", href: "/products?cat=Mounted%20Bearings", tone: "bg-slate-100" },
];

const trust = [
  [Truck, "Same-day dispatch", "Coimbatore & Ooty"],
  [BadgeCheck, "Clear ₹ prices", "No quote wait"],
  [CreditCard, "Pay your way", "UPI, card, COD"],
  [Headset, "Talk to us", "Help finding a part"],
];

export default function Hero() {
  const { list: products } = useCatalog();
  const hero = products.find((p) => p.slug === "22212-bearing");
  const minOf = (cat) => Math.min(...products.filter((p) => p.cat === cat).map((p) => p.price));
  const sample = (cat) => products.find((p) => p.cat === cat);
  return (
    <section className="mx-auto max-w-[1312px] px-4 pt-4">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="relative isolate flex min-h-[22rem] items-center overflow-hidden surface-ink rounded-xl bg-ink p-7 text-white md:min-h-[26rem] md:p-12">
          <img src={withBase("/images/warehouse.jpg")} alt="" fetchPriority="high" className="absolute inset-0 -z-20 size-full object-cover opacity-40 grayscale" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/90 to-lime/15" />
          <div className="min-w-0 max-w-sm flex-1 xl:max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Same-day dispatch
            </span>
            <h1 className="mt-4 text-4xl leading-[1.02] font-bold tracking-[-0.03em] md:text-6xl">
              Line down?
              <br />
              <span className="text-lime">Get the part today.</span>
            </h1>
            <p className="mt-4 text-white/70">Bearings, belts and sleeves with clear ₹ prices. Add to cart and we ship.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full px-6 text-base">
                <Link href="/products">
                  Shop all parts <ArrowRight />
                </Link>
              </Button>
              <MessageUs className="h-11 rounded-full border-white/25 bg-transparent px-6 text-base text-white hover:bg-white hover:text-ink" />
            </div>
          </div>
          {hero && (
            <Link href={productHref(hero)} className="ml-6 hidden shrink-0 flex-col items-center text-center md:flex lg:hidden xl:ml-8 xl:flex">
              <div className="flex size-48 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_30px_80px_-20px_rgb(232_255_0/0.30)] xl:size-60">
                <img src={hero.img} alt={hero.name} className="size-full object-cover" />
              </div>
              <div className="mt-4 inline-flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm text-ink shadow-lg">
                <span className="font-semibold">{hero.name}</span>
                <span className="tnum font-bold text-foreground">{inr(hero.price)}</span>
              </div>
            </Link>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
          {tiles.map((t) => {
            const p = sample(t.cat);
            if (!p) return null;
            return (
              <Link key={t.cat} href={t.href} className={`group lift relative flex min-h-44 items-center justify-between overflow-hidden rounded-xl p-6 ${t.tone}`}>
                <div>
                  <div className="text-xl font-bold tracking-tight">{t.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">From {inr(minOf(t.cat))}</div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    Shop now <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
                {p && <img src={p.img} alt="" className="size-32 object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110 xl:size-36" />}
              </Link>
            );
          })}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-px overflow-hidden min-[440px]:grid-cols-2 rounded-xl border border-border bg-border lg:grid-cols-4">
        {trust.map(([Icon, t, d]) => (
          <li key={t} className="flex items-center gap-3 bg-white px-5 py-4">
            <Icon className="size-7 shrink-0 text-foreground" strokeWidth={1.5} />
            <div className="text-sm leading-tight">
              <div className="font-semibold">{t}</div>
              <div className="text-xs text-muted-foreground">{d}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
