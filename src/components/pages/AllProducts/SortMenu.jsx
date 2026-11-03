"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "@/components/ui/icons";
import { sorts } from "./sorts";

// Dropdown for the sort order. Arrow keys/Home/End move through it; Escape closes it and returns focus to the button.
export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const panelId = useId();

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // focus the current choice so the keyboard starts where the user is
    (listRef.current?.querySelector('[aria-current="true"]') || listRef.current?.querySelector("button"))?.focus();

    const closeOnOutsideClick = (e) => {
      if (ref.current?.contains(e.target)) return;
      setOpen(false);
      // a click on something non-focusable would otherwise drop focus to <body>
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) btnRef.current?.focus();
      }, 0);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
      return;
    }
    if (!open || !listRef.current?.contains(e.target)) return;
    if (e.key === "Tab") return setOpen(false); // focus moves on naturally

    const buttons = [...listRef.current.querySelectorAll("button")];
    const current = buttons.indexOf(document.activeElement);
    const target = {
      ArrowDown: (current + 1) % buttons.length,
      ArrowUp: (current - 1 + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    }[e.key];
    if (target !== undefined) {
      e.preventDefault();
      buttons[target].focus();
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex h-10 items-center gap-2 rounded-lg border border-input bg-white px-3 text-sm shadow-xs transition-colors hover:border-foreground/40"
      >
        <span className="text-muted-foreground">Sort:</span>
        <span className="font-medium">{sorts[value][0]}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={panelId}
          ref={listRef}
          aria-label="Sort products by"
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {Object.entries(sorts).map(([key, [label]]) => (
            <li key={key}>
              <button
                type="button"
                aria-current={key === value ? "true" : undefined}
                onClick={() => {
                  onChange(key);
                  close();
                }}
                className={`flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-offset-[-2px] ${
                  key === value ? "font-medium text-foreground" : ""
                }`}
              >
                {label}
                {key === value && <Check className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
