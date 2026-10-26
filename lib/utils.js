import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Lenis owns the page scroll, so go through it when it's running; native smooth scroll fights it.
export function scrollToProducts() {
  const el = document.getElementById("products");
  if (!el) return;
  if (window.lenis) window.lenis.scrollTo(el, { offset: -120 });
  else el.scrollIntoView({ behavior: "smooth" });
}
