"use client";
import { useId, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlatform } from "@/lib/platform-ui/PlatformProvider";

const readData = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(fr.error);
  fr.readAsDataURL(file);
});

/**
 * Controlled file picker for ticket messages. value: attachment[] ; onChange(next).
 * Each attachment is { file_name, mime_type, size_bytes, data } (data is a data URL), the shape p.tickets.* expects in
 * `attachments`; the platform's upload gateway stores it. Type and size limits come from p.policies (also enforced there).
 */
export default function FileAttach({ value = [], onChange, label = "Attach files", disabled }) {
  const { p } = usePlatform();
  const id = useId();
  const input = useRef(null);
  const [error, setError] = useState("");
  const limits = p.policies.attachments;
  const max = p.policies.tickets?.max_attachments ?? 5;
  const kb = Math.round(limits.max_bytes / 1024);

  const add = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    setError("");
    const next = [...value];
    for (const f of files) {
      if (next.length >= max) { setError(`You can attach at most ${max} files.`); break; }
      if (!limits.mime_types.includes(f.type)) { setError(`${f.name}: use a JPG, PNG, WebP or PDF file.`); continue; }
      if (f.size > limits.max_bytes) { setError(`${f.name}: file is larger than ${kb} KB.`); continue; }
      try { next.push({ file_name: f.name, mime_type: f.type, size_bytes: f.size, data: await readData(f) }); }
      catch { setError(`${f.name}: could not read this file.`); }
    }
    onChange?.(next);
  };

  return (
    <div>
      <input ref={input} id={id} type="file" multiple accept={limits.mime_types.join(",")} onChange={add} disabled={disabled} className="sr-only" tabIndex={-1} aria-describedby={`${id}-hint`} />
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled || value.length >= max} onClick={() => input.current?.click()}>
        <Paperclip aria-hidden="true" /> {label}
      </Button>
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or PDF, up to {kb} KB each, max {max} files.</p>
      {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
      {value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.map((a, i) => (
            <li key={`${a.file_name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1 text-sm">
              <span className="min-w-0 truncate">{a.file_name} <span className="text-muted-foreground">({Math.max(1, Math.round(a.size_bytes / 1024))} KB)</span></span>
              <button type="button" aria-label={`Remove ${a.file_name}`} onClick={() => onChange?.(value.filter((_, j) => j !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-slate-100">
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
