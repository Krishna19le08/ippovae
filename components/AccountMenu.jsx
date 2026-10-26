"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardList, LogOut, Package, ShoppingCart, Store, Tag, User, UserRound, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const BEARINGS = ["Ball Bearings", "Roller Bearings", "Mounted Bearings", "Thrust Bearings"];

const SHOP_LINKS = [
  ["All Products", "/products", Store],
  ["Bearings", `/products?cat=${encodeURIComponent(BEARINGS.join(","))}`, Layers],
  ["Belts", "/products?cat=Belts", Package],
  ["Featured Products", "/#products", Tag],
];

export default function AccountMenu({ user, label, onSignIn, onSignUp, onProfile, onCart, onSignOut, triggerRef }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (box.current?.contains(document.activeElement)) triggerRef?.current?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const act = (fn) => () => {
    setOpen(false);
    fn();
  };
  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-accent hover:text-foreground";

  return (
    <div ref={box} className="relative" onMouseEnter={() => matchMedia("(hover: hover)").matches && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? "account-panel" : undefined}
        aria-label={user ? `My account${label ? `, ${label}` : ""}` : "Login"}
        className="group flex h-11 items-center gap-2.5 rounded-full pr-1 text-sm font-semibold whitespace-nowrap text-white transition-colors md:pr-3"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors group-hover:bg-primary/85">
          <User className="size-5" />
        </span>
        <span className="hidden max-w-24 truncate md:inline">{user ? label : "Login"}</span>
        <ChevronDown className={`hidden size-4 text-white/70 transition-transform md:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        // the pt-3 bridges the gap so the hover doesn't drop between the button and the panel
        <div id="account-panel" className="absolute top-full right-0 z-[60] w-[min(92vw,26rem)] pt-3">
          <span className="absolute top-1.5 right-6 size-3 rotate-45 rounded-md bg-white ring-1 ring-black/5" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl bg-white text-foreground shadow-2xl ring-1 ring-black/5 [--ring:#0b0b0b]">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 px-5 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground uppercase">
                  {label?.[0] || <UserRound className="size-5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">Hello, {label}</p>
                  <p className="truncate text-xs text-muted-foreground">{user}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 px-5 py-4 text-center">
                <Button onClick={act(onSignIn)} className="h-10 w-full rounded-lg">
                  Sign in
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  New customer?{" "}
                  <button type="button" onClick={act(onSignUp)} className="font-semibold text-foreground underline underline-offset-4">
                    Start here.
                  </button>
                </p>
              </div>
            )}

            <div className="grid gap-4 p-3 sm:grid-cols-2 sm:gap-2">
              <div className="grid content-start gap-0.5">
                <p className="px-2.5 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Shop</p>
                {SHOP_LINKS.map(([n, href, Icon]) => (
                  <Link key={n} href={href} onClick={() => setOpen(false)} className={item}>
                    <Icon className="size-4 shrink-0 text-muted-foreground" /> {n}
                  </Link>
                ))}
              </div>
              <div className="grid content-start gap-0.5 sm:border-l sm:border-slate-200 sm:pl-2">
                <p className="px-2.5 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Your Account</p>
                <button type="button" onClick={act(user ? onProfile : onSignIn)} className={item}>
                  <UserRound className="size-4 shrink-0 text-muted-foreground" /> Your Profile
                </button>
                <Link href="/orders" onClick={() => setOpen(false)} className={item}>
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" /> Your Orders
                </Link>
                <button type="button" onClick={act(onCart)} className={item}>
                  <ShoppingCart className="size-4 shrink-0 text-muted-foreground" /> Your Cart
                </button>
                {user && (
                  <button type="button" onClick={act(onSignOut)} className={`${item} hover:bg-red-50 hover:text-red-600`}>
                    <LogOut className="size-4 shrink-0 text-muted-foreground" /> Sign Out
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
