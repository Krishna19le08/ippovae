"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, LogOut, LogIn, UserRound } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressBook from "@/components/checkout/AddressBook";
import { useSignedInUser } from "@/components/auth/useSignedInUser";
import { getProfile, setProfile } from "@/components/checkout/addresses";


// The profile as a page (it used to be a dialog): name, phone, email and the saved addresses.
// `?section=address` / `address-new` jumps to the address book, as "Deliver to" does.
export default function ProfilePage() {
  const section = (useSearchParams() ?? new URLSearchParams()).get("section") || "";
  const { user, signOut } = useSignedInUser();
  const addrRef = useRef(null);
  const [v, setV] = useState({ name: "", phone: "" });
  const [existing, setExisting] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const p = getProfile();
      setV({ name: p?.name || localStorage.getItem("kn-user-name") || "", phone: p?.phone || "" });
      setExisting(!!p?.name);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!section || !user) return;
    const t = setTimeout(() => {
      addrRef.current?.scrollIntoView({ block: "start" });
      addrRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [section, user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <LogIn className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">Sign in to see your profile</p>
        <p className="text-sm text-muted-foreground">Your details and saved addresses are kept on this device.</p>
        <Button onClick={() => window.dispatchEvent(new Event("kn-open-login"))} className="mt-2 h-11 rounded-xl px-8">Sign in</Button>
      </div>
    );
  }

  const set = (k) => (e) => {
    setV({ ...v, [k]: e.target.value });
    setSaved(false);
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const save = (e) => {
    e.preventDefault();
    const errs = {};
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      setProfile({ name: v.name.trim(), phone: v.phone.trim() });
      localStorage.setItem("kn-user-name", v.name.trim());
    } catch {}
    setExisting(true);
    setSaved(true);
  };

  const err = (k) =>
    errors[k] && (
      <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="size-3.5 shrink-0" /> {errors[k]}
      </p>
    );

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
          <UserRound className="size-7" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {existing ? "Keep your details up to date." : "Tell us a little about you so checkout is quick."}
          </p>
        </div>
      </div>

      <form onSubmit={save} noValidate className="space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div>
          <label htmlFor="pf-name" className="mb-1.5 block text-sm font-medium">Full name</label>
          <Input id="pf-name" value={v.name} onChange={set("name")} autoComplete="name" placeholder="Your name" aria-invalid={!!errors.name} className={`h-11 ${errors.name ? "border-red-500" : ""}`} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="pf-phone" className="mb-1.5 block text-sm font-medium">Mobile number</label>
          <Input id="pf-phone" value={v.phone} onChange={set("phone")} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel" placeholder="10-digit mobile number" aria-invalid={!!errors.phone} className={`h-11 ${errors.phone ? "border-red-500" : ""}`} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="pf-email" className="mb-1.5 block text-sm font-medium">Email</label>
          <Input id="pf-email" value={user} readOnly disabled className="h-11 bg-slate-50" />
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl text-base">
          {existing ? "Save Changes" : "Save Profile"}
        </Button>
        <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-green-700">
          {saved && (
            <span className="inline-flex items-center gap-1">
              <Check className="size-4" aria-hidden="true" /> Profile saved
            </span>
          )}
        </p>
      </form>

      <div ref={addrRef} tabIndex={-1} className="mt-6 rounded-2xl border border-border bg-white p-5 outline-none sm:p-6">
        <AddressBook key={section} mode="manage" startAdding={section === "address-new"} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link href="/orders" className="inline-flex min-h-10 items-center text-sm font-medium underline underline-offset-4">Your orders</Link>
        <button
          type="button"
          onClick={signOut}
          className="flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-red-600"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
