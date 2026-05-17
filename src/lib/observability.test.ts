import assert from "node:assert/strict";
import test from "node:test";
import {
  captureServerError,
  sentryEnabled,
  sentryHealthSummary,
} from "@/lib/observability";

test("sentryEnabled is false when SENTRY_DSN is unset", () => {
  const original = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    assert.equal(sentryEnabled(), false);
  } finally {
    if (original !== undefined) {
      process.env.SENTRY_DSN = original;
    }
  }
});

test("sentryEnabled is true when SENTRY_DSN is set", () => {
  const original = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://example@sentry.io/1";
  try {
    assert.equal(sentryEnabled(), true);
  } finally {
    if (original === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = original;
    }
  }
});

test("sentryHealthSummary never exposes the DSN value", () => {
  const original = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = "https://supersecret@sentry.io/123";
  try {
    const summary = sentryHealthSummary();
    const serialized = JSON.stringify(summary);
    assert.equal(summary.dsn_configured, true);
    assert.equal(serialized.includes("supersecret"), false);
    assert.equal(serialized.includes("sentry.io/123"), false);
  } finally {
    if (original === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = original;
    }
  }
});

test("sentryHealthSummary reports default environment when unset", () => {
  const originals = {
    dsn: process.env.SENTRY_DSN,
    env: process.env.SENTRY_ENVIRONMENT,
    vercelEnv: process.env.VERCEL_ENV,
  };
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_ENVIRONMENT;
  delete process.env.VERCEL_ENV;
  try {
    const summary = sentryHealthSummary();
    assert.equal(summary.dsn_configured, false);
    // NODE_ENV is set by the test runner (typically "test"); the
    // helper must always produce a non-empty string for the field.
    assert.equal(typeof summary.environment, "string");
    assert.equal(summary.environment.length > 0, true);
  } finally {
    if (originals.dsn !== undefined) process.env.SENTRY_DSN = originals.dsn;
    if (originals.env !== undefined) process.env.SENTRY_ENVIRONMENT = originals.env;
    if (originals.vercelEnv !== undefined) process.env.VERCEL_ENV = originals.vercelEnv;
  }
});

test("captureServerError never throws when SENTRY_DSN is unset", () => {
  const original = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    // logServerError writes to console.error; capture it so the
    // test output stays clean.
    const originalError = console.error;
    const calls: unknown[][] = [];
    console.error = (...args: unknown[]) => calls.push(args);
    try {
      assert.doesNotThrow(() =>
        captureServerError("test_action", new Error("boom"), {
          metadata: { foo: "bar" },
          tags: { route: "/api/test" },
        }),
      );
      // The structured log line should still be written even when
      // Sentry is disabled.
      assert.equal(calls.length >= 1, true);
    } finally {
      console.error = originalError;
    }
  } finally {
    if (original !== undefined) {
      process.env.SENTRY_DSN = original;
    }
  }
});

test("captureServerError redacts sensitive context via structured log", () => {
  const original = process.env.SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  try {
    const originalError = console.error;
    let captured = "";
    console.error = (line: string) => {
      captured = line;
    };
    try {
      captureServerError("test_redaction", new Error("boom"), {
        metadata: {
          email: "alex@try-saga.com",
          phone: "+1 415-555-1234",
          token: "secret-token-value",
        },
      });
      // Email + phone + token-keyed values must all be redacted in
      // the structured log line.
      assert.equal(captured.includes("alex@try-saga.com"), false);
      assert.equal(captured.includes("415-555-1234"), false);
      assert.equal(captured.includes("secret-token-value"), false);
    } finally {
      console.error = originalError;
    }
  } finally {
    if (original !== undefined) {
      process.env.SENTRY_DSN = original;
    }
  }
});
