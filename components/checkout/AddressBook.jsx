"use client";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Home, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import AddressForm from "@/components/checkout/AddressForm";
import {
  addressLines,
  ensureProfile,
  makeDefault,
  removeAddress,
  saveAddress,
  setSelectedId,
  useAddresses,
} from "@/lib/addresses";

const linkBase = "inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring";
const linkBtn = `${linkBase} text-foreground`;
const dangerBtn = `${linkBase} text-red-700`;

function Chip({ type }) {
  const Icon = type === "work" ? Briefcase : Home;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      <Icon className="size-3" aria-hidden="true" /> {type === "work" ? "Work" : "Home"}
    </span>
  );
}

function Body({ a }) {
  const { line1, line2 } = addressLines(a);
  return (
    <span className="block min-w-0 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{a.name || "Name not set"}</span>
        <Chip type={a.type} />
        {a.isDefault && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-foreground">Default</span>}
      </span>
      <span className="mt-1 block text-muted-foreground">{line1}</span>
      <span className="block text-muted-foreground">{line2}</span>
      <span className="mt-1 block text-muted-foreground">Mobile: {a.phone || "not set"}</span>
    </span>
  );
}

/**
 * Saved addresses. mode="checkout": selectable cards + "Deliver to this address" (onDeliver).
 * mode="manage": plain list for the profile dialog.
 * `startAdding` opens straight on the add form. Parent reads `headingRef` to move focus.
 */
export default function AddressBook({ mode = "checkout", onDeliver, startAdding = false, headingRef }) {
  const { list, selected, ready } = useAddresses();
  const [editing, setEditing] = useState(null); // null | "new" | address
  const [sel, setSel] = useState("");
  const [confirm, setConfirm] = useState(""); // id awaiting remove confirmation
  const [msg, setMsg] = useState("");
  const [seeded, setSeeded] = useState(false);
  const listRef = useRef(null);
  const formHeadRef = useRef(null);
  const cancelRef = useRef(null);
  const rootRef = useRef(null);
  const checkout = mode === "checkout";

  // no saved addresses (or asked to): go straight to the form
  useEffect(() => {
    if (!ready || seeded) return;
    setSeeded(true);
    if (startAdding || (checkout && list.length === 0)) setEditing("new");
  }, [ready, seeded, startAdding, list.length, checkout]);

  const chosen = list.some((a) => a.id === sel) ? sel : selected?.id || "";

  useEffect(() => {
    if (confirm) cancelRef.current?.focus();
  }, [confirm]);

  const goForm = (v) => {
    setEditing(v);
    setMsg("");
    setTimeout(() => formHeadRef.current?.focus(), 0);
  };
  const backToList = () => {
    setEditing(null);
    setTimeout(() => listRef.current?.focus(), 0);
  };

  // put focus on a stable control of one card (the card's own button may have just disappeared)
  const focusCard = (id, act) =>
    setTimeout(() => rootRef.current?.querySelector(`[data-addr="${id}"][data-act="${act}"]`)?.focus(), 0);

  const onSave = (data) => {
    const firstEver = list.length === 0;
    const saved = saveAddress(data);
    ensureProfile(saved);
    setSel(saved.id);
    if (checkout) setSelectedId(saved.id); // checkout will deliver to the address just saved
    if (checkout && firstEver && onDeliver) {
      // first address ever: it is already chosen, go straight on to the order summary
      onDeliver(saved);
      return;
    }
    setMsg(editing === "new" ? "Address added." : "Address updated.");
    setEditing(null);
    setTimeout(() => listRef.current?.focus(), 0);
  };

  if (!ready) return null;

  if (editing) {
    return (
      <AddressForm
        key={editing === "new" ? "new" : editing.id}
        initial={editing === "new" ? null : editing}
        isFirst={list.length === 0}
        headingRef={formHeadRef}
        title={editing === "new" ? (list.length ? "Add a new address" : "Add your delivery address") : "Edit address"}
        onSave={onSave}
        onCancel={list.length ? backToList : undefined}
        submitLabel={editing === "new" ? (checkout ? "Save and deliver here" : "Save address") : "Save changes"}
      />
    );
  }

  const deliver = (a) => {
    setSelectedId(a.id);
    onDeliver?.(a);
  };

  return (
    <div ref={rootRef}>
      <h3 ref={(el) => { listRef.current = el; if (headingRef) headingRef.current = el; }} tabIndex={-1} className="mb-3 text-base font-bold outline-none">
        {checkout ? "Choose a delivery address" : "Saved addresses"}
      </h3>
      <p role="status" aria-live="polite" className="sr-only">{msg}</p>

      {list.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">You have no saved addresses yet.</p>
      ) : (
        <div role={checkout ? "radiogroup" : "list"} aria-label="Saved addresses" className="space-y-3">
          {list.map((a) => {
            const on = chosen === a.id;
            return (
              <div
                key={a.id}
                role={checkout ? undefined : "listitem"}
                className={`rounded-xl border p-3 transition-colors ${checkout && on ? "border-foreground bg-accent" : "border-slate-200"}`}
              >
                {checkout ? (
                  <label className="flex cursor-pointer items-start gap-3 has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                    <input type="radio" name="kn-delivery-address" value={a.id} checked={on} onChange={() => { setSel(a.id); setSelectedId(a.id); }} className="mt-1 size-5 shrink-0 accent-foreground" />
                    <Body a={a} />
                  </label>
                ) : (
                  <Body a={a} />
                )}

                {confirm === a.id ? (
                  <div role="group" aria-label="Confirm removal" className="mt-2 rounded-lg bg-red-50 p-3 text-sm">
                    <p className="font-medium text-red-700">Remove this address?</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          removeAddress(a.id);
                          setConfirm("");
                          setMsg("Address removed.");
                          setTimeout(() => listRef.current?.focus(), 0);
                        }}
                        className="h-10 flex-1 rounded-lg"
                      >
                        Yes, remove
                      </Button>
                      <Button ref={cancelRef} type="button" variant="outline" onClick={() => { setConfirm(""); focusCard(a.id, "remove"); }} className="h-10 flex-1 rounded-lg">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-1 flex flex-wrap items-center gap-x-1 ${checkout ? "pl-8" : ""}`}>
                    <button type="button" data-addr={a.id} data-act="edit" className={linkBtn} onClick={() => goForm(a)} aria-label={`Edit address for ${a.name || "this contact"}, ${a.type === "work" ? "Work" : "Home"}`}>
                      Edit
                    </button>
                    <button type="button" data-addr={a.id} data-act="remove" className={dangerBtn} onClick={() => setConfirm(a.id)} aria-label={`Remove address for ${a.name || "this contact"}, ${a.type === "work" ? "Work" : "Home"}`}>
                      Remove
                    </button>
                    {!a.isDefault && (
                      <button
                        type="button"
                        className={linkBtn}
                        onClick={() => {
                          makeDefault(a.id);
                          setSel(a.id);
                          setMsg("Default address updated.");
                          focusCard(a.id, "edit");
                        }}
                        aria-label={`Set address for ${a.name || "this contact"}, ${a.type === "work" ? "Work" : "Home"} as default`}
                      >
                        Set as default
                      </button>
                    )}
                  </div>
                )}

                {checkout && on && confirm !== a.id && (
                  <Button type="button" onClick={() => deliver(a)} className="mt-2 h-11 w-full rounded-xl">
                    Deliver to this address
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" variant="outline" onClick={() => goForm("new")} className="mt-3 h-11 w-full rounded-xl border-foreground text-foreground">
        <Plus /> {checkout ? "Add a new address" : "Add address"}
      </Button>
    </div>
  );
}

