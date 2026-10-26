import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// can this element take focus right now? (a removed element, or one inside an inert tree, cannot)
const usable = (el) => el instanceof HTMLElement && el !== document.body && el.isConnected && !el.closest("[inert]");

// Keeps Tab inside an open dialog and hands focus back to whatever opened it. Put the returned ref on the dialog element.
// `returnRef` (optional, a ref holding an element) is used when the opener is gone or inert by the time the
// dialog closes, e.g. it lived in a menu or drawer that closed first.
export function useDialogFocus(open, returnRef) {
  const ref = useRef(null);
  const openerRef = useRef(null);
  const wasOpen = useRef(false);
  const fallbackRef = useRef(returnRef);
  fallbackRef.current = returnRef;
  // read during render, before an autoFocus'd field inside the dialog steals focus
  if (open && !wasOpen.current && typeof document !== "undefined") openerRef.current = document.activeElement;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const opener = openerRef.current;
    const items = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (!node.contains(document.activeElement)) (items()[0] || node).focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== "Tab" || e.defaultPrevented) return; // a dropdown (Radix Select) inside the dialog handles its own Tab
      const list = items();
      if (!list.length) return e.preventDefault();
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const back = usable(opener) ? opener : fallbackRef.current?.current;
      if (usable(back)) back.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
