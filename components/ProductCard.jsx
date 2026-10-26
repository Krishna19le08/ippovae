"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { inr } from "@/lib/data";
import CartButton from "@/components/CartButton";
import { productHref } from "@/lib/admin/catalog";

export default function ProductCard({ p }) {
  const off = p.was && p.was > p.price ? Math.round((1 - p.price / p.was) * 100) : 0;
  return (
    <Card className="lift min-w-0 gap-3 rounded-xl border-border p-2.5 shadow-none min-[400px]:p-3.5 hover:border-foreground/30">
      <Link href={productHref(p)} className="relative aspect-square overflow-hidden rounded-lg bg-paper">
        <img src={p.img} alt={p.name} loading="lazy" className="size-full object-contain p-3 mix-blend-multiply" />
        {p.tag && <Badge className="absolute top-2 left-2">{p.tag}</Badge>}
      </Link>
      <div className="px-1">
        <div className="line-clamp-1 text-xs text-muted-foreground">{p.cat}</div>
        <Link href={productHref(p)} className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-semibold hover:text-foreground">
          {p.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="tnum text-lg font-bold">{inr(p.price)}</span>
          {p.was && <span className="tnum text-xs text-muted-foreground line-through">{inr(p.was)}</span>}
          {off > 0 && <span className="text-xs font-semibold text-emerald-700">{off}% off</span>}
        </div>
        <div className="mt-1 text-xs text-emerald-700">Same-day dispatch</div>
      </div>
      <CartButton
        slug={p.slug}
        name={p.name}
        className="mt-auto h-10 w-full rounded-lg"
        btnClass="max-[399px]:gap-1.5 max-[399px]:px-2 max-[399px]:text-[13px] border-[1.5px] border-input bg-white bg-none text-foreground shadow-none hover:bg-primary hover:text-primary-foreground"
      />
    </Card>
  );
}
