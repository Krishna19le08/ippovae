"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "@/components/ui/icons";
import { withBase } from "@/lib/asset";
import { useScrollLock } from "@/hooks/useScrollLock";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import CategoryNav from "@/components/layout/CategoryNav";
import DeliverButton from "@/components/layout/DeliverButton";
import MobileTabBar from "@/components/layout/MobileTabBar";
import { SearchBackdrop, SearchBox } from "@/components/layout/SearchBox";
import { useSiteSearch } from "@/components/layout/useSiteSearch";
import CartDrawer from "@/features/cart/components/CartDrawer";
import { useCart } from "@/features/cart/useCart";
import AccountMenu from "@/features/auth/components/AccountMenu";
import AccountSheet from "@/features/auth/components/AccountSheet";
import LoginModal from "@/features/auth/components/LoginModal";
import ProfileModal from "@/features/auth/components/ProfileModal";
import { useSignedInUser } from "@/features/auth/useSignedInUser";
import { getProfile, useAddresses } from "@/features/checkout/addresses";
import { categories as seedCategories } from "@/data";
import { useCatalog, liveCategories } from "@/features/catalog/catalogStore";

// The site header. It also owns the cart drawer and the sign-in/profile dialogs, because they open from several
// places (header buttons, the phone tab bar, account menu, and "kn-open-*" events from other pages).
export default function Header() {
  const { list: products } = useCatalog();
  const categories = liveCategories(products, seedCategories);
  const { selected: deliverTo } = useAddresses();

  // dialogs
  const [cartOpen, setCartOpen] = useState(false);
  const [cartView, setCartView] = useState({ step: "cart", n: 0 }); // which drawer step to show; n bumps on each request
  const [loginOpen, setLoginOpen] = useState(false);
  const [signupFirst, setSignupFirst] = useState(false); // open the login popup on "Create account"
  const [loginForCheckout, setLoginForCheckout] = useState(false); // login opened from checkout: show context line
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSection, setProfileSection] = useState(""); // "" | "address" | "address-new": where the profile dialog opens
  const [accountOpen, setAccountOpen] = useState(false); // phone Account page (tab bar)
  const pendingCheckout = useRef(false); // user hit checkout while logged out; resume after login

  // where focus goes back to when a dialog closes and the control that opened it is gone (menu closed, drawer closed)
  const returnRef = useRef(null);
  const cartBtnRef = useRef(null);
  const acctRef = useRef(null);
  const searchRef = useRef(null);

  const cart = useCart({
    onBuyNow: () => {
      returnRef.current = cartBtnRef.current;
      startCheckout();
    },
  });
  const { user, firstName, isSignedIn, refresh: refreshUser, signOut } = useSignedInUser();
  const search = useSiteSearch(products, searchRef);

  useScrollLock(cartOpen || loginOpen || profileOpen || accountOpen);

  const showCart = (returnTo) => {
    if (returnTo !== undefined) returnRef.current = returnTo;
    setCartView((v) => ({ step: "cart", n: v.n + 1 }));
    setCartOpen(true);
  };

  const openLogin = ({ signup = false, returnTo } = {}) => {
    if (returnTo !== undefined) returnRef.current = returnTo;
    pendingCheckout.current = false; // plain login, not mid-checkout
    setLoginForCheckout(false);
    setSignupFirst(signup);
    setLoginOpen(true);
  };

  // `returnTo` is the control to give focus back to if the opener unmounts
  const openProfile = (section, returnTo) => {
    returnRef.current = returnTo || acctRef.current;
    if (!isSignedIn()) return openLogin();
    setProfileSection(section);
    setProfileOpen(true);
  };

  // checkout needs a signed-in user: ask for login first, then continue to the address step
  const startCheckout = () => {
    if (isSignedIn()) {
      pendingCheckout.current = false;
      setCartView((v) => ({ step: "address", n: v.n + 1 }));
      setCartOpen(true);
    } else {
      pendingCheckout.current = true;
      setLoginForCheckout(true);
      setCartOpen(false);
      setLoginOpen(true);
    }
  };

  // after signing in: resume checkout, or ask a new user for their profile
  const onLoggedIn = () => {
    refreshUser(); // the form just saved the user to localStorage
    if (pendingCheckout.current) return startCheckout();
    let hasProfile = false;
    try {
      hasProfile = !!getProfile()?.name;
    } catch {}
    if (!hasProfile) {
      setProfileSection("");
      setProfileOpen(true);
    }
  };

  // other pages ask the header to open the cart or the sign-in popup
  useEffect(() => {
    const onOpenCart = () => showCart(cartBtnRef.current);
    const onOpenLogin = () => openLogin({ returnTo: acctRef.current });
    window.addEventListener("kn-open-cart", onOpenCart);
    window.addEventListener("kn-open-login", onOpenLogin);
    return () => {
      window.removeEventListener("kn-open-cart", onOpenCart);
      window.removeEventListener("kn-open-login", onOpenLogin);
    };
  }, []);

  const openDeliveryAddress = (button) => openProfile(deliverTo ? "address" : "address-new", button);

  return (
    <Fragment>
      <p role="status" aria-live="polite" className="sr-only">{cart.announcement}</p>

      <AnnouncementBar />
      <SearchBackdrop search={search} />

      <header className="print:hidden sticky -top-[54px] z-50 border-b border-white/10 md:top-0 surface-ink bg-ink text-white">
        <div className="mx-auto flex max-w-[1312px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:flex-nowrap md:gap-8">
          <Link href="/" className="shrink-0">
            <img src={withBase("/logo.png")} alt="ippovae" width={118} height={40} className="h-10 w-auto md:h-12" />
          </Link>
          <DeliverButton
            address={deliverTo}
            onOpen={openDeliveryAddress}
            className="hidden min-h-11 max-w-52 shrink-0 xl:max-w-64 items-center gap-1.5 rounded-md px-1.5 text-left text-sm font-semibold text-white hover:text-lime lg:flex"
          />
          <SearchBox search={search} inputRef={searchRef} />

          <div className="ml-auto hidden items-center gap-5 text-sm lg:flex">
            <button
              ref={cartBtnRef}
              onClick={(e) => showCart(e.currentTarget)}
              className="relative -m-2.5 flex items-center gap-2 rounded-md p-2.5"
            >
              <span className="sr-only">Cart, {cart.count} {cart.count === 1 ? "item" : "items"}</span>
              <span data-cart-target className="relative">
                <ShoppingCart className="size-6" aria-hidden="true" />
                {cart.count > 0 && (
                  <span
                    aria-hidden="true"
                    key={cart.count}
                    className="anim-pop-in-slow motion-reduce:animate-none absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-none font-semibold text-primary-foreground duration-300"
                  >
                    {cart.count}
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="hidden font-semibold lg:inline">Cart</span>
            </button>
            <AccountMenu
              user={user}
              label={firstName}
              triggerRef={acctRef}
              onSignIn={() => openLogin({ returnTo: acctRef.current })}
              onSignUp={() => openLogin({ signup: true, returnTo: acctRef.current })}
              onProfile={() => openProfile("", acctRef.current)}
              onCart={() => showCart(acctRef.current)}
              onSignOut={signOut}
            />
          </div>

          <DeliverButton
            address={deliverTo}
            onOpen={openDeliveryAddress}
            className="ml-auto flex min-h-11 max-w-[11.5rem] shrink-0 items-center gap-1.5 rounded-md px-1 text-left text-sm font-semibold text-white md:ml-0 lg:hidden"
          />
        </div>
      </header>

      <CategoryNav categories={categories} />

      <MobileTabBar
        covered={cartOpen || loginOpen || profileOpen || accountOpen}
        cart={cart.count}
        signedIn={!!user}
        onSearch={() => {
          window.scrollTo({ top: 0, behavior: "instant" });
          searchRef.current?.focus();
        }}
        onCart={(e) => showCart(e.currentTarget)}
        onAccount={(e) => {
          returnRef.current = e.currentTarget;
          setAccountOpen(true);
        }}
      />
      <AccountSheet
        open={accountOpen}
        suspended={loginOpen || profileOpen}
        user={user}
        label={firstName}
        returnRef={returnRef}
        onClose={() => setAccountOpen(false)}
        onSignIn={() => openLogin()}
        onSignUp={() => openLogin({ signup: true })}
        onProfile={(section) => openProfile(section, returnRef.current)}
        onCart={() => showCart()}
        onSignOut={signOut}
      />
      <LoginModal
        open={loginOpen}
        returnRef={returnRef}
        startSignup={signupFirst}
        context={loginForCheckout ? "Sign in to place your order. Your cart is saved." : ""}
        onClose={() => setLoginOpen(false)}
        onLogin={onLoggedIn}
      />
      <ProfileModal
        open={profileOpen}
        section={profileSection}
        returnRef={returnRef}
        onClose={() => setProfileOpen(false)}
        onSignOut={signOut}
      />
      <CartDrawer
        open={cartOpen}
        returnRef={returnRef}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        view={cartView}
        setQty={cart.setQty}
        clear={cart.clear}
        onCheckout={() => {
          returnRef.current = cartBtnRef.current;
          startCheckout();
        }}
      />
    </Fragment>
  );
}
