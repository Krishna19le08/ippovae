"use client";

export default function GlobalError({ retry }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred.</p>
        <button type="button" onClick={() => retry()} style={{ minHeight: 44, padding: "0 24px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
