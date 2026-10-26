"use client";
import { useEffect, useRef, useState } from "react";
import { LogIn } from "@/components/icons";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ErrorNotice, LoadingState } from "@/components/platform/ErrorNotice";
import { PlatformRoot, USER_EVENT, usePlatform } from "@/lib/platform-ui/PlatformProvider";

const readUser = () => (typeof localStorage === "undefined" ? "" : (localStorage.getItem("kn-user") || "").trim().toLowerCase());

/**
 * The shop signs anyone in by email (localStorage "kn-user"). The platform needs a user row, so the first time a shop user
 * opens a platform page we create the customer account through the demo sign-in (same as the legacy shop login).
 * Returns { status: "loading" | "signed_out" | "error" | "ready", actor, error }.
 */
export function useCustomerSession() {
  const { p, actor, ready } = usePlatform();
  const [email, setEmail] = useState(null);
  const [error, setError] = useState(null);
  const tried = useRef("");

  useEffect(() => {
    const sync = () => setEmail(readUser());
    sync();
    window.addEventListener(USER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(USER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!ready || email === null || !email || actor) return;
    if (tried.current === email) return;
    tried.current = email;
    const name = localStorage.getItem("kn-user-name") || undefined;
    const r = p.auth.signIn({ email, name });
    if (!r.ok) setError(r.error);
  }, [p, ready, email, actor]);

  if (!ready || email === null) return { status: "loading" };
  if (!email) return { status: "signed_out" };
  if (actor) return { status: "ready", actor };
  if (error) return { status: "error", error };
  return { status: "loading" };
}

function Gate({ children }) {
  const s = useCustomerSession();
  if (s.status === "loading") return <LoadingState label="Loading your account" />;
  if (s.status === "error") return <ErrorNotice error={s.error} />;
  if (s.status === "signed_out") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-white px-6 py-16 text-center">
        <LogIn className="size-10 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">Sign in to continue</p>
        <p className="text-sm text-muted-foreground">Your orders and support requests are saved to your account on this device.</p>
        <Button onClick={() => window.dispatchEvent(new Event("kn-open-login"))} className="mt-2 h-11 rounded-xl px-8">Sign in</Button>
      </div>
    );
  }
  return typeof children === "function" ? children(s.actor) : children;
}

/** Shop page chrome (header, tab bar) + platform provider + sign-in gate. children may be a function of the actor. */
export default function CustomerShell({ title, children, gate = true }) {
  return (
    <PlatformRoot>
      <div className="print:hidden"><Header /></div>
      <main id="main-content" tabIndex={-1} className="mx-auto min-h-[60vh] max-w-[1312px] px-4 pt-10 pb-28 outline-none lg:pb-16 print:p-0">
        {title && <h1 className="mb-6 text-3xl font-extrabold tracking-tight print:hidden">{title}</h1>}
        {gate ? <Gate>{children}</Gate> : children}
      </main>
    </PlatformRoot>
  );
}
