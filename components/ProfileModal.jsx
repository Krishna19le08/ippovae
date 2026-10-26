"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowLeft, LogOut, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddressBook from "@/components/checkout/AddressBook";
import { useDialogFocus } from "@/lib/useDialogFocus";
import { getProfile, setProfile } from "@/lib/addresses";

const PHONE_RE = /^[6-9]\d{9}$/;

export default function ProfileModal({ open, onClose, onSignOut, section = "", returnRef }) {
  const dialogRef = useDialogFocus(open, returnRef);
  const addrRef = useRef(null);
  const [v, setV] = useState({ name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [existing, setExisting] = useState(false);
  const [errors, setErrors] = useState({});

  // load what we know each time it opens
  useEffect(() => {
    if (!open) return;
    try {
      const p = getProfile();
      setV({ name: p?.name || localStorage.getItem("kn-user-name") || "", phone: p?.phone || "" });
      setExisting(!!p?.name);
      setEmail(localStorage.getItem("kn-user") || "");
    } catch {}
    setErrors({});
  }, [open]);

  // opened from "Deliver to": jump to the saved addresses
  useEffect(() => {
    if (!open || !section) return;
    const t = setTimeout(() => {
      addrRef.current?.scrollIntoView({ block: "start" });
      addrRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => {
    setV({ ...v, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const save = (e) => {
    e.preventDefault();
    const errs = {};
    if (v.name.trim().length < 2) errs.name = "Enter your full name";
    if (!PHONE_RE.test(v.phone.trim())) errs.phone = "Enter a valid 10-digit mobile number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      setProfile({ name: v.name.trim(), phone: v.phone.trim() });
      localStorage.setItem("kn-user-name", v.name.trim());
    } catch {}
    onClose();
  };

  const err = (k) =>
    errors[k] && (
      <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="size-3.5 shrink-0" /> {errors[k]}
      </p>
    );

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 max-md:items-stretch max-md:p-0">
      <div onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Your profile"
        aria-modal="true"
        className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white text-foreground shadow-2xl max-md:h-full max-md:max-w-none max-md:rounded-none max-md:shadow-none"
      >
        {/* the card clips to its rounded corners; the inner box scrolls, so the scrollbar stays inside the card */}
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-8 max-md:p-4 max-md:pt-0 max-md:pb-8 md:p-8 md:pb-8">
        {/* phones: full-screen page with an app bar instead of a floating card */}
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-1 border-b border-slate-200 bg-white px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <button type="button" onClick={onClose} aria-label="Back" className="flex size-11 items-center justify-center rounded-full active:bg-slate-100">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-lg font-bold">Your profile</span>
        </div>
        <button onClick={onClose} aria-label="Close profile" className="absolute top-2 right-2 rounded-md p-3 text-muted-foreground hover:text-foreground max-md:hidden">
          <X className="size-5" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent text-foreground max-md:hidden">
            <UserRound className="size-7" />
          </div>
          <h2 className="text-2xl font-bold">{existing ? "Your profile" : "Complete your profile"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {existing ? "Keep your details up to date." : "Tell us a little about you so checkout is quick."}
          </p>
        </div>

        <form onSubmit={save} noValidate className="space-y-4">
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
            <Input id="pf-email" value={email} readOnly disabled className="h-11 bg-slate-50" />
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl text-base">
            {existing ? "Save Changes" : "Save Profile"}
          </Button>
        </form>

        <div ref={addrRef} tabIndex={-1} className="mt-6 border-t border-slate-200 pt-5 outline-none">
          <AddressBook key={section} mode="manage" startAdding={section === "address-new"} />
        </div>

        {existing && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="mx-auto mt-4 flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-red-600"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
