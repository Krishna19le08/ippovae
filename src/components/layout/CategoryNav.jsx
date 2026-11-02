import Link from "next/link";
import { Menu } from "@/components/ui/icons";
import { HUB, SITE } from "@/features/catalog/data";

// The category links under the header (large screens only).
export default function CategoryNav({ categories }) {
  return (
    <nav aria-label="Categories" className="hidden border-b border-border bg-white lg:block">
      <div className="mx-auto flex max-w-[1312px] items-center gap-1 overflow-x-auto px-4 text-sm font-medium no-scrollbar">
        <Link href="/products" className="mr-2 flex shrink-0 items-center gap-2 border-r border-border py-3 pr-5 font-bold">
          <Menu className="size-4" /> All products
        </Link>
        {categories
          .filter((c) => c.name !== "Sheet")
          .map((c) => (
            <Link
              key={c.name}
              href={`/products?cat=${encodeURIComponent(c.name)}`}
              className="shrink-0 border-b-2 border-transparent px-3 py-3 text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        <span className="ml-auto hidden shrink-0 gap-4 pl-4 text-muted-foreground min-[1200px]:flex">
          <a href={HUB} className="hover:text-foreground">ippovae Hub</a>
          <a href={SITE} className="hover:text-foreground">About us</a>
        </span>
      </div>
    </nav>
  );
}
