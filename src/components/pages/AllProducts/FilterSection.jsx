"use client";
import { useState } from "react";
import { ChevronDown } from "@/components/ui/icons";

// A collapsible group in the filter panel (Category, Brand, Price...).
export default function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-sm font-semibold"
      >
        {title}
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
