"use client";
import { withBase } from "@/lib/asset";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Search, ShoppingCart, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CartDrawer from "@/components/CartDrawer";
import LoginModal from "@/components/LoginModal";
import ProfileModal from "@/components/ProfileModal";
import AccountMenu from "@/components/AccountMenu";
import MobileTabBar from "@/components/MobileTabBar";
import AccountSheet from "@/components/AccountSheet";
import { getProfile, useAddresses, USER_EVENT } from "@/lib/addresses";
import { SHOP, HUB, SITE, categories as baseCats } from "@/lib/data";
import { useCatalog, liveCategories } from "@/lib/admin/catalog";

// set when a search is submitted: the next page's header takes focus back into the search box (navigation remounts it)
let refocusSearch = false;

export default function Header() {
  const [q, setQ] = useState("");
  const { list: products } = useCatalog();
  const categories = liveCategories(products, baseCats);
  const router = useRouter();
  const [searching, setSearching] = useState(true); // search bar is always visible
  const [items, setItems] = useState({}); // slug -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false); // phone Account page (tab bar)
  const [signupFirst, setSignupFirst] = useState(false); // open the login popup on "Create account"
  const [user, setUser] = useState(""); // signed-in email, "" when logged out
  const userRef = useRef("");
  const pendingCheckout = useRef(false); // user hit checkout while logged out; resume after login
  const [view, setView] = useState({ step: "cart", n: 0 }); // which drawer step to show; n bumps on each request
  const [done, setDone] = useState(false); // search submitted, hide suggestions
  const [loginForCheckout, setLoginForCheckout] = useState(false); // login opened from checkout: show context line
  const [active, setActive] = useState(-1); // highlighted suggestion (keyboard)
  const [announce, setAnnounce] = useState(""); // cart live-region message
  const prevCart = useRef(0);
  const [profileSection, setProfileSection] = useState(""); // "" | "address" | "address-new": where the profile dialog opens
  const { selected: deliverTo } = useAddresses();
  // where focus goes back to when a dialog closes and the control that opened it is gone (menu closed, drawer closed)
  const returnRef = useRef(null);
  const cartBtnRef = useRef(null);
  const acctRef = useRef(null);
  const userLabel = typeof window === "undefined" || !user ? "" : (localStorage.getItem("kn-user-name") || user).split(" ")[0];
  const cart = Object.values(items).reduce((s, n) => s + n, 0);

  const update = (fn) => setItems(fn);
  // true only after the stored cart has been read and applied in the same step (state, not a ref, so StrictMode's
  // double effect run cannot make the persist effect write the empty initial cart)
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef(null);

  // Typing re-renders the page; if that makes the browser jump to the top, put the scroll back.
  const keepScroll = () => {
    const y = window.scrollY;
    const restore = () => {
      if (Math.abs(window.scrollY - y) > 1) {
        if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(restore));
  };

  // Persist the cart and tell product cards what's in it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("kn-cart-items", JSON.stringify(items));
    } catch {}
    window.dispatchEvent(new CustomEvent("kn-cart-changed", { detail: items }));
  }, [items, hydrated]);

  // tell screen readers when the cart changes (not on the first load)
  useEffect(() => {
    if (!hydrated) return; // the stored cart is applied together with hydrated, and prevCart is seeded from it
    if (prevCart.current === cart) return;
    const added = cart > prevCart.current;
    prevCart.current = cart;
    setAnnounce(`${added ? "Added to cart" : "Cart updated"}. ${cart} ${cart === 1 ? "item" : "items"} in cart`);
  }, [cart, hydrated]);

  const setQty = (slug, qty) =>
    update((prev) => {
      const next = { ...prev };
      if (qty > 0) next[slug] = qty;
      else delete next[slug];
      return next;
    });

  // keep the search bar (and its text) after a search lands on /products?q=
  useEffect(() => {
    const text = new URLSearchParams(window.location.search).get("q");
    if (text) {
      setQ(text);
      setSearching(true);
      setDone(true);
    }
    if (refocusSearch) {
      refocusSearch = false;
      searchRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const readUser = () => {
    let u = "";
    try {
      u = localStorage.getItem("kn-user") || "";
    } catch {}
    const changed = userRef.current !== u;
    userRef.current = u;
    setUser(u);
    if (changed) window.dispatchEvent(new Event(USER_EVENT)); // saved addresses follow the signed-in user
    return u;
  };

  // checkout needs a signed-in user: ask for login first, then continue to the address step
  const startCheckout = () => {
    if (userRef.current) {
      pendingCheckout.current = false;
      setView((v) => ({ step: "address", n: v.n + 1 }));
      setCartOpen(true);
    } else {
      pendingCheckout.current = true;
      setLoginForCheckout(true);
      setCartOpen(false);
      setLoginOpen(true);
    }
  };

  // open the profile dialog; `from` is the control to give focus back to if the opener unmounts
  const openProfile = (section, from) => {
    returnRef.current = from || acctRef.current;
    if (!userRef.current) return openLogin(false);
    setProfileSection(section);
    setProfileOpen(true);
  };

  const openLogin = (signup) => {
    pendingCheckout.current = false; // plain login, not mid-checkout
    setLoginForCheckout(false);
    setSignupFirst(signup);
    setLoginOpen(true);
  };

  const signOut = () => {
    try {
      localStorage.removeItem("kn-user");
      localStorage.removeItem("kn-user-name");
    } catch {}
    readUser();
  };

  useEffect(() => {
    readUser();
    try {
      const stored = JSON.parse(localStorage.getItem("kn-cart-items")) || {};
      prevCart.current = Object.values(stored).reduce((s, n) => s + n, 0); // initial load is not announced
      setItems(stored);
    } catch {}
    setHydrated(true); // batched with setItems(stored) above
    const add = (e) => {
      const { slug, qty, buy } = typeof e.detail === "string" ? { slug: e.detail, qty: 1 } : e.detail;
      update((prev) => ({ ...prev, [slug]: (prev[slug] || 0) + qty }));
      if (buy) {
        returnRef.current = cartBtnRef.current;
        startCheckout();
      }
    };
    const set = (e) => setQty(e.detail.slug, e.detail.qty);
    // the orders page asks the header to open the cart or the sign-in popup
    const openCart = () => {
      returnRef.current = cartBtnRef.current;
      setView((v) => ({ step: "cart", n: v.n + 1 }));
      setCartOpen(true);
    };
    const openSignIn = () => {
      returnRef.current = acctRef.current;
      openLogin(false);
    };
    window.addEventListener("kn-cart-add", add);
    window.addEventListener("kn-cart-set", set);
    window.addEventListener("kn-open-cart", openCart);
    window.addEventListener("kn-open-login", openSignIn);
    return () => {
      window.removeEventListener("kn-cart-add", add);
      window.removeEventListener("kn-cart-set", set);
      window.removeEventListener("kn-open-cart", openCart);
      window.removeEventListener("kn-open-login", openSignIn);
    };
  }, []);

  // while a drawer or dialog is open the page behind must not scroll (wheel, keys, touch): stop Lenis and clip the root
  const locked = cartOpen || loginOpen || profileOpen || accountOpen;
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    window.lenis?.stop();
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
      window.lenis?.start();
    };
  }, [locked]);

  const term = q.trim().toLowerCase();
  const suggestions = term && !done
    ? products.filter((p) => `${p.name} ${p.cat} ${p.brand || ""}`.toLowerCase().includes(term)).slice(0, 6)
    : [];
  const open = suggestions.length > 0;
  const titleCase = (t) => String(t || "").toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
  const deliverPlace = deliverTo ? `${titleCase(deliverTo.city || deliverTo.name)} ${deliverTo.pincode}`.trim() : "Add delivery address";
  const deliverBtn = (cls) => (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(e) => {
        const from = e.currentTarget;
        openProfile(deliverTo ? "address" : "address-new", from);
      }}
      className={cls}
    >
      <MapPin className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-col text-left leading-tight">
        {deliverTo && <span className="text-[11px] font-normal text-white/70">Deliver to</span>}
        <span className="truncate font-semibold">{deliverPlace}</span>
      </span>
    </button>
  );

  const runSearch = (text) => {
    setQ(text);
    setDone(true);
    refocusSearch = true;
    setTimeout(() => (refocusSearch = false), 3000);
    searchRef.current?.focus({ preventScroll: true });
    router.push(`/products?q=${encodeURIComponent(text.trim())}`);
  };

  const submit = (e) => {
    e.preventDefault();
    runSearch(q);
  };

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>

      <div role="region" aria-label="Announcement" className="surface-ink hidden bg-ink font-mono md:block text-[11px] tracking-wide text-white/80 uppercase">
        <div className="mx-auto flex max-w-[1312px] items-center justify-between px-4 py-2">
          <span>Trusted supplier of bearings &amp; belts · Fast delivery</span>
          <span className="hidden gap-3 sm:flex">
            <a href={SHOP}>Catalogue</a>|<a href={HUB} className="normal-case">ippovae Hub</a>|
            <a href={`${SITE}/faq`}>Contact</a>
          </span>
        </div>
      </div>

      {/* shown only while the suggestion list is open (matches the input's aria-expanded) */}
      <div
        onClick={() => setDone(true)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <header className="sticky -top-[54px] z-50 border-b border-white/10 md:top-0 surface-ink bg-ink text-white">
        <div className="mx-auto flex max-w-[1312px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:flex-nowrap md:gap-8">
          <Link href="/" className="shrink-0">
            <img src={withBase("/logo.png")} alt="ippovae" width={118} height={40} className="h-10 w-auto md:h-12" />
          </Link>
          {deliverBtn("hidden min-h-11 max-w-52 shrink-0 xl:max-w-64 items-center gap-1.5 rounded-md px-1.5 text-left text-sm font-semibold text-white hover:text-lime lg:flex")}
          <div className="relative order-last min-w-0 basis-full md:order-none md:max-w-2xl md:flex-1 md:basis-auto">
            <form onSubmit={submit} className="relative flex rounded-md has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring">
              <Input
                ref={searchRef}
                value={q}
                role="combobox"
                aria-label="Search products"
                enterKeyHint="search"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={open ? "search-suggestions" : undefined}
                aria-activedescendant={open && active >= 0 ? `search-option-${active}` : undefined}
                onKeyDown={(e) => {
                  // an empty field has nothing to delete, so the browser would scroll the page up instead
                  if (e.key === "Backspace" && !e.currentTarget.value) e.preventDefault();
                  else if (e.key === "ArrowDown" && !open && term) {
                    e.preventDefault();
                    setDone(false); // reopen the list for the text that is there
                    setActive(-1);
                  } else if (e.key === "ArrowDown" && open) {
                    e.preventDefault();
                    setActive((a) => (a + 1) % suggestions.length);
                  } else if (e.key === "ArrowUp" && open) {
                    e.preventDefault();
                    setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
                  } else if (e.key === "Enter" && open && active >= 0) {
                    e.preventDefault();
                    runSearch(suggestions[active].name);
                  } else if (e.key === "Escape" && open) {
                    setDone(true); // close the list, keep the text
                    setActive(-1);
                  }
                }}
                onChange={(e) => {
                  keepScroll();
                  setQ(e.target.value);
                  setDone(false);
                  setActive(-1);
                }}
                className="h-11 rounded-r-none border-r-0 border-white bg-white text-foreground placeholder:text-slate-500 focus-visible:border-white focus-visible:outline-none"
              />
              {!q && (
                // two lengths of placeholder text: the long one does not fit a 320px screen
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex w-[calc(100%-4.5rem)] items-center text-base text-slate-500 md:text-sm">
                  <span className="truncate sm:hidden">Search products…</span>
                  <span className="hidden truncate sm:inline">Search bearings, belts, parts…</span>
                </span>
              )}
              <Button type="submit" size="icon" className="btn-flat h-11 w-14 rounded-l-none shadow-none focus-visible:outline-ring" aria-label="Search">
                <Search />
              </Button>
            </form>
            <p role="status" aria-live="polite" className="sr-only">
              {open ? `${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"} available` : ""}
            </p>
            {open && (
              <ul
                id="search-suggestions"
                role="listbox"
                aria-label="Search suggestions"
                className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-foreground shadow-xl [--ring:#0b0b0b]"
              >
                {suggestions.map((p, i) => (
                  <li
                    key={p.slug}
                    id={`search-option-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runSearch(p.name)}
                    className={`flex w-full cursor-pointer items-center gap-3 border-b border-slate-200 px-3 py-2 text-left last:border-b-0 hover:bg-accent ${
                      i === active ? "bg-accent" : ""
                    }`}
                  >
                    <img src={p.img} alt="" className="size-9 shrink-0 rounded-md bg-slate-50 object-contain" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.cat}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ml-auto hidden items-center gap-5 text-sm lg:flex">
            <button ref={cartBtnRef} onClick={(e) => {
                returnRef.current = e.currentTarget;
                setView((v) => ({ step: "cart", n: v.n + 1 }));
                setCartOpen(true);
              }}
              className="relative -m-2.5 flex items-center gap-2 rounded-md p-2.5">
              <span className="sr-only">Cart, {cart} {cart === 1 ? "item" : "items"}</span>
              <span data-cart-target className="relative">
                <ShoppingCart className="size-6" aria-hidden="true" />
                {cart > 0 && (
                  <span
                    aria-hidden="true"
                    key={cart}
                    className="animate-in zoom-in-150 motion-reduce:animate-none absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-foreground duration-300"
                  >
                    {cart}
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="hidden font-semibold lg:inline">Cart</span>
            </button>
            <AccountMenu
              user={user}
              label={userLabel}
              onSignIn={() => {
                returnRef.current = acctRef.current;
                openLogin(false);
              }}
              onSignUp={() => {
                returnRef.current = acctRef.current;
                openLogin(true);
              }}
              triggerRef={acctRef}
              onProfile={() => openProfile("", acctRef.current)}
              onCart={() => {
                returnRef.current = acctRef.current;
                setView((v) => ({ step: "cart", n: v.n + 1 }));
                setCartOpen(true);
              }}
              onSignOut={signOut}
            />
          </div>
          {deliverBtn("ml-auto flex min-h-11 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-md px-1 text-left text-sm font-semibold text-white md:ml-0 lg:hidden")}
        </div>

      </header>
      <nav aria-label="Categories" className="hidden border-b border-border bg-white lg:block">
        <div className="mx-auto flex max-w-[1312px] items-center gap-1 overflow-x-auto px-4 text-sm font-medium no-scrollbar">
          <Link href="/products" className="mr-2 flex shrink-0 items-center gap-2 border-r border-border py-3 pr-5 font-bold">
            <Menu className="size-4" /> All products
          </Link>
          {categories.filter((c) => c.name !== "Sheet").map((c) => (
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
      <MobileTabBar
        covered={cartOpen || loginOpen || profileOpen || accountOpen}
        cart={cart}
        signedIn={!!user}
        onSearch={() => {
          window.scrollTo({ top: 0 });
          searchRef.current?.focus();
        }}
        onCart={(e) => {
          returnRef.current = e.currentTarget;
          setView((v) => ({ step: "cart", n: v.n + 1 }));
          setCartOpen(true);
        }}
        onAccount={(e) => {
          returnRef.current = e.currentTarget;
          setAccountOpen(true);
        }}
      />
      <AccountSheet
        open={accountOpen}
        suspended={loginOpen || profileOpen}
        user={user}
        label={userLabel}
        returnRef={returnRef}
        onClose={() => setAccountOpen(false)}
        onSignIn={() => openLogin(false)}
        onSignUp={() => openLogin(true)}
        onProfile={(section) => openProfile(section, returnRef.current)}
        onCart={() => {
          setView((v) => ({ step: "cart", n: v.n + 1 }));
          setCartOpen(true);
        }}
        onSignOut={signOut}
      />
      <LoginModal
        open={loginOpen}
        returnRef={returnRef}
        startSignup={signupFirst}
        context={loginForCheckout ? "Sign in to place your order. Your cart is saved." : ""}
        onClose={() => setLoginOpen(false)}
        onLogin={() => {
          readUser(); // the form just saved the user to localStorage; refresh the header state
          if (pendingCheckout.current) return startCheckout();
          let hasProfile = false;
          try {
            hasProfile = !!getProfile()?.name;
          } catch {}
          if (!hasProfile) {
            setProfileSection("");
            setProfileOpen(true);
          }
        }}
      />
      <ProfileModal open={profileOpen} section={profileSection} returnRef={returnRef} onClose={() => setProfileOpen(false)} onSignOut={signOut} />
      <CartDrawer open={cartOpen} returnRef={returnRef} onClose={() => setCartOpen(false)} items={items} view={view} onCheckout={() => { returnRef.current = cartBtnRef.current; startCheckout(); }} setQty={setQty} clear={() => update(() => ({}))} />
    </>
  );
}
