"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, ClipboardList, ExternalLink, Layers, LogOut, MapPin, Package, ShoppingCart, Store, Tag, UserRound } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { HUB, SITE } from "@/lib/data";

const BEARINGS = ["Ball Bearings", "Roller Bearings", "Mounted Bearings", "Thrust Bearings"];

const SHOP_LINKS = [
  ["All products", "/products", Store],
  ["Bearings", `/products?cat=${encodeURIComponent(BEARINGS.join(","))}`, Layers],
  ["Belts", "/products?cat=Belts", Package],
  ["Featured products", "/#products", Tag],
];

const MORE_LINKS = [
  ["ippovae Hub", HUB],
  ["About us", SITE],
  ["Contact", `${SITE}/faq`],
];

const row = "flex min-h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-medium active:bg-slate-100";
const iconBox = "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-foreground";
const group = "overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100";
const heading = "px-1 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase";

function Row({ icon: Icon, children, ...p }) {
  return (
    <button type="button" className={row} {...p}>
      <span className={iconBox}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="flex-1">{children}</span>
      <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
    </button>
  );
}

// Phone "Account" page opened from the bottom tab bar: who you are, your stuff, shop shortcuts, and the site links.
export default function AccountSheet({ open, suspended, user, label, returnRef, onClose, onSignIn, onSignUp, onProfile, onCart, onSignOut }) {
  const dialogRef = useDialogFocus(open, returnRef);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || suspended) return; // a page opened on top of this one handles Escape itself
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, suspended, onClose]);

  if (!mounted) return null; // the portal target does not exist during server rendering

  const act = (fn) => () => {
    onClose();
    fn();
  };
  // full-screen pages (sign in, profile, addresses) open on top; Back lands here again
  const push = (fn) => () => fn();
  return createPortal(
    <div className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        className={`absolute inset-0 flex flex-col bg-slate-50 text-foreground transition-transform duration-300 motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} aria-label="Back" className="flex size-11 items-center justify-center rounded-full active:bg-slate-100">
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="text-lg font-bold">Account</h2>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {user ? (
            <div className="flex items-center gap-3 surface-ink rounded-2xl bg-ink px-4 py-4 text-white">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground uppercase">
                {label?.[0] || <UserRound className="size-6" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">Hello, {label}</p>
                <p className="truncate text-sm text-white/70">{user}</p>
              </div>
            </div>
          ) : (
            <div className="surface-ink rounded-2xl bg-ink px-4 py-5 text-white">
              <p className="text-lg font-semibold">Sign in to ippovae</p>
              <p className="mt-1 text-sm text-white/70">Track orders and check out faster.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button onClick={push(onSignIn)} className="h-11 rounded-xl">
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={push(onSignUp)}
                  className="h-11 rounded-xl border border-white/30 text-sm font-semibold active:bg-white/10"
                >
                  Create account
                </button>
              </div>
            </div>
          )}

          <section>
            <h3 className={heading}>Your account</h3>
            <div className={group}>
              {user && (
                <>
                  <Row icon={UserRound} onClick={push(() => onProfile(""))}>
                    Your profile
                  </Row>
                  <Row icon={MapPin} onClick={push(() => onProfile("address"))}>
                    Saved addresses
                  </Row>
                </>
              )}
              <Link href="/orders" onClick={onClose} className={row}>
                <span className={iconBox}>
                  <ClipboardList className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="flex-1">Your orders</span>
                <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
              </Link>
              <Row icon={ShoppingCart} onClick={act(onCart)}>
                Your cart
              </Row>
            </div>
          </section>

          <section>
            <h3 className={heading}>Shop</h3>
            <div className={group}>
              {SHOP_LINKS.map(([name, href, Icon]) => (
                <Link key={name} href={href} onClick={onClose} className={row}>
                  <span className={iconBox}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{name}</span>
                  <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h3 className={heading}>More</h3>
            <div className={group}>
              {MORE_LINKS.map(([name, href]) => (
                <a key={name} href={href} className={row}>
                  <span className="flex-1 pl-1">{name}</span>
                  <ExternalLink className="size-4 text-slate-400" aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>

          {user && (
            <button
              type="button"
              onClick={act(onSignOut)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-red-600 active:bg-red-50"
            >
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
