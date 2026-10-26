# Dependency migration tracker

Removed: `lucide-react`, `lenis`, `clsx`, `tailwind-merge`, `radix-ui`, `tw-animate-css`, and the shadcn config (`components.json`).
Kept on purpose: Next 16, React 19, Tailwind v4, `class-variance-authority`.
Not touched (unused, not in scope): `cn` (npm package; nothing imports it).

Status values: DISCOVERED → INSPECTED → ASSIGNED → IMPLEMENTED → INTEGRATED → TESTED → VERIFIED

| Area | Files | Replacement | Status | Verification |
|---|---|---|---|---|
| Icons (61 Lucide icons, 32 files) | all `from "lucide-react"` imports | `components/icons.jsx`: inline SVG, geometry generated from the installed Lucide data; same export names, `size`/`strokeWidth`/`className` props, `aria-hidden` unless labelled | VERIFIED | 91 prerendered pages identical to baseline except SVG root attributes; 80 icons render on `/`, no console errors |
| `cn()` (clsx + tailwind-merge) | `lib/utils.js` | native join + Tailwind conflict resolution for the property groups the app combines | VERIFIED | differential test vs real `twMerge`: 2438 base x call-site className combos, 0 differ |
| Radix `Slot` (`asChild`) | `components/ui/button.jsx`, `badge.jsx` | `components/ui/slot.jsx` (className joined, style merged, handlers composed, child props win) | VERIFIED | `asChild` links render identically in all 91 pages; `h-11` override beats variant `h-9` in browser |
| shadcn components | `components/ui/*` (alert, badge, button, card, input, skeleton) | kept as app-owned files; no shadcn/Radix imports left, `components.json` deleted | VERIFIED | build + HTML comparison |
| Lenis | `components/Choreo.jsx` (deleted) + 7 route/shell files, `Header.jsx`, `lib/utils.js`, 9 `data-lenis-prevent` attrs | CSS `scroll-behavior: smooth` (no-preference only) + existing `scroll-padding-top: 7.5rem`; `data-scroll-behavior="smooth"` on `<html>` per Next 16 docs; `scrollTo(..., "instant")` for the two programmatic jumps | VERIFIED (static + cart/scroll-lock flow); smooth-anchor feel NOT compared side by side | see report |
| `tw-animate-css` | `app/globals.css`, `CartButton`, `CardPayment`, `Header` | `anim-fade-zoom-in`, `anim-pop-in`, `anim-pop-in-slow` + `@keyframes` in `globals.css`, none under reduced motion | VERIFIED | computed `animation-name/duration` read in browser |

## Checks run
- `npm run build` before changes: pass. After: pass, same route table (93 pages).
- `NEXT_PUBLIC_BASE_PATH=/Know-Ecommerce npm run build` (static export): pass, 93 HTML pages, assets under `/Know-Ecommerce/`, no `lenis`/`lucide` in output JS.
- `npm ci --dry-run`: lockfile in sync (CI uses `npm ci`).
- Browser (production server): add to cart, quantity stepper, badge animation, drawer open, root scroll lock, Escape close, focus return.

## Not checked
- No pixel/screenshot diff against the original (no baseline screenshots were taken); equivalence rests on identical prerendered HTML plus a browser spot-check.
- Login modal, checkout, order cancel, tickets, file attach were not clicked through; their markup is identical in the HTML comparison but runtime behaviour was not exercised.
- Dynamic (non-literal) `className` values passed to ui components were not covered by the `cn` differential test.
- Native smooth scrolling feels different from Lenis's lerp easing; this is an accepted difference of the replacement.
