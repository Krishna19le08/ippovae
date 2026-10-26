"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Paperclip, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ErrorNotice, LoadingState } from "@/components/platform/ErrorNotice";
import FileAttach from "@/components/platform/FileAttach";
import Money from "@/components/platform/Money";
import StatusBadge from "@/components/platform/StatusBadge";
import { REFUND_LABEL, categoryLabel, fmtDateTime, newKey } from "@/components/customer/labels";
import { usePlatform, usePlatformQuery } from "@/lib/platform-ui/PlatformProvider";

const WHO = { customer: "You", system: "ippovae" };
const who = (m) => WHO[m.author_role] || "ippovae support";

function Thread({ messages, attachments }) {
  const by = new Map();
  for (const a of attachments) by.set(a.owner_id, [...(by.get(a.owner_id) || []), a]);
  return (
    <ol aria-label="Conversation" className="space-y-3">
      {messages.map((m) => {
        const mine = m.author_role === "customer";
        const sys = m.author_role === "system" || m.kind === "status_change";
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-lg px-3 py-2 text-sm sm:max-w-[80%] ${sys ? "bg-slate-100 text-muted-foreground italic" : mine ? "bg-accent" : "border border-border bg-white"}`}>
              <p className="text-xs font-semibold text-muted-foreground not-italic">{who(m)} · <time dateTime={m.created_at}>{fmtDateTime(m.created_at)}</time></p>
              <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              {(by.get(m.id) || []).length > 0 && (
                <ul className="mt-2 space-y-1 not-italic">
                  {by.get(m.id).map((a) => (
                    <li key={a.id}>
                      <a href={a.storage_key} download={a.file_name} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-4">
                        <Paperclip className="size-3.5" aria-hidden="true" /> {a.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Body({ data, actor }) {
  const { p } = usePlatform();
  const { ticket: t, messages, attachments, refunds } = data;
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const key = useRef(newKey("reply"));
  const order = t.order_id ? p.repo.get("orders", t.order_id) : null;
  const closed = t.status === "CLOSED";
  const resolved = t.status === "RESOLVED";

  const send = (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = p.tickets.addMessage(actor, { ticket_id: t.id, body, attachments: files, idempotency_key: key.current });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setBody("");
    setFiles([]);
    key.current = newKey("reply");
  };
  const act = (event) => {
    setError(null);
    const r = p.tickets.transition(actor, { ticket_id: t.id, event, expected_version: t.version });
    if (!r.ok) setError(r.error);
  };
  const fieldErr = error?.code === "VALIDATION_FAILED" ? error.details?.fields?.body : null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/help/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:underline"><ArrowLeft className="size-4" aria-hidden="true" /> All requests</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.subject}</h1>
          <StatusBadge kind="ticket" value={t.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{t.display_no}</span> · {categoryLabel(t.category)} · Opened {fmtDateTime(t.created_at)}
          {order && <> · <Link href={`/orders/view?id=${encodeURIComponent(order.id)}`} className="font-semibold text-foreground underline underline-offset-4">Order {order.display_no}</Link></>}
        </p>
        {t.status === "WAITING_FOR_CUSTOMER" && <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">We are waiting for your reply. Answer below so we can continue.</p>}
        {!t.first_responded_at && !closed && !resolved && <p className="mt-1 text-xs text-muted-foreground">We aim to reply by {fmtDateTime(t.first_response_due_at)}. This is a target.</p>}
      </div>

      {refunds.length > 0 && (
        <section aria-labelledby="tr-h" className="rounded-md border border-border bg-white p-4">
          <h2 id="tr-h" className="text-sm font-bold">Refund on this request</h2>
          <ul className="mt-1 text-sm">
            {refunds.map((r) => <li key={r.id}><Money paise={r.amount} className="font-semibold" /> · {REFUND_LABEL[r.status] || r.status}</li>)}
          </ul>
        </section>
      )}

      <Thread messages={messages} attachments={attachments} />

      {closed ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm">
          <p>This request is closed.</p>
          <Button asChild variant="outline" className="mt-2 min-h-11"><Link href={`/help/tickets?new=1${t.order_id ? `&order=${encodeURIComponent(t.order_id)}` : ""}`}>Open a new request</Link></Button>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3 rounded-md border border-border bg-white p-4" aria-label="Reply">
          {resolved && <p className="text-sm text-muted-foreground">This request was marked resolved. If it is not, reply here to reopen it, or close it if you are done.</p>}
          <div>
            <label htmlFor="reply-body" className="text-sm font-semibold">{resolved ? "Reply to reopen" : "Your reply"}</label>
            <textarea id="reply-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} aria-invalid={fieldErr ? true : undefined} aria-describedby={fieldErr ? "reply-err" : undefined}
              className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive md:text-sm" />
            {fieldErr && <p id="reply-err" className="mt-1 text-sm text-destructive">{String(fieldErr)}</p>}
          </div>
          <FileAttach value={files} onChange={setFiles} disabled={busy} />
          {error && !fieldErr && <ErrorNotice error={error} />}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={busy || !body.trim()}><Send aria-hidden="true" /> {busy ? "Sending..." : "Send reply"}</Button>
            {resolved && <Button type="button" variant="outline" className="min-h-11" onClick={() => act("close")}>Close request</Button>}
          </div>
        </form>
      )}
    </div>
  );
}

export default function TicketDetail() {
  const id = useSearchParams().get("id") || "";
  const { actor } = usePlatform();
  const q = usePlatformQuery((p, a) => (id ? p.tickets.get(a, id) : { ok: false, error: { code: "NOT_FOUND", message: "No request was specified." } }), [id]);
  if (q.loading) return <LoadingState label="Loading request" rows={4} />;
  if (q.error) {
    return (
      <div className="space-y-4">
        <ErrorNotice error={q.error} onRetry={q.refetch} />
        <Button asChild variant="outline" className="min-h-11"><Link href="/help/tickets"><ArrowLeft aria-hidden="true" /> Back to your requests</Link></Button>
      </div>
    );
  }
  if (!q.data || !actor) return null;
  return <Body data={q.data} actor={actor} />;
}
