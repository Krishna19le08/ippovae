// Money is integer paise everywhere.

export const isMoney = (n) => Number.isInteger(n) && n >= 0;
export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const formatINR = (paise) => {
  const r = paise / 100;
  return `Rs ${r.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 })}`;
};

// round-half-up of amount * bp / 10000
export const bpOf = (amount, bp) => Math.floor((amount * bp + 5000) / 10000);

// floor(amount * num / den) without float drift for realistic sizes
export const prorate = (amount, num, den) => (den === 0 ? 0 : Math.floor((amount * num) / den));

// Largest-remainder allocation: parts sum exactly to total, proportional to weights.
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) base[order[k].i] += 1;
  return base;
}
