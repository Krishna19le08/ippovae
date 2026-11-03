"use client";
import { useEffect } from "react";

export default function Error({ err, statusCode }) {
  useEffect(() => {
    if (err) console.error(err);
  }, [err]);

  return (
    <main id="main-content" className="mx-auto flex max-w-[1312px] flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">An unexpected error stopped this page from loading. Try again, or clear the saved demo data if it keeps happening.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground">
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            try { localStorage.clear(); } catch {}
            window.location.assign("/");
          }}
          className="min-h-11 rounded-full border border-border px-6 text-base font-semibold"
        >
          Clear demo data
        </button>
      </div>
    </main>
  );
}
