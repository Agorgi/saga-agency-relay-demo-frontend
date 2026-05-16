import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNextStepHref,
  clearPendingNextStep,
  decodePrefillPayload,
  persistPendingNextStep,
  readPendingNextStep,
  sanitizeNextStepPayload,
} from "@/lib/webChatNextStep";

function installWindowStorageMock() {
  const storage = new Map<string, string>();
  const mockWindow = {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    } satisfies Storage,
  };

  Object.defineProperty(globalThis, "window", {
    value: mockWindow,
    configurable: true,
    writable: true,
  });

  return () => {
    Reflect.deleteProperty(globalThis, "window");
  };
}

test("invalid next-step routes are rejected", () => {
  const nextStep = sanitizeNextStepPayload({
    label: "Send me somewhere unsafe",
    route: "https://evil.example",
    prefill: {
      city: "Los Angeles",
    },
  });

  assert.equal(nextStep, null);
});

test("next-step labels are clamped to five words", () => {
  const nextStep = sanitizeNextStepPayload({
    label: "Open the full creative opportunities dashboard",
    route: "/me",
    prefill: {
      city: "Los Angeles",
      roles: ["Photographer"],
    },
  });

  assert.ok(nextStep);
  assert.equal(nextStep?.label.split(/\s+/).length, 5);
});

test("prefill payload keeps only allowed keys and routes correctly", () => {
  const nextStep = sanitizeNextStepPayload({
    label: "Build my event",
    route: "/projects/new",
    prefill: {
      city: "Los Angeles",
      eventType: "Pop-up / activation",
      secret: "should-not-pass",
      email: "private@example.com",
      suggestedRoles: ["Producer", "Photographer"],
    },
  });

  assert.ok(nextStep);
  const href = buildNextStepHref(nextStep!);
  const url = new URL(href, "https://demo.try-saga.com");
  const prefill = decodePrefillPayload(url.searchParams.get("prefill"));

  assert.equal(url.pathname, "/projects/new");
  assert.deepEqual(prefill, {
    city: "Los Angeles",
    eventType: "Pop-up / activation",
    suggestedRoles: ["Producer", "Photographer"],
  });
});

test("pending next-step handoff survives navigation state", () => {
  const teardown = installWindowStorageMock();

  try {
    persistPendingNextStep({
      label: "Build my event",
      route: "/projects/new",
      prefill: {
        city: "Los Angeles",
        eventType: "Pop-up / activation",
        date: "next month",
        projectIdea: "Anime pop-up",
      },
    });

    const nextStep = readPendingNextStep("/projects/new");
    assert.ok(nextStep);
    assert.equal(nextStep?.label, "Build my event");
    assert.equal(nextStep?.prefill.city, "Los Angeles");
    assert.equal(nextStep?.prefill.projectIdea, "Anime pop-up");

    clearPendingNextStep();
    assert.equal(readPendingNextStep("/projects/new"), null);
  } finally {
    teardown();
  }
});
