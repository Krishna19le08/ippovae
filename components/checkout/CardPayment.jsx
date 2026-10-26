"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, Wifi } from "lucide-react";

export const EMPTY_CARD = { number: "", name: "", expiry: "", cvv: "" };

const digits = (s) => s.replace(/\D/g, "");

export const formatNumber = (s) => digits(s).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

export const formatExpiry = (s) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function brandOf(number) {
  const d = digits(number);
  if (d.startsWith("4")) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^(60|65|81|82|508)/.test(d)) return "RuPay";
  return "";
}

// errors for the front of the card (number, name, expiry); empty object when valid
export function frontErrors(card) {
  const err = {};
  if (digits(card.number).length !== 16) err.number = "Enter the 16-digit card number.";
  if (!card.name.trim()) err.name = "Enter the name printed on the card.";
  const m = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  if (!m || +m[1] < 1 || +m[1] > 12) {
    err.expiry = "Enter the expiry as MM/YY.";
  } else {
    const now = new Date();
    const thisMonth = (now.getFullYear() % 100) * 12 + now.getMonth() + 1;
    if (+m[2] * 12 + +m[1] < thisMonth) err.expiry = "This card has expired.";
  }
  return err;
}

export const cvvError = (card) => (/^\d{3}$/.test(card.cvv) ? "" : "Enter the 3-digit security code.");

const inputCls =
  "h-11 w-full rounded-xl border bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-red-600";

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const FACE =
  "absolute inset-0 overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-14px_rgba(11,11,11,.7)] transition-shadow duration-[900ms] ease-out group-hover:shadow-[0_26px_50px_-14px_rgba(11,11,11,.85)] ring-1 ring-inset ring-lime/40 [backface-visibility:hidden] bg-[radial-gradient(120%_95%_at_0%_0%,#2a2b2f_0%,#141416_48%,#0B0B0B_100%)]";
// fine concentric lines, like the guilloche on a printed card
const GUILLOCHE = { backgroundImage: "repeating-radial-gradient(circle at 105% -10%, transparent 0 9px, rgba(255,255,255,.04) 9px 10px)" };
const EMBOSS = { textShadow: "0 1px 1px rgba(0,0,0,.65), 0 -1px 0 rgba(255,255,255,.22)" };

function Glare() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-[1200ms] ease-out group-hover:opacity-100 motion-reduce:hidden"
      style={{
        backgroundImage:
          "linear-gradient(115deg, transparent 15%, rgba(255,110,199,.55) 32%, rgba(110,200,255,.55) 48%, rgba(255,230,120,.5) 64%, transparent 82%)",
        backgroundSize: "250% 100%",
        backgroundPosition: "var(--mx,50%) 50%",
      }}
    />
  );
}

function Chip() {
  return (
    <svg viewBox="0 0 44 32" className="h-8 w-11" aria-hidden="true">
      <defs>
        <linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a1" />
          <stop offset=".5" stopColor="#d9b25a" />
          <stop offset="1" stopColor="#b98a2e" />
        </linearGradient>
      </defs>
      <rect width="44" height="32" rx="6" fill="url(#chip-gold)" />
      <g fill="none" stroke="rgba(60,40,0,.35)" strokeWidth="1">
        <path d="M0 11h14M0 21h14M30 11h14M30 21h14M14 0v32M30 0v32" />
        <rect x="14" y="9" width="16" height="14" rx="3" />
      </g>
    </svg>
  );
}

function BrandMark({ brand }) {
  if (brand === "VISA") return <span className="text-2xl leading-none font-extrabold tracking-tight italic">VISA</span>;
  if (brand === "RuPay") return <span className="text-lg leading-none font-bold tracking-tight italic">RuPay</span>;
  if (brand === "Mastercard")
    return (
      <span className="flex items-center" role="img" aria-label="Mastercard">
        <span className="size-7 rounded-full bg-[#eb001b]" />
        <span className="-ml-3 size-7 rounded-full bg-[#f79e1b] mix-blend-screen" />
      </span>
    );
  return null;
}

