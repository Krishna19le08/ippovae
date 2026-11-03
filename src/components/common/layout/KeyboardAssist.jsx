"use client";
import { useEffect } from "react";

const FIELD = "input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select";

// On phones the on-screen keyboard (and the sticky header) can cover the field being typed in.
// Bring the focused field to the middle of the visible area when it gets focus and again when the keyboard finishes opening.
export default function KeyboardAssist() {
  useEffect(() => {
    const reveal = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches(FIELD)) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    };
    let t;
    const onFocus = (e) => {
      if (!(e.target instanceof HTMLElement) || !e.target.matches(FIELD)) return;
      clearTimeout(t);
      t = setTimeout(reveal, 300); // let the keyboard start opening first
    };
    const vv = window.visualViewport;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(reveal, 100);
    };
    document.addEventListener("focusin", onFocus);
    vv?.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      document.removeEventListener("focusin", onFocus);
      vv?.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}
