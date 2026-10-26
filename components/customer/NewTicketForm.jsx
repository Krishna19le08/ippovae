"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNotice } from "@/components/platform/ErrorNotice";
import FileAttach from "@/components/platform/FileAttach";
import { TICKET_CATEGORIES, newKey } from "@/components/customer/labels";
import { usePlatform, usePlatformQuery } from "@/lib/platform-ui/PlatformProvider";

const field = "mt-1 w-full rounded-md border border-input bg-white px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive md:text-sm";

export default function NewTicketForm({ initialOrder = "", initialCategory = "", onCancel }) {
  const { p, actor } = usePlatform();
  const router = useRouter();
  const uid = useId();
  const [category, setCategory] = useState(TICKET_CATEGORIES.some((c) => c.value === initialCategory) ? initialCategory : "");
  const [orderId, setOrderId] = useState(initialOrder);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const key = useRef("");
  const first = useRef(null);
  const orders = usePlatformQuery((pp, a) => pp.orders.list(a, { user_id: a.userId }), []).data || [];

  useEffect(() => { key.current = newKey("ticket"); first.current?.focus(); }, []);

  const fields = error?.code === "VALIDATION_FAILED" ? error.details?.fields || {} : {};
  const err = (name) => (fields[name] ? <p id={`${uid}-${name}-e`} className="mt-1 text-sm text-destructive">{String(fields[name]).startsWith("required") ? "This field is required." : String(fields[name])}</p> : null);
  const inv = (name) => ({ "aria-invalid": fields[name] ? true : undefined, "aria-describedby": fields[name] ? `${uid}-${name}-e` : undefined });

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = p.tickets.create(actor, { order_id: orderId || undefined, category, subject, body, attachments: files, idempotency_key: key.current });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    router.push(`/help/tickets/view?id=${encodeURIComponent(r.data.ticket.id)}`);
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${uid}-h`} className="space-y-4 rounded-md border border-border bg-white p-4 sm:p-5">
      <h2 id={`${uid}-h`} className="text-lg font-bold">New support request</h2>
      <div>
        <label htmlFor={`${uid}-category`} className="text-sm font-semibold">What is this about?</label>
        <select id={`${uid}-category`} ref={first} value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} h-11`} {...inv("category")}>
          <option value="">Choose a topic</option>
          {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {err("category")}
      </div>
      <div>
        <label htmlFor={`${uid}-order`} className="text-sm font-semibold">Order (optional)</label>
        <select id={`${uid}-order`} value={orderId} onChange={(e) => setOrderId(e.target.value)} className={`${field} h-11`} {...inv("order_id")}>
          <option value="">Not about a specific order</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.display_no} · {new Date(o.placed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-subject`} className="text-sm font-semibold">Subject</label>
        <Input id={`${uid}-subject`} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} className="mt-1 h-11" {...inv("subject")} />
        {err("subject")}
      </div>
      <div>
        <label htmlFor={`${uid}-body`} className="text-sm font-semibold">Tell us what happened</label>
        <textarea id={`${uid}-body`} value={body} maxLength={4000} rows={5} onChange={(e) => setBody(e.target.value)} className={`${field} py-2`} {...inv("body")} />
        {err("body")}
      </div>
      <div>
        <FileAttach value={files} onChange={setFiles} label="Attach photos or a PDF" disabled={busy} />
        {err("attachments")}
      </div>
      {error && !Object.keys(fields).length && <ErrorNotice error={error} />}
      {error && Object.keys(fields).length > 0 && <ErrorNotice error={{ ...error, details: {} }} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button type="submit" className="min-h-11" disabled={busy}>{busy ? "Sending..." : "Send request"}</Button>
      </div>
    </form>
  );
}