function CardVisual({ card, flipped }) {
  const brand = brandOf(card.number);
  const outer = useRef(null);
  const tilt = useRef(null);
  const shown = digits(card.number).padEnd(16, "•").replace(/(.{4})/g, "$1 ").trim();

  // pointer position drives the foil shimmer; written to a CSS variable so typing never re-renders
  const move = (e) => {
    const r = outer.current.getBoundingClientRect();
    tilt.current.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  };

  return (
    <div
      ref={outer}
      onPointerMove={move}
      aria-hidden="true"
      className="group mx-auto w-full max-w-[22rem] transition-transform duration-[900ms] ease-out hover:-translate-y-1.5 hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:transform-none [perspective:1100px]"
    >
      <div
        ref={tilt}
        className="[transform-style:preserve-3d]"
      >
        <div
          className="relative aspect-[1.586] w-full transition-transform duration-700 ease-[cubic-bezier(.4,.2,.2,1)] motion-reduce:transition-none [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          {/* front */}
          <div className={`${FACE} flex flex-col justify-between p-5`}>
            <div className="absolute inset-0" style={GUILLOCHE} />
            <div className="relative flex items-start justify-between">
              <Chip />
              <Wifi className="size-6 rotate-90 text-white/80" />
            </div>
            <div className="relative font-mono text-[1.12rem] tracking-[.16em] text-slate-100 sm:text-xl" style={EMBOSS}>
              {shown}
            </div>
            <div className="relative flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[9px] tracking-[.18em] text-white/60 uppercase">Card holder</div>
                <div className="truncate text-sm font-medium tracking-wider uppercase" style={EMBOSS}>
                  {card.name || "Your name"}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[.18em] text-white/60 uppercase">Expires</div>
                <div className="text-sm font-medium tracking-wider" style={EMBOSS}>
                  {card.expiry || "MM/YY"}
                </div>
              </div>
              <div className="flex h-8 w-14 items-center justify-end">
                <BrandMark brand={brand} />
              </div>
            </div>
            <Glare />
          </div>

          {/* back */}
          <div className={`${FACE} flex flex-col`} style={{ transform: "rotateY(180deg)" }}>
            <div className="absolute inset-0" style={GUILLOCHE} />
            <div className="relative mt-6 h-10 bg-black/85" />
            <div className="relative mt-5 flex items-center gap-2 px-5">
              <div
                className="h-9 flex-1 rounded-sm"
                style={{ background: "repeating-linear-gradient(135deg,#f5f5f4 0 6px,#e7e5e4 6px 12px)" }}
              />
              <div className="flex h-9 w-16 items-center justify-center gap-1 rounded-sm bg-white font-mono text-lg font-bold text-ink">
                {card.cvv.split("").map((_, i) => (
                  <span key={i} className="animate-in zoom-in-150 duration-200 motion-reduce:animate-none">
                    •
                  </span>
                ))}
              </div>
            </div>
            <div className="relative mt-auto px-5 pb-4 text-[10px] tracking-wide text-white/60">CVV: the 3 digits on the back of your card</div>
            <Glare />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardPayment({ card, setCard, stage, errors, onBack }) {
  const numberRef = useRef(null);
  const cvvRef = useRef(null);
  const first = useRef(true);
  const back = stage === "back";

  // move focus to the field the user needs next, once the flip starts
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    (back ? cvvRef : numberRef).current?.focus({ preventScroll: true });
  }, [back]);

  const set = (k, fmt) => (e) => setCard((c) => ({ ...c, [k]: fmt(e.target.value) }));
  const props = (id, err) => ({
    id,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": err ? `${id}-err` : undefined,
    className: `${inputCls} ${err ? "border-red-600" : "border-slate-300"}`,
  });

  return (
    <div className="space-y-4">
      <CardVisual card={card} flipped={back} />

      {back ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Edit card details
          </button>
          <p className="text-sm text-muted-foreground">Card ending {digits(card.number).slice(-4)}</p>
          <Field id="card-cvv" label="Security code (CVV)" error={errors.cvv}>
            <input
              {...props("card-cvv", errors.cvv)}
              ref={cvvRef}
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={3}
              value={card.cvv}
              onChange={(e) => setCard((c) => ({ ...c, cvv: digits(e.target.value).slice(0, 3) }))}
              placeholder="123"
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <Field id="card-number" label="Card number" error={errors.number}>
            <input
              {...props("card-number", errors.number)}
              ref={numberRef}
              inputMode="numeric"
              autoComplete="cc-number"
              value={card.number}
              onChange={set("number", formatNumber)}
              placeholder="1234 5678 9012 3456"
            />
          </Field>
          <Field id="card-name" label="Name on card" error={errors.name}>
            <input
              {...props("card-name", errors.name)}
              autoComplete="cc-name"
              value={card.name}
              onChange={set("name", (v) => v.slice(0, 26))}
              placeholder="As printed on the card"
            />
          </Field>
          <Field id="card-expiry" label="Expiry (MM/YY)" error={errors.expiry}>
            <input
              {...props("card-expiry", errors.expiry)}
              inputMode="numeric"
              autoComplete="cc-exp"
              value={card.expiry}
              onChange={set("expiry", formatExpiry)}
              placeholder="MM/YY"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
