"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";

const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select";

// App-style bottom navigation for phones and tablets. The product page keeps it (the sticky buy bar sits just above it);
// it steps aside while a text field is focused (keyboard) or a dialog/drawer is open.
export default function MobileTabBar({ covered, cart, signedIn, onSearch, onCart, onAccount }) {
  const path = usePathname() || "/";
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const onIn = (e) => setTyping(e.target instanceof Element && e.target.matches(FIELD));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  const home = path === "/";
  const shop = path.startsWith("/products");
  const tab = "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors active:bg-white/10";
  const tone = (on) => (on ? "text-white" : "text-white/60");
  const icon = "size-6";
  // the current tab gets a light bar on top and a heavier icon, not just brighter text
  const mark = (on) => on && <span aria-hidden="true" className="absolute top-0 h-0.5 w-9 rounded-full bg-lime" />;

  return (
    <nav
      aria-label="Main"
      inert={typing || covered}
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t surface-ink border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur transition-transform duration-200 motion-reduce:transition-none lg:hidden ${
        typing || covered ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <Link href="/" aria-current={home ? "page" : undefined} className={`${tab} ${tone(home)}`}>
        {mark(home)}
        <House className={icon} strokeWidth={home ? 2.5 : 2} aria-hidden="true" />
        Home
      </Link>
      <Link href="/products" aria-current={shop ? "page" : undefined} className={`${tab} ${tone(shop)}`}>
        {mark(shop)}
        <LayoutGrid className={icon} strokeWidth={shop ? 2.5 : 2} aria-hidden="true" />
        Shop
      </Link>
      <button type="button" onClick={onSearch} className={`${tab} ${tone(false)}`}>
        <Search className={icon} aria-hidden="true" />
        Search
      </button>
      <button type="button" onClick={onCart} className={`${tab} ${tone(false)}`}>
        <span data-cart-target className="relative">
          <ShoppingCart className={icon} aria-hidden="true" />
          {cart > 0 && (
            <span aria-hidden="true" className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
              {cart}
            </span>
          )}
        </span>
        <span>
          Cart<span className="sr-only">, {cart} {cart === 1 ? "item" : "items"}</span>
        </span>
      </button>
      <button type="button" onClick={onAccount} className={`${tab} ${tone(false)}`}>
        <User className={icon} aria-hidden="true" />
        {signedIn ? "Account" : "Login"}
      </button>
    </nav>
  );
}
