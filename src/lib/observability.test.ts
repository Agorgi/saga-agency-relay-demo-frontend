import assert from "node:assert/strict";
import test from "node:test";
import {
  captureServerError,
  sentryEnabled,
  sentryHealthSummary,
} from "@/lib/observability";
import {
  redactForLog,
  SENTRY_REDACT_MAX_DEPTH,
} from "@/sms-engine/safeLogging";

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

test("redactForLog preserves Sentry stack frames when given the Sentry depth limit", () => {
  // Sentry exception events nest frames at
  // event.exception.values[].stacktrace.frames[]. That's depth 6+
  // from the event root. With the default depth limit the frames
  // would get replaced with "[redacted-depth]"; with the Sentry
  // limit they must survive.
  const sentryEvent = {
    event_id: "abc123",
    exception: {
      values: [
        {
          type: "Error",
          value: "boom",
          stacktrace: {
            frames: [
              {
                filename: "/src/lib/observability.ts",
                function: "captureServerError",
                lineno: 42,
                colno: 12,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  };

  const defaultDepth = redactForLog(sentryEvent) as Record<string, unknown>;
  const sentryDepth = redactForLog(
    sentryEvent,
    0,
    SENTRY_REDACT_MAX_DEPTH,
  ) as Record<string, unknown>;

  // Default depth: drilling down to a frame field yields the
  // "[redacted-depth]" sentinel somewhere along the path.
  const defaultSerialized = JSON.stringify(defaultDepth);
  assert.equal(
    defaultSerialized.includes("[redacted-depth]"),
    true,
    "default depth must collapse deep frames (proves the test is exercising the cutoff)",
  );

  // Sentry depth: the full frame survives — filename + function +
  // lineno + colno all present and unredacted.
  const sentrySerialized = JSON.stringify(sentryDepth);
  assert.equal(
    sentrySerialized.includes("[redacted-depth]"),
    false,
    "Sentry depth must preserve stack frames",
  );
  assert.match(sentrySerialized, /observability\.ts/);
  assert.match(sentrySerialized, /captureServerError/);
  assert.match(sentrySerialized, /"lineno":42/);
});

test("redactForLog at Sentry depth still scrubs PII in nested frames", () => {
  // Stack frames can carry function-local vars that contain emails,
  // phones, or tokens. The deeper traversal must not skip redaction.
  const sentryEvent = {
    exception: {
      values: [
        {
          stacktrace: {
            frames: [
              {
                filename: "/src/sensitive.ts",
                function: "doThing",
                vars: {
                  userEmail: "alex@try-saga.com",
                  userPhone: "+1 415-555-1234",
                  token: "secret-token-value",
                },
              },
            ],
          },
        },
      ],
    },
  };

  const result = JSON.stringify(
    redactForLog(sentryEvent, 0, SENTRY_REDACT_MAX_DEPTH),
  );
  assert.equal(result.includes("alex@try-saga.com"), false);
  assert.equal(result.includes("415-555-1234"), false);
  assert.equal(result.includes("secret-token-value"), false);
  // The frame structure itself survives so a developer reading the
  // event can still locate the failing call.
  assert.match(result, /sensitive\.ts/);
  assert.match(result, /doThing/);
});
