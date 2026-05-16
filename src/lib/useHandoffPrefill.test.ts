import assert from "node:assert/strict";
import test from "node:test";
import { encodePrefillPayload } from "@/lib/webChatNextStep";
import { resolveHandoffPrefill } from "@/lib/useHandoffPrefill";

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

  return {
    teardown: () => {
      Reflect.deleteProperty(globalThis, "window");
    },
    storage,
  };
}

test("handoff prefill prefers the URL payload when present", () => {
  const teardown = installWindowStorageMock();

  try {
    const encoded = encodePrefillPayload({
      city: "Los Angeles",
      roles: ["Photographer"],
    });

    const resolved = resolveHandoffPrefill({
      encodedPrefill: encoded,
      route: "/me",
    });

    assert.deepEqual(resolved, {
      city: "Los Angeles",
      roles: ["Photographer"],
    });
  } finally {
    teardown.teardown();
  }
});

test("handoff prefill falls back to the pending next step for the matching route", () => {
  const { storage, teardown } = installWindowStorageMock();

  try {
    storage.set(
      "saga-web-chat-pending-next-step",
      JSON.stringify({
        label: "Open my feed",
        route: "/me",
        prefill: {
          city: "Los Angeles",
          roles: ["Photographer"],
        },
      }),
    );

    const resolved = resolveHandoffPrefill({
      encodedPrefill: null,
      route: "/me",
    });

    assert.deepEqual(resolved, {
      city: "Los Angeles",
      roles: ["Photographer"],
    });
  } finally {
    teardown();
  }
});
