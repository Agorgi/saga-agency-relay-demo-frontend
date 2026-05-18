"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root-layout error boundary. Catches errors that escape the route
// segment error boundary (src/app/error.tsx) and renders a minimal
// HTML shell so the user always sees a recovery affordance instead
// of a hard crash.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "48px 24px",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#111",
          background: "#f7f7f8",
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
            Something broke on our end.
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              lineHeight: 1.6,
              color: "#555",
            }}
          >
            Try again in a moment. If it keeps happening, the issue has been
            reported.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 18px",
              borderRadius: 9999,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
