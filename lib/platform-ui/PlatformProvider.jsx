"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPlatform } from "@/lib/platform/index.js";

// One platform instance per browser tab (module singleton, so every role layout shares it).
let instance = null;
export function getPlatform() {
  if (!instance) instance = createPlatform();
  return instance;
}

const Ctx = createContext(null);
export const USER_EVENT = "kn-user-changed"; // same event the shop login dispatches
const JOB_MS = 5000;

const readEmail = () => (typeof localStorage === "undefined" ? "" : (localStorage.getItem("kn-user") || "").trim().toLowerCase());

// Demo sign-in/out through the same keys the shop uses, so the shop header and role consoles stay in step.
export function setDemoUser(email, name) {
  if (email) {
    localStorage.setItem("kn-user", email);
    if (name) localStorage.setItem("kn-user-name", name);
  } else {
    localStorage.removeItem("kn-user");
    localStorage.removeItem("kn-user-name");
  }
  window.dispatchEvent(new Event(USER_EVENT));
}

// Wrap each role layout: <PlatformRoot>{children}</PlatformRoot>. Nesting is harmless (inner roots reuse the outer one).
export function PlatformRoot({ children }) {
  const outer = useContext(Ctx);
  if (outer) return children;
  return <Root>{children}</Root>;
}

function Root({ children }) {
  const p = getPlatform();
  const [email, setEmail] = useState(null); // null = not read yet
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const sync = () => setEmail(readEmail());
    sync();
    window.addEventListener(USER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(USER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // coalesce bursts of change events into one render
  useEffect(() => {
    let timer = 0;
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = 0; setTick((n) => n + 1); }, 0);
    };
    const off = p.subscribe(bump);
    window.addEventListener("kn-platform-changed", bump);
    const onStorage = (e) => { if (e.key && e.key.startsWith("kn:")) bump(); };
    window.addEventListener("storage", onStorage);
    return () => {
      if (typeof off === "function") off();
      window.removeEventListener("kn-platform-changed", bump);
      window.removeEventListener("storage", onStorage);
      clearTimeout(timer);
    };
  }, [p]);

  // background jobs: webhooks, expiries, SLAs, retries
  useEffect(() => {
    const run = () => { try { p.jobs.runDue(); } catch { /* a failing job must not break the UI */ } };
    run();
    const id = setInterval(() => { if (!document.hidden) run(); }, JOB_MS);
    return () => clearInterval(id);
  }, [p]);

  // roles are re-read from the repository, so tick is a dependency
  const actor = useMemo(() => {
    if (email === null) return undefined; // loading
    if (!email) return null;
    try { return p.auth.actorByEmail(email) || null; } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, email, tick]);

  const value = useMemo(() => ({ p, actor, ready: email !== null, version: tick, refresh }), [p, actor, email, tick, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** { p, actor, ready, version, refresh }. actor: undefined while loading, null when signed out. */
export function usePlatform() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlatform must be used inside <PlatformRoot>");
  return v;
}

/** The signed-in demo actor: undefined while loading, null when signed out. */
export function useActor() {
  return usePlatform().actor;
}

const json = (v) => { try { return JSON.stringify(v); } catch { return null; } };
const sameState = (a, b) => a.loading === b.loading && json(a.data) === json(b.data) && json(a.error) === json(b.error);

const isResult = (r) => r && typeof r === "object" && typeof r.ok === "boolean" && ("data" in r || "error" in r);

/**
 * Re-runs fn(p, actor) on mount, when deps change, and on every platform change.
 * fn may return a plain value or a platform result ({ok,data}|{ok:false,error}); results are unwrapped.
 * Returns { data, error, loading, refetch }. Waits for the actor to resolve; when signed out it returns
 * loading:false with no data. Pass { auth: false } to run for signed-out users too.
 */
export function usePlatformQuery(fn, deps = [], { auth = true } = {}) {
  const { p, actor, ready, version } = usePlatform();
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [manual, setManual] = useState(0);
  const refetch = useCallback(() => setManual((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    // Keep the previous state object when nothing changed: a new object on every run re-renders the page, and a
    // page that passes a fresh dep each render would then loop ("Maximum update depth exceeded").
    const put = (next) => setState((prev) => (sameState(prev, next) ? prev : next));
    if (auth && !actor) { put({ data: undefined, error: null, loading: false }); return; }
    try {
      const r = fnRef.current(p, actor);
      if (isResult(r)) put(r.ok ? { data: r.data, error: null, loading: false } : { data: undefined, error: r.error, loading: false });
      else put({ data: r, error: null, loading: false });
    } catch (e) {
      put({ data: undefined, error: { code: e?.code || "INTERNAL", message: e?.message || "Something went wrong.", details: e?.details || {} }, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, actor, ready, version, manual, auth, ...deps]);

  return { ...state, refetch };
}
