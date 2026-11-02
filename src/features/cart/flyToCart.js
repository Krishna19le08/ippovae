// "Add to cart" feedback: a small star lifts off the button, arcs to the header cart icon, and the icon bumps.
// Pure Web Animations API (no library). Skipped for reduced motion or when no cart icon is on screen.
const STAR =
  '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="#E8FF00" stroke="#0B0B0B" stroke-width="1.5" stroke-linejoin="round"/></svg>';

export function flyToCart(from) {
  if (typeof window === "undefined" || !from?.getBoundingClientRect) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = [...document.querySelectorAll("[data-cart-target]")].find((t) => t.getBoundingClientRect().width); // header icon on desktop, tab-bar icon on phones
  if (!target?.animate) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!b.width || !a.width) return;

  const launch = (size, delay, main) => {
    const sx = a.left + a.width / 2 - size / 2;
    const sy = a.top + a.height / 2 - size / 2;
    const dx = b.left + b.width / 2 - size / 2 - sx;
    const dy = b.top + b.height / 2 - size / 2 - sy;
    const lift = Math.min(120, Math.max(50, Math.abs(dy) * 0.25 + 40)); // rise above the straight line first
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = STAR;
    Object.assign(el.style, {
      position: "fixed",
      left: `${sx}px`,
      top: `${sy}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: "90",
      pointerEvents: "none",
      opacity: "0",
      filter: "drop-shadow(0 2px 4px rgb(128 32 224 / 0.5))",
    });
    document.body.appendChild(el);
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(0.6) rotate(0deg)", opacity: 0 },
        { transform: `translate(${dx * 0.25}px,${dy * 0.25 - lift}px) scale(1.2) rotate(120deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx * 0.7}px,${dy * 0.7 - lift * 0.5}px) scale(1) rotate(260deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${dx}px,${dy}px) scale(0.4) rotate(360deg)`, opacity: 0.9 },
      ],
      { duration: 800, delay, easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)", fill: "backwards" },
    );
    const done = () => {
      el.remove();
      if (main)
        target.animate(
          [
            { transform: "scale(1) rotate(0deg)" },
            { transform: "scale(1.35) rotate(-12deg)", offset: 0.35 },
            { transform: "scale(0.95) rotate(4deg)", offset: 0.7 },
            { transform: "scale(1) rotate(0deg)" },
          ],
          { duration: 380, easing: "ease-out" },
        );
    };
    anim.onfinish = done;
    anim.oncancel = () => el.remove();
  };

  launch(22, 0, true);
  launch(11, 70, false); // two faint sparks trailing the star
  launch(8, 140, false);
}
