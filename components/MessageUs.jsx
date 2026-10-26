"use client";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, FileText, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { whatsappHref } from "@/lib/data";
import { useDialogFocus } from "@/lib/useDialogFocus";

// label/title/hint/prefill let other pages reuse this as a quote request (e.g. a product's bulk quote)
export default function MessageUs({
  className,
  label = "Message us",
  title = "Message us",
  hint = "Tell us what you need. We'll reply on WhatsApp.",
  prefill = "",
  placeholder = "e.g. I need 10 pieces of 6205 bearing",
  variant = "outline",
  icon = "message",
}) {
  const Icon = icon === "quote" ? FileText : MessageCircle; // a string, since components cannot be passed from a server page
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", phone: "", message: prefill });
  const [errors, setErrors] = useState({});
  const uid = useId();
  const dialogRef = useDialogFocus(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const set = (k) => (e) => {
    setV({ ...v, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: undefined });
  };

  const send = (e) => {
    e.preventDefault();
    const errs = {};
    if (v.name.trim().length < 2) errs.name = "Enter your name";
    if (!/^\d{10}$/.test(v.phone.trim())) errs.phone = "Enter a 10-digit mobile number";
    if (v.message.trim().length < 5) errs.message = "Write a short message (at least 5 characters)";
    setErrors(errs);
    const first = ["name", "phone", "message"].find((k) => errs[k]);
    if (first) return document.getElementById(`${uid}-${first}`)?.focus(); // errors are linked to their fields via aria-describedby

    const text = `Hi ippovae, I'm ${v.name.trim()} (${v.phone.trim()}).\n${v.message.trim()}`;
    window.open(whatsappHref(text), "_blank", "noopener");
    setOpen(false);
    setV({ name: "", phone: "", message: prefill });
  };

  const err = (k) =>
    errors[k] && (
      <p id={`${uid}-${k}-error`} role="alert" className="mt-1 flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="size-3.5 shrink-0" /> {errors[k]}
      </p>
    );
  const border = (k) => (errors[k] ? "border-red-500" : "");

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={className}>
        <Icon /> {label}
      </Button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-label={title}
            aria-modal="true"
            data-lenis-prevent
            className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-left text-foreground shadow-2xl md:p-8"
          >
            <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-2 right-2 rounded-md p-2.5 text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">{hint}</p>

            <form onSubmit={send} noValidate className="space-y-4">
              <div>
                <label htmlFor={`${uid}-name`} className="mb-1.5 block text-sm font-medium">Your name</label>
                <Input id={`${uid}-name`} autoFocus value={v.name} onChange={set("name")} autoComplete="name" placeholder="Your name" aria-invalid={!!errors.name} aria-describedby={errors.name ? `${uid}-name-error` : undefined} className={`h-11 ${border("name")}`} />
                {err("name")}
              </div>
              <div>
                <label htmlFor={`${uid}-phone`} className="mb-1.5 block text-sm font-medium">Mobile number</label>
                <Input id={`${uid}-phone`} value={v.phone} onChange={set("phone")} type="tel" inputMode="numeric" autoComplete="tel" placeholder="10-digit number" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${uid}-phone-error` : undefined} className={`h-11 ${border("phone")}`} />
                {err("phone")}
              </div>
              <div>
                <label htmlFor={`${uid}-message`} className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea
                  id={`${uid}-message`}
                  value={v.message}
                  onChange={set("message")}
                  rows={4}
                  placeholder={placeholder}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? `${uid}-message-error` : undefined}
                  className={`w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 ${border("message")}`}
                />
                {err("message")}
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl text-base">
                <Send /> Send on WhatsApp
              </Button>
              <p className="text-center text-xs text-muted-foreground">Opens WhatsApp in a new tab.</p>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
