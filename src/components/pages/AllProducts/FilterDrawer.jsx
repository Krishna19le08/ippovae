"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/useDialogFocus";

// Mobile filter drawer: a modal dialog portaled to <body> like the other overlays.
export default function FilterDrawer({ open, onClose, activeCount, resultCount, onClear, children }) {
  const drawerRef = useDialogFocus(open);

  // the drawer is for small screens only: close it if the window grows past the sidebar breakpoint
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeIfWide = () => wide.matches && onClose();
    const closeOnEscape = (e) => e.key === "Escape" && onClose();
    wide.addEventListener("change", closeIfWide);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      wide.removeEventListener("change", closeIfWide);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="slim-scroll absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white p-5 text-foreground"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="-m-1 flex size-10 items-center justify-center rounded-md"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {children}
        {/* stays at the bottom of the drawer so the filters can be applied without scrolling back down */}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 space-y-3 border-t border-slate-200 bg-white px-5 pt-3 pb-5">
          {activeCount > 0 && (
            <Button variant="outline" className="w-full" onClick={onClear}>
              Clear all
            </Button>
          )}
          <Button className="w-full" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? "product" : "products"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
