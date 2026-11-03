"use client";
import Link from "next/link";
import { Children, cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import GoogleButton from "@/components/auth/GoogleButton";
import { AlertCircle, ExternalLink, Eye, EyeOff, Lock, Mail, User } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE } from "@/data";

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

  // front-end only: no validation or account check, any entry signs in
  const submit = (ev) => {
    ev.preventDefault();
    const email = v.email.trim().toLowerCase() || "guest@example.com";
    save(email, v.name.trim() || email.split("@")[0]);
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
              <Link
                href={`${SITE}/faq`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-foreground underline underline-offset-4"
              >
                Forgot password? <span className="sr-only">(opens in a new tab)</span>
                <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden="true" />
              </Link>
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

      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Already have an account?" : "New to ippovae?"}{" "}
        <button type="button" onClick={switchMode} className="font-medium text-foreground underline underline-offset-4">
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
