// cn(): join class names (strings, arrays, { name: bool } objects; falsy values dropped), then resolve Tailwind
// conflicts so the last class for a property wins, e.g. cn("h-9 px-4", "h-11") -> "px-4 h-11".
// Only the property groups this app actually combines are listed; any class not matched below is kept as-is.

function toList(input, out) {
  if (!input) return out;
  if (typeof input === "string" || typeof input === "number") out.push(String(input));
  else if (Array.isArray(input)) for (const i of input) toList(i, out);
  else if (typeof input === "object") for (const k in input) if (input[k]) out.push(k);
  return out;
}

// split "hover:[&_svg]:size-4!" into variants ["hover", "[&_svg]"] and the utility "size-4", ignoring ":" inside [] / ()
function parseClass(cls) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) { parts.push(cls.slice(start, i)); start = i + 1; }
  }
  let base = cls.slice(start);
  let important = "";
  if (base.startsWith("!")) { important = "!"; base = base.slice(1); }
  if (base.endsWith("!")) { important = "!"; base = base.slice(0, -1); }
  // drop an opacity/line-height modifier ("bg-primary/90", "text-sm/6") but not a "/" inside brackets
  let d = 0;
  for (let i = 0; i < base.length; i++) {
    const c = base[i];
    if (c === "[" || c === "(") d++;
    else if (c === "]" || c === ")") d--;
    else if (c === "/" && d === 0) { base = base.slice(0, i); break; }
  }
  return { variants: parts.sort().join(":") + important, base };
}

