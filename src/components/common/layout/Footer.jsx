import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white print:hidden">
      <div className="mx-auto flex max-w-[1312px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/products" className="hover:text-foreground">Products</Link>
          <Link href="/orders" className="hover:text-foreground">Orders</Link>
          <Link href="/help/tickets" className="hover:text-foreground">Help</Link>
        </nav>
      </div>
    </footer>
  );
}
