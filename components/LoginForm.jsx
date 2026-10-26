"use client";
import { Children, cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import GoogleButton from "@/components/GoogleButton";
import { AlertCircle, ExternalLink, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE } from "@/lib/data";
import { ADDR_KEY, PROFILE_KEY, SEL_KEY } from "@/lib/addresses";
import { DEMO_ACCOUNTS, DEMO_ADDRESS, DEMO_ENABLED, DEMO_PASSWORD, DEMO_PHONE } from "@/lib/demo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Accounts live in this browser only (no backend yet), so this is a demo-grade check, not real security.
const readAccounts = () => {
  try {
    return JSON.parse(localStorage.getItem("kn-accounts")) || {};
  } catch {
    return {};
  }
};

async function hash(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validate({ signup, name, email, password, confirm }) {
  const e = {};
  if (signup && name.trim().length < 2) e.name = "Enter your full name (at least 2 characters)";
  if (!email.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
  if (!password) e.password = "Password is required";
  else if (signup) {
    if (password.length < 8) e.password = "Use at least 8 characters";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = "Include at least one letter and one number";
  }
  if (signup && confirm !== password) e.confirm = confirm ? "Passwords don't match" : "Confirm your password";
  return e;
}

function Field({ label, icon: Icon, error, extra, children }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {extra}
      </div>
      <div className="relative">
        <Icon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        {Children.map(children, (c) => (c?.type === Input ? cloneElement(c, { id, "aria-describedby": error ? `${id}-error` : undefined }) : c))}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

export default function LoginForm({ onDone, startSignup = false, context = "" }) {
  const [signup, setSignup] = useState(startSignup);
  const [v, setV] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const [focusErr, setFocusErr] = useState(0); // bumps after a failed submit so focus can move to the first invalid field

  useEffect(() => {
    if (focusErr) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [focusErr]);

  const set = (k) => (e) => {
    setV({ ...v, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
    setFormError("");
  };

  const switchMode = () => {
    setSignup(!signup);
    setErrors({});
    setFormError("");
  };

  const save = (email, name) => {
    try {
      localStorage.setItem("kn-user", email);
      localStorage.setItem("kn-user-name", name || "");
    } catch {}
    onDone();
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const errs = validate({ signup, ...v });
    setErrors(errs);
    if (Object.keys(errs).length) return setFocusErr((n) => n + 1);

    setBusy(true);
    try {
      const email = v.email.trim().toLowerCase();
      const accounts = readAccounts();
      const h = await hash(v.password);
      if (signup) {
        if (accounts[email]) return setFormError("An account with this email already exists. Try signing in.");
        accounts[email] = { name: v.name.trim(), hash: h };
        localStorage.setItem("kn-accounts", JSON.stringify(accounts));
        save(email, v.name.trim());
      } else {
        const acc = accounts[email];
        if (!acc) return setFormError("No account found with this email. Create one first.");
        if (acc.hash !== h) return (setErrors({ password: "Incorrect password" }), setFocusErr((n) => n + 1));
        save(email, acc.name);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // demo accounts are created in this browser on first use, then signed in like any other account
  const demo = async (acct) => {
    setBusy(true);
    try {
      const accounts = readAccounts();
      const h = await hash(DEMO_PASSWORD);
      if (!accounts[acct.email]) {
        accounts[acct.email] = { name: acct.name, hash: h };
        localStorage.setItem("kn-accounts", JSON.stringify(accounts));
      }
      // a ready profile and a deliverable demo address on every demo account. Existing addresses are kept; the demo
      // one is added (and selected) only when missing, so earlier edits are never overwritten.
      const name = accounts[acct.email].name;
      const addrKey = `${ADDR_KEY}:${acct.email}`;
      const saved = JSON.parse(localStorage.getItem(addrKey) || "null");
      const list = Array.isArray(saved) ? saved : [];
      if (!list.some((a) => a.id === DEMO_ADDRESS.id)) {
        localStorage.setItem(addrKey, JSON.stringify([{ ...DEMO_ADDRESS, name, isDefault: list.length === 0 }, ...list]));
        localStorage.setItem(`${SEL_KEY}:${acct.email}`, DEMO_ADDRESS.id);
      }
      if (!localStorage.getItem(`${PROFILE_KEY}:${acct.email}`)) {
        localStorage.setItem(`${PROFILE_KEY}:${acct.email}`, JSON.stringify({ name, phone: DEMO_PHONE }));
      }
      save(acct.email, name);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = useCallback((user) => save(user.email, user.name), [onDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const input = (k, extra = "") => `h-11 ${extra} ${errors[k] ? "border-red-500 focus-visible:ring-red-500/30" : ""}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{signup ? "Create your account" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {signup ? "Join ippovae to track orders and check out faster." : "Sign in to track your orders and check out faster."}
        </p>
        {context && <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-foreground">{context}</p>}
      </div>

      <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {formError}
          </div>
        )}

        {signup && (
          <Field label="Full name" icon={User} error={errors.name}>
            <Input autoComplete="name" placeholder="Your name" value={v.name} onChange={set("name")} aria-invalid={!!errors.name} className={input("name", "pl-9")} />
          </Field>
        )}

        <Field label="Email" icon={Mail} error={errors.email}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" value={v.email} onChange={set("email")} aria-invalid={!!errors.email} className={input("email", "pl-9")} />
        </Field>

        <Field
          label="Password"
          icon={Lock}
          error={errors.password}
          extra={
            !signup && (
              <a
                href={`${SITE}/faq`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-foreground underline underline-offset-4"
              >
                Forgot password? <span className="sr-only">(opens in a new tab)</span>
                <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden="true" />
              </a>
            )
          }
        >
          <Input
            type={show ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "8+ characters, letters and numbers" : "Enter your password"}
            value={v.password}
            onChange={set("password")}
            aria-invalid={!!errors.password}
            className={input("password", "px-9")}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-3 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </Field>

        {signup && (
          <Field label="Confirm password" icon={Lock} error={errors.confirm}>
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={v.confirm}
              onChange={set("confirm")}
              aria-invalid={!!errors.confirm}
              className={input("confirm", "pl-9")}
            />
          </Field>
        )}

        <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl text-base">
          {busy ? "Please wait…" : signup ? "Create Account" : "Sign In"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-slate-200" /> OR <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleButton onSuccess={google} />

      {DEMO_ENABLED && (
        <section aria-label="Demo accounts" className="rounded-xl border border-dashed border-foreground/40 p-3">
          <p className="text-sm font-semibold">Demo account</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Try the site with a saved delivery address. Browser-only, not a real account. Password: {DEMO_PASSWORD}
          </p>
          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button key={a.email} type="button" variant="outline" disabled={busy} onClick={() => demo(a)} className="h-11 rounded-xl">
                Sign in as {a.role}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {DEMO_ACCOUNTS.map((a) => `${a.role}: ${a.email}`).join(" · ")}
          </p>
        </section>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Already have an account?" : "New to ippovae?"}{" "}
        <button type="button" onClick={switchMode} className="font-medium text-foreground underline underline-offset-4">
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
