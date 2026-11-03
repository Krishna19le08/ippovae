import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shown when no product matches: explains why and offers a way out.
export default function EmptyResults({ query, hasFilters, categories, onClear }) {
  return (
    <div role="status" className="rounded-2xl border border-dashed p-10 text-center md:p-12">
      <p className="text-lg font-semibold text-foreground">
        {query ? `No products found for “${query}”` : "No products match these filters"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters ? "Try removing a filter, or " : "Check the part number, or "}browse a category instead.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {hasFilters && (
          <Button className="h-10 rounded-full px-5" onClick={onClear}>
            Clear filters
          </Button>
        )}
        {query && (
          <Button asChild variant="outline" className="h-10 rounded-full px-5">
            <Link href="/products">See all products</Link>
          </Button>
        )}
        {categories.slice(0, 4).map((c) => (
          <Link
            key={c.name}
            href={`/products?cat=${encodeURIComponent(c.name)}`}
            className="rounded-full border border-border px-4 py-2.5 text-sm font-medium hover:border-foreground hover:text-foreground"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
