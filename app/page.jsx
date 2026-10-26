import { withBase } from "@/lib/asset";
import {
  ArrowRight,
  Truck,
  Layers,
  Store,
  MousePointerClick,
  BadgeCheck,
  Boxes,
} from "lucide-react";
import Choreo from "@/components/Choreo";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Products from "@/components/Products";
import CategoryTiles from "@/components/CategoryTiles";
import { Button } from "@/components/ui/button";
import { SHOP, HUB, SITE, socials, categories, products } from "@/lib/data";

const industries = [
  ["Manufacturing", "/images/manufacturing.jpg"],
  ["Textile", "/images/textile.jpg"],
  ["Heavy Industry", "/images/machinery.jpg"],
  ["Material Handling", "/images/conveyor.jpg"],
];

const why = [
  [Truck, "Fast Delivery", "Quick dispatch"],
  [Layers, "Wide Product Range", "Bearings, belts & more"],
  [BadgeCheck, "Listed Prices", "Clear ₹ pricing online"],
  [Boxes, "One Catalogue", "Everything in one shop"],
  [MousePointerClick, "Easy Ordering", "Add to cart, check out"],
  [Store, "ippovae Hub", "Critical materials marketplace"],
];

const brands = ["Royal Bearings", "Mithra Engineering"];

const stats = [
  [products.length, "Parts listed"],
  [categories.length, "Categories"],
  [brands.length, "Brands"],
];


export default function Home() {
  return (
    <>
      <Choreo />
      <Header />

      <main id="main-content" tabIndex={-1} className="outline-none">
        <Hero />

        <section id="categories" className="mx-auto max-w-[1312px] scroll-mt-40 px-4 pt-12">
          <div className="mb-5">
            <h2 className="text-2xl font-bold tracking-tight">Shop by category</h2>
          </div>
          <CategoryTiles />
        </section>

        <Products />
        <Products title="Ball bearings" cat="Ball Bearings" href="/products?cat=Ball%20Bearings" />
        <Products title="Belts" cat="Belts" href="/products?cat=Belts" />
        <Products title="Mounted bearings" cat="Mounted Bearings" href="/products?cat=Mounted%20Bearings" />

        <section id="brands" className="mx-auto max-w-[1312px] scroll-mt-40 px-4 pt-12">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Brands We Supply</h2>
          <div className="flex flex-wrap gap-4">
            {brands.map((b) => (
              <div
                key={b}
                className="flex h-20 min-w-60 items-center justify-center rounded-lg border bg-white px-8 text-xl font-bold tracking-tight text-ink transition-colors hover:border-ink/30"
              >
                {b}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1312px] gap-5 px-4 pt-12 md:grid-cols-2">
          {[
            ["bearings", "Bearings for Every Application", "Deep groove, spherical roller, thrust and mounted units.", "Shop Bearings"],
            ["conveyor", "Belts from ₹194", "Belt fenners and belts in A, B and C sections.", "Shop Belts"],
          ].map(([img, t, d, cta]) => (
            <a
              key={img}
              href={SHOP}
              className="group relative flex min-h-64 items-center overflow-hidden rounded-xl surface-ink bg-ink bg-cover bg-center p-8 text-white"
              style={{ backgroundImage: `url(${withBase(`/images/${img}.jpg`)})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-transparent" />
              <div className="relative max-w-xs">
                <h3 className="text-3xl leading-tight font-bold tracking-[-0.03em]">{t}</h3>
                <p className="mt-2 text-sm text-white/80">{d}</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all group-hover:gap-3">
                  {cta} <ArrowRight className="size-4" />
                </span>
              </div>
            </a>
          ))}
        </section>

        <section className="mx-auto max-w-[1312px] px-4 pt-12">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Parts for Every Industry</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {industries.map(([n, src]) => (
              <a key={n} href={SHOP} className="group relative block aspect-[4/3] overflow-hidden rounded-xl">
                <img
                  src={withBase(src)}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover grayscale-[40%] transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <span className="absolute bottom-3 left-3 flex items-center gap-2 font-semibold text-white">
                  {n}
                  <ArrowRight className="size-4 -translate-x-1 text-lime opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1312px] px-4 pt-12">
          <h2 className="mb-5 text-2xl font-bold tracking-tight">Why Choose ippovae?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {why.map(([Icon, t, d]) => (
              <div key={t} className="lift flex items-center gap-4 rounded-lg border bg-white p-5">
                <Icon className="size-9 shrink-0 text-foreground" strokeWidth={1.5} />
                <div className="leading-tight">
                  <div className="text-base font-semibold">{t}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="relative mt-16 surface-ink bg-ink bg-cover bg-center text-white"
          style={{ backgroundImage: `url(${withBase("/images/warehouse.jpg")})` }}
        >
          <div className="bg-blueprint absolute inset-0 bg-ink/90" />
          <div className="relative mx-auto grid max-w-[1312px] items-center gap-8 px-4 py-16 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 className="text-3xl leading-[1.1] font-bold tracking-[-0.035em] sm:text-4xl md:text-5xl md:leading-[1.05]">
                Building India&apos;s digital infrastructure for critical materials
              </h2>
              <p className="mt-3 max-w-lg text-white/80">
                ippovae Hub connects producers, recyclers, buyers and K Hubs through one intelligent marketplace.
              </p>
              <Button asChild variant="outline" className="mt-8 rounded-full bg-white px-6 text-ink max-md:h-11 hover:bg-primary">
                <a href={HUB}>
                  Explore ippovae Hub <ArrowRight />
                </a>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-paper p-5 text-center sm:gap-4 sm:p-8 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
              {stats.map(([n, l]) => (
                <div key={l}>
                  <div className="tnum text-2xl font-extrabold sm:text-4xl">{n}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="surface-ink border-t border-white/10 bg-ink text-sm text-white/50">
        <div className="mx-auto grid max-w-[1312px] gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
          <div>
            <img src={withBase("/logo.png")} alt="ippovae" width={118} height={40} className="-ml-2 h-12 w-auto" />
            <p className="mt-2 text-base font-medium text-white/80">Parts at your doorstep.</p>
            <p className="mt-4 max-w-xs leading-relaxed text-white/50">
              Industrial spare parts, bearings, belts and more, with fast delivery.
            </p>
          </div>
          {[
            ["Quick Links", [["Categories", "#categories"], ["Products", "/products"], ["Brands", "#brands"]]],
            ["Shop", [["Catalogue", SHOP], ["ippovae Hub", HUB], ["Contact", `${SITE}/faq`]]],
            ["Follow", socials],
          ].map(([title, links]) => (
            <div key={title} className="grid content-start gap-3 lg:border-l lg:border-white/10 lg:pl-8">
              <h2 className="font-mono text-xs font-semibold tracking-[0.16em] text-white/80 uppercase">{title}</h2>
              {links.map(([n, u]) => (
                <a key={n} href={u} className="w-fit py-1 max-md:py-3 text-white/50 transition-colors hover:text-white">
                  {n}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1312px] flex-wrap justify-between gap-2 px-4 py-4 text-xs">
            <span>© 2026 ippovae. An initiative of Kradin Tea Private Limited</span>
            <span>
              Photos from{" "}
              <a className="inline-block py-1 underline max-md:py-3" href="https://unsplash.com">
                Unsplash
              </a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
