// The only module allowed to read the real time. Services receive a clock and never call Date.now() themselves.

const toIso = (ms) => new Date(ms).toISOString();

export function createClock(start = "2026-10-24T09:00:00.000Z") {
  let t = typeof start === "number" ? start : Date.parse(start);
  return {
    now: () => t,
    iso: () => toIso(t),
    advance(ms) { t += ms; return t; },
    set(v) { t = typeof v === "number" ? v : Date.parse(v); return t; },
  };
}

export const systemClock = {
  now: () => Date.now(),
  iso: () => toIso(Date.now()),
  advance() { throw new Error("systemClock cannot be advanced"); },
  set() { throw new Error("systemClock cannot be set"); },
};

export const addMs = (iso, ms) => toIso(Date.parse(iso) + ms);
export const isPast = (iso, nowMs) => iso != null && Date.parse(iso) <= nowMs;
