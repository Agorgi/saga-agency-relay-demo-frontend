"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

// Route-segment error boundary. Wraps every page below src/app/ and
// renders a recoverable error UI without unmounting the root layout.
export default function RouteError({
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
    <main
      style={{
        margin: "0 auto",
        padding: "64px 24px",
        maxWidth: 520,
        textAlign: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
        We hit a snag.
      </h1>
      <p
        style={{
          marginTop: 10,
          fontSize: 14,
          lineHeight: 1.6,
          color: "#555",
        }}
      >
        The issue has been reported. Try again, or head back to start.
      </p>
      <div
        style={{
          marginTop: 22,
          display: "flex",
          gap: 10,
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "9px 16px",
            borderRadius: 9999,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: "9px 16px",
            borderRadius: 9999,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
