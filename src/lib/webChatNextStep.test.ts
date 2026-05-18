import assert from "node:assert/strict";
import test from "node:test";
import {
  bindNextStepToProject,
  buildNextStepHref,
  clearPendingNextStep,
  decodePrefillPayload,
  getPersonaFromNextStep,
  persistPendingNextStep,
  readPendingNextStep,
  sanitizeNextStepPayload,
  type WebChatNextStep,
} from "@/lib/webChatNextStep";

function installWindowStorageMock() {
  const storage = new Map<string, string>();
  const mockWindow = {
    dispatchEvent: () => true,
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
    label: "Review brief",
    route: "/projects/new",
    prefill: {
      city: "Los Angeles",
      eventType: "Pop-up / activation",
      scopeFormat: "Anime picnic",
      budget: "$15k",
      readinessStage: "draft_brief_ready",
      missingRequiredFields: ["budget"],
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
    scopeFormat: "Anime picnic",
    budget: "$15k",
    readinessStage: "draft_brief_ready",
    missingRequiredFields: ["budget"],
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

test("bindNextStepToProject rewrites /projects/new to /projects/<id> when projectId is present", () => {
  const projectId = "cm0abc123def456ghi789jkl";
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "Los Angeles", projectIdea: "Anime pop-up" },
  };
  const after = bindNextStepToProject(before, projectId);
  assert.equal(after?.route, `/projects/${projectId}`);
  assert.equal(after?.label, "Review brief");
  // Prefill is stripped — the brief review page reads from the DB,
  // not from URL params.
  assert.deepEqual(after?.prefill, {});
});

test("bindNextStepToProject is a no-op when projectId is null", () => {
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "Los Angeles" },
  };
  const after = bindNextStepToProject(before, null);
  assert.equal(after, before);
});

test("bindNextStepToProject is a no-op when nextStep is null", () => {
  const after = bindNextStepToProject(null, "cm0abc123def456ghi789jkl");
  assert.equal(after, null);
});

test("bindNextStepToProject is a no-op when route is not /projects/new", () => {
  const meStep: WebChatNextStep = {
    label: "Open my profile",
    route: "/me",
    prefill: { city: "Los Angeles" },
  };
  const exploreStep: WebChatNextStep = {
    label: "Browse talent",
    route: "/explore",
    prefill: { city: "Los Angeles" },
  };
  const meResult = bindNextStepToProject(meStep, "cm0xyz");
  const exploreResult = bindNextStepToProject(exploreStep, "cm0xyz");
  assert.ok(meResult);
  assert.ok(exploreResult);
  assert.equal(meResult?.route, "/me");
  assert.equal(exploreResult?.route, "/explore");
});

test("bindNextStepToProject is idempotent — already-bound routes pass through unchanged", () => {
  const already: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  };
  const result = bindNextStepToProject(already, "cm0newproject");
  // Route is NOT /projects/new, so it doesn't get rewritten — even
  // if the caller passes a different projectId.
  assert.equal(result?.route, "/projects/cm0abc123def456ghi789jkl");
});

test("bindNextStepToProject output still validates against the next-step schema", () => {
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "LA", projectIdea: "Anime pop-up" },
  };
  const after = bindNextStepToProject(before, "cm0abc123def456ghi789jkl");
  // The cuid form (string-matching-regex variant of the route union)
  // must round-trip through sanitizeNextStepPayload without being
  // rejected.
  const sanitized = sanitizeNextStepPayload(after);
  assert.ok(sanitized);
  assert.equal(sanitized?.route, "/projects/cm0abc123def456ghi789jkl");
});

test("getPersonaFromNextStep returns 'host' for the bound /projects/<id> route", () => {
  // Before this PR, getPersonaFromNextStep only recognised
  // /projects/new as a host route. /projects/<cuid> got null, which
  // broke top-nav persona chips after the rewrite. The check is
  // now prefix-based.
  const bound: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  };
  assert.equal(getPersonaFromNextStep(bound), "host");

  // The original /projects/new still maps to host.
  const newStep: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: {},
  };
  assert.equal(getPersonaFromNextStep(newStep), "host");
});