const SIDES = "(?:x|y|t|r|b|l|s|e)";
const GROUPS = [
  ["display", /^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|inline-table|contents|flow-root|hidden)$/],
  ["position", /^(?:static|fixed|absolute|relative|sticky)$/],
  ["visibility", /^(?:visible|invisible|collapse)$/],
  ["size", /^size-/], ["w", /^w-/], ["h", /^h-/],
  ["min-w", /^min-w-/], ["min-h", /^min-h-/], ["max-w", /^max-w-/], ["max-h", /^max-h-/],
  ["px", /^px-/], ["py", /^py-/], ["pt", /^pt-/], ["pr", /^pr-/], ["pb", /^pb-/], ["pl", /^pl-/], ["p", /^p-/],
  ["mx", /^-?mx-/], ["my", /^-?my-/], ["mt", /^-?mt-/], ["mr", /^-?mr-/], ["mb", /^-?mb-/], ["ml", /^-?ml-/], ["m", /^-?m-/],
  ["gap-x", /^gap-x-/], ["gap-y", /^gap-y-/], ["gap", /^gap-/],
  ["space-x", /^-?space-x-/], ["space-y", /^-?space-y-/],
  ["rounded-tl", /^rounded-tl(?:-|$)/], ["rounded-tr", /^rounded-tr(?:-|$)/], ["rounded-br", /^rounded-br(?:-|$)/], ["rounded-bl", /^rounded-bl(?:-|$)/],
  ["rounded-t", /^rounded-t(?:-|$)/], ["rounded-r", /^rounded-r(?:-|$)/], ["rounded-b", /^rounded-b(?:-|$)/], ["rounded-l", /^rounded-l(?:-|$)/],
  ["rounded", /^rounded(?:-|$)/],
  [`border-w-x`, /^border-x(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/], [`border-w-y`, /^border-y(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/],
  ["border-w-t", /^border-t(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/], ["border-w-r", /^border-r(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/],
  ["border-w-b", /^border-b(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/], ["border-w-l", /^border-l(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/],
  ["border-w", /^border(?:-(?:0|2|4|8|\[[\d.]+(?:px|rem)?\]))?$/],
  ["border-style", /^border-(?:solid|dashed|dotted|double|hidden|none)$/],
  [`border-color-side`, new RegExp(`^border-${SIDES}-`)],
  ["border-color", /^border-(?!collapse$|separate$|spacing)/],
  ["text-align", /^text-(?:left|center|right|justify|start|end)$/],
  ["text-wrap", /^text-(?:wrap|nowrap|balance|pretty)$/],
  ["text-overflow", /^text-(?:ellipsis|clip)$/],
  ["font-size", /^text-(?:xs|sm|base|lg|xl|\d+xl|\[[\d.]+(?:px|rem|em)\])$/],
  ["text-color", /^text-/],
  ["font-family", /^font-(?:sans|serif|mono)$/],
  ["font-weight", /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/],
  ["leading", /^leading-/], ["tracking", /^tracking-/],
  ["text-transform", /^(?:uppercase|lowercase|capitalize|normal-case)$/],
  ["text-decoration", /^(?:underline|overline|line-through|no-underline)$/],
  ["whitespace", /^whitespace-/],
  ["bg-image", /^bg-(?:none|linear|gradient|radial|conic)/],
  ["bg-size", /^bg-(?:auto|cover|contain)$/],
  ["bg-position", /^bg-(?:center|top|bottom|left|right)/],
  ["bg-repeat", /^bg-(?:repeat|no-repeat)/],
  ["bg-attach", /^bg-(?:fixed|local|scroll)$/],
  ["bg-clip", /^bg-clip-/], ["bg-origin", /^bg-origin-/],
  ["bg-color", /^bg-/],
  ["from", /^from-/], ["via", /^via-/], ["to", /^to-/],
  ["shadow", /^shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner|none|\[.*\]))?$/],
  ["shadow-color", /^shadow-/],
  ["ring-offset-w", /^ring-offset-(?:\d+|\[[\d.]+(?:px|rem)?\])$/],
  ["ring-offset-color", /^ring-offset-/],
  ["ring-w", /^ring(?:-(?:\d+|\[[\d.]+(?:px|rem)?\]))?$/],
  ["ring-inset", /^ring-inset$/],
  ["ring-color", /^ring-/],
  ["outline-offset", /^-?outline-offset-/],
  ["outline-w", /^outline-(?:\d+|\[[\d.]+(?:px|rem)?\])$/],
  ["outline-style", /^outline(?:-(?:none|solid|dashed|dotted|double|hidden))?$/],
  ["outline-color", /^outline-/],
  ["opacity", /^opacity-/], ["z", /^-?z-/],
  ["inset-x", /^-?inset-x-/], ["inset-y", /^-?inset-y-/], ["inset", /^-?inset-/],
  ["top", /^-?top-/], ["right", /^-?right-/], ["bottom", /^-?bottom-/], ["left", /^-?left-/],
  ["flex-direction", /^flex-(?:row|col)(?:-reverse)?$/],
  ["flex-wrap", /^flex-(?:wrap|nowrap|wrap-reverse)$/],
  ["flex", /^flex-(?:1|auto|initial|none)$/],
  ["grow", /^(?:grow|flex-grow)(?:-|$)/], ["shrink", /^(?:shrink|flex-shrink)(?:-|$)/], ["basis", /^basis-/],
  ["items", /^items-/], ["justify", /^justify-(?:start|end|center|between|around|evenly|stretch|normal)$/],
  ["justify-items", /^justify-items-/], ["justify-self", /^justify-self-/], ["content", /^content-/], ["self", /^self-/],
  ["overflow-x", /^overflow-x-/], ["overflow-y", /^overflow-y-/], ["overflow", /^overflow-/],
  ["transition", /^transition(?:-|$)/], ["duration", /^duration-/], ["ease", /^ease-/], ["delay", /^delay-/],
  ["animate", /^animate-/], ["cursor", /^cursor-/], ["select", /^select-/], ["pointer-events", /^pointer-events-/],
  ["grid-cols", /^grid-cols-/], ["grid-rows", /^grid-rows-/],
  ["translate-x", /^-?translate-x-/], ["translate-y", /^-?translate-y-/], ["scale", /^-?scale-/], ["rotate", /^-?rotate-/],
  ["aspect", /^aspect-/], ["object-fit", /^object-(?:contain|cover|fill|none|scale-down)$/],
  ["fill", /^fill-/], ["stroke-w", /^stroke-(?:\d+|\[[\d.]+\])$/], ["stroke", /^stroke-/],
];

// a utility in the left group also overrides these earlier-set groups ("p-4" replaces an earlier "px-3")
const OVERRIDES = {
  size: ["w", "h"],
  p: ["px", "py", "pt", "pr", "pb", "pl"], px: ["pr", "pl"], py: ["pt", "pb"],
  m: ["mx", "my", "mt", "mr", "mb", "ml"], mx: ["mr", "ml"], my: ["mt", "mb"],
  gap: ["gap-x", "gap-y"],
  rounded: ["rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
  "rounded-t": ["rounded-tl", "rounded-tr"], "rounded-r": ["rounded-tr", "rounded-br"],
  "rounded-b": ["rounded-br", "rounded-bl"], "rounded-l": ["rounded-tl", "rounded-bl"],
  "border-w": ["border-w-x", "border-w-y", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
  "border-w-x": ["border-w-r", "border-w-l"], "border-w-y": ["border-w-t", "border-w-b"],
  inset: ["inset-x", "inset-y", "top", "right", "bottom", "left"], "inset-x": ["left", "right"], "inset-y": ["top", "bottom"],
  overflow: ["overflow-x", "overflow-y"],
  flex: ["grow", "shrink", "basis"],
  "font-size": ["leading"],
};

const groupCache = new Map();
function groupOf(base) {
  let g = groupCache.get(base);
  if (g === undefined) {
    g = null;
    for (const [name, re] of GROUPS) if (re.test(base)) { g = name; break; }
    groupCache.set(base, g);
  }
  return g;
}

export function cn(...inputs) {
  const classes = toList(inputs, []).join(" ").split(/\s+/).filter(Boolean);
  const taken = new Set();
  const kept = [];
  // walk backwards so the last class for a property wins
  for (let i = classes.length - 1; i >= 0; i--) {
    const { variants, base } = parseClass(classes[i]);
    const group = groupOf(base);
    if (group) {
      if (taken.has(`${variants}|${group}`)) continue;
      taken.add(`${variants}|${group}`);
      for (const g of OVERRIDES[group] ?? []) taken.add(`${variants}|${g}`);
    }
    kept.push(classes[i]);
  }
  return kept.reverse().join(" ");
}

// Smooth-scroll the products section into view; html's scroll-padding-top leaves room for the sticky header.
export function scrollToProducts() {
  const el = document.getElementById("products");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth" });
}
