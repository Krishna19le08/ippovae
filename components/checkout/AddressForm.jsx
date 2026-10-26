"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, LocateFixed } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHONE_RE, PIN_RE, profileDefaults } from "@/lib/addresses";

const EMPTY = { name: "", phone: "", pincode: "", city: "", state: "", flat: "", area: "", landmark: "", type: "home", isDefault: false };

const validate = (f) => {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Enter your full name";
  if (!PHONE_RE.test(f.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
  if (!PIN_RE.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode";
  if (!f.city.trim()) e.city = "Enter your city";
  if (!f.state.trim()) e.state = "Enter your state";
  if (f.flat.trim().length < 1) e.flat = "Enter your flat, house no. or building";
  if (f.area.trim().length < 3) e.area = "Enter your area, street or colony";
  return e;
};
const ORDER = ["name", "phone", "pincode", "city", "state", "flat", "area"];

function FieldError({ id, msg }) {
  return (
    msg && (
      <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-xs text-red-600">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {msg}
      </p>
    )
  );
}

/**
 * Add / edit one delivery address. Calls onSave(address) with a validated address, onCancel() to back out.
 * First address (isFirst) is saved as the default.
 */
export default function AddressForm({ initial, isFirst = false, onSave, onCancel, submitLabel = "Save address", headingRef, title }) {
  const uid = useId().replace(/:/g, "");
  const p = (k) => `${uid}-${k}`;
  const [f, setF] = useState(() => {
    if (initial) return { ...EMPTY, ...initial };
    const d = profileDefaults();
    return { ...EMPTY, name: d.name, phone: d.phone, isDefault: isFirst };
  });
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState("idle"); // idle | loading | ok | notfound | offline
  const [coords, setCoords] = useState(initial?.coords || null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const reqId = useRef(0);
  const ctl = useRef(null);

  useEffect(() => () => ctl.current?.abort(), []);

  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // pincode: look up city + state once 6 digits are in; both stay editable
  const onPin = async (raw) => {
    const pin = raw.replace(/\D/g, "").slice(0, 6);
    set("pincode", pin);
    reqId.current += 1;
    const mine = reqId.current;
    ctl.current?.abort();
    if (pin.length < 6) return setLookup("idle");
    if (!PIN_RE.test(pin)) {
      // not a possible Indian pincode (starts with 0): say so now, no network call
      setLookup("notfound");
      setErrors((e) => ({ ...e, pincode: "We could not find this pincode. Please check it." }));
      return;
    }
    setLookup("loading");
    const c = new AbortController();
    ctl.current = c;
    const timer = setTimeout(() => c.abort(), 6000);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: c.signal });
      const [data] = await res.json();
      clearTimeout(timer);
      if (mine !== reqId.current) return;
      if (data?.Status !== "Success" || !data.PostOffice?.length) {
        setLookup("notfound");
        setErrors((e) => ({ ...e, pincode: "We could not find this pincode. Please check it." }));
        return;
      }
      const { District, State } = data.PostOffice[0];
      setF((s) => ({ ...s, city: District || s.city, state: State || s.state }));
      setErrors((e) => ({ ...e, city: undefined, state: undefined }));
      setLookup("ok");
    } catch {
      clearTimeout(timer);
      if (mine === reqId.current) setLookup("offline"); // service unreachable: type city and state yourself
    }
  };

  // fill the address from the device location (OpenStreetMap reverse lookup)
  const useMyLocation = () => {
    setLocError("");
    if (!navigator.geolocation) return setLocError("Location isn't supported on this device.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const pos = { lat: c.latitude, lon: c.longitude };
        setCoords(pos);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${pos.lat}&lon=${pos.lon}`,
          );
          const { address: a = {} } = await res.json();
          const area = [a.neighbourhood || a.suburb, a.road].filter(Boolean).join(", ");
          const pin = (a.postcode || "").replace(/\D/g, "").slice(0, 6);
          const city = a.city || a.town || a.village || a.state_district || "";
          reqId.current += 1;
          ctl.current?.abort();
          setLookup("idle");
          setF((s) => ({
            ...s,
            pincode: pin || s.pincode,
            city: city || s.city,
            state: a.state || s.state,
            area: area || s.area,
            flat: a.house_number || s.flat,
          }));
          setErrors({});
        } catch {
          setLocError("Pinned your location on the map, but couldn't read the address. Please type it in.");
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === 1 ? "Location permission was denied. You can type your address instead." : "Couldn't get your location. Please type your address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate(f);
    if (lookup === "notfound" && !errs.pincode) errs.pincode = "We could not find this pincode. Please check it.";
    setErrors(errs);
    const bad = ORDER.find((k) => errs[k]);
    if (bad) return document.getElementById(p(bad))?.focus();
    const out = {
      ...(initial?.id ? { id: initial.id } : {}),
      name: f.name.trim(),
      phone: f.phone.trim(),
      pincode: f.pincode.trim(),
      city: f.city.trim(),
      state: f.state.trim(),
      flat: f.flat.trim(),
      area: f.area.trim(),
      landmark: f.landmark.trim(),
      type: f.type,
      isDefault: isFirst ? true : f.isDefault,
    };
    if (coords) out.coords = coords;
    onSave(out);
  };

  const input = (k, extra = {}) => ({
    id: p(k),
    value: f[k],
    onChange: (e) => set(k, e.target.value),
    "aria-invalid": !!errors[k],
    "aria-describedby": [errors[k] && `${p(k)}-err`, extra.hint].filter(Boolean).join(" ") || undefined,
    className: `h-11 ${errors[k] ? "border-red-500" : ""}`,
  });
  const label = (k, text, optional) => (
    <label htmlFor={p(k)} className="mb-1.5 block text-sm font-medium">
      {text}
      {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
    </label>
  );

  const pinHint =
    lookup === "loading"
      ? "Looking up pincode…"
      : lookup === "ok"
        ? "City and state filled from your pincode. You can change them."
        : lookup === "offline"
          ? "We could not check this pincode right now. Please type your city and state."
          : "";

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {title && (
        <h3 ref={headingRef} tabIndex={-1} className="text-base font-bold outline-none">
          {title}
        </h3>
      )}

      <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="h-11 w-full rounded-xl border-foreground text-foreground">
        {locating ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <LocateFixed />}
        {locating ? "Finding your location…" : "Use my current location"}
      </Button>
      {locError && (
        <p role="alert" className="-mt-2 flex items-start gap-1 text-xs text-red-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {locError}
        </p>
      )}

      <div>
        {label("name", "Full name")}
        <Input {...input("name")} autoComplete="name" placeholder="Full name" />
        <FieldError id={`${p("name")}-err`} msg={errors.name} />
      </div>
      <div>
        {label("phone", "Mobile number")}
        <Input {...input("phone")} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" placeholder="10-digit mobile number" />
        <FieldError id={`${p("phone")}-err`} msg={errors.phone} />
      </div>
      <div>
        {label("pincode", "Pincode")}
        <Input {...input("pincode", { hint: pinHint && `${p("pincode")}-hint` })} onChange={(e) => onPin(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="postal-code" placeholder="6-digit pincode" />
        <FieldError id={`${p("pincode")}-err`} msg={errors.pincode} />
        <p id={`${p("pincode")}-hint`} role="status" className={`mt-1 text-xs text-muted-foreground ${pinHint ? "" : "sr-only"}`}>
          {pinHint}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {label("city", "City")}
          <Input {...input("city")} autoComplete="address-level2" placeholder="City" />
          <FieldError id={`${p("city")}-err`} msg={errors.city} />
        </div>
        <div>
          {label("state", "State")}
          <Input {...input("state")} autoComplete="address-level1" placeholder="State" />
          <FieldError id={`${p("state")}-err`} msg={errors.state} />
        </div>
      </div>
      <div>
        {label("flat", "Flat / House no. / Building")}
        <Input {...input("flat")} autoComplete="address-line1" placeholder="Flat, house no., building" />
        <FieldError id={`${p("flat")}-err`} msg={errors.flat} />
      </div>
      <div>
        {label("area", "Area / Street / Colony")}
        <Input {...input("area")} autoComplete="address-line2" placeholder="Area, street, colony" />
        <FieldError id={`${p("area")}-err`} msg={errors.area} />
      </div>
      <div>
        {label("landmark", "Landmark", true)}
        <Input {...input("landmark")} autoComplete="off" placeholder="E.g. opposite the temple, beside the school" />
      </div>

      {coords && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <iframe
            title="Delivery location map"
            loading="lazy"
            className="h-40 w-full"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.004},${coords.lat - 0.0025},${coords.lon + 0.004},${coords.lat + 0.0025}&layer=mapnik&marker=${coords.lat},${coords.lon}`}
          />
          <a href={`https://www.google.com/maps?q=${coords.lat},${coords.lon}`} target="_blank" rel="noopener noreferrer" className="block px-3 py-2.5 text-xs font-medium text-foreground underline underline-offset-4">
            Open in Google Maps
          </a>
        </div>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Address type</legend>
        <div className="flex gap-2">
          {[
            ["home", "Home"],
            ["work", "Work"],
          ].map(([v, l]) => (
            <label
              key={v}
              className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                f.type === v ? "border-foreground bg-accent text-foreground" : "border-slate-200"
              }`}
            >
              <input type="radio" name={p("type")} value={v} checked={f.type === v} onChange={() => set("type", v)} className="accent-foreground" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={isFirst ? true : f.isDefault}
          disabled={isFirst}
          onChange={(e) => set("isDefault", e.target.checked)}
          className="size-5 accent-foreground"
        />
        Make this my default address
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="h-11 flex-1 rounded-xl">
            Cancel
          </Button>
        )}
        <Button type="submit" className="h-11 flex-1 rounded-xl">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
