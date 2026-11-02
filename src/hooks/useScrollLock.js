import { useEffect } from "react";

// While a drawer or dialog is open the page behind must not scroll (wheel, keys, touch): clip the root.
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [locked]);
}
