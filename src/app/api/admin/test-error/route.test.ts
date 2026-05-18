import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/admin/test-error/route";

const INTERNAL_KEY = "test-internal-api-key-value";

function buildRequest(opts: { withAuth: boolean }): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.withAuth) {
    headers.set("x-saga-internal-key", INTERNAL_KEY);
  }
  return new Request("http://localhost:3000/api/admin/test-error", {
    method: "POST",
    headers,
  });
}

test("admin test-error: 401 when no internal key header", async () => {
  const original = process.env.INTERNAL_API_KEY;
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  try {
    const response = await POST(buildRequest({ withAuth: false }));
    assert.equal(response.status, 401);
    const body = (await response.json()) as { ok?: boolean; error?: string };
    assert.equal(body.ok, false);
  } finally {
    if (original === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = original;
    }
  }
});

test("admin test-error: 500 + structured body when authorized", async () => {
  const originalKey = process.env.INTERNAL_API_KEY;
  const originalDsn = process.env.SENTRY_DSN;
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  delete process.env.SENTRY_DSN;

  // captureServerError writes a structured-log line via console.error
  // — silence it during this test so the test output stays clean.
  const originalError = console.error;
  console.error = () => undefined;

  try {
    const response = await POST(buildRequest({ withAuth: true }));
    assert.equal(response.status, 500);
    const body = (await response.json()) as {
      error: string;
      message: string;
      sentry_dsn_configured: boolean;
    };
    assert.equal(body.error, "test_error");
    assert.match(body.message, /Deliberate error/);
    // No DSN was set in this test, so the helper must report it.
    assert.equal(body.sentry_dsn_configured, false);
  } finally {
    console.error = originalError;
    if (originalKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalKey;
    }
    if (originalDsn !== undefined) {
      process.env.SENTRY_DSN = originalDsn;
    }
  }
});

test("admin test-error: sentry_dsn_configured reflects env var presence", async () => {
  const originalKey = process.env.INTERNAL_API_KEY;
  const originalDsn = process.env.SENTRY_DSN;
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  process.env.SENTRY_DSN = "https://example@sentry.io/1";

  const originalError = console.error;
  console.error = () => undefined;

  try {
    const response = await POST(buildRequest({ withAuth: true }));
    const body = (await response.json()) as { sentry_dsn_configured: boolean };
    assert.equal(body.sentry_dsn_configured, true);
  } finally {
    console.error = originalError;
    if (originalKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalKey;
    }
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  }
});

test("admin test-error: response body never leaks the DSN value", async () => {
  const originalKey = process.env.INTERNAL_API_KEY;
  const originalDsn = process.env.SENTRY_DSN;
  process.env.INTERNAL_API_KEY = INTERNAL_KEY;
  process.env.SENTRY_DSN = "https://supersecret@sentry.io/12345";

  const originalError = console.error;
  console.error = () => undefined;

  try {
    const response = await POST(buildRequest({ withAuth: true }));
    const serialized = JSON.stringify(await response.json());
    assert.equal(serialized.includes("supersecret"), false);
    assert.equal(serialized.includes("sentry.io/12345"), false);
  } finally {
    console.error = originalError;
    if (originalKey === undefined) {
      delete process.env.INTERNAL_API_KEY;
    } else {
      process.env.INTERNAL_API_KEY = originalKey;
    }
    if (originalDsn === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = originalDsn;
    }
  }
});
