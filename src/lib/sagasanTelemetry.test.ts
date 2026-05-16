import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSagasanTelemetryEvents,
  readSagasanTelemetryEvents,
  recordSagasanTelemetry,
  sanitizeSagasanTelemetryEvent,
} from "@/lib/sagasanTelemetry";

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

test("telemetry records and reads local Sagasan events", () => {
  const teardown = installWindowStorageMock();

  try {
    recordSagasanTelemetry({
      name: "next_step_clicked",
      persona: "creative",
      nextStep: {
        label: "Open my feed",
        route: "/me",
        prefill: {
          city: "Los Angeles",
          roles: ["Photographer"],
        },
      },
    });

    const events = readSagasanTelemetryEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.name, "next_step_clicked");
    assert.equal(events[0]?.persona, "creative");
    assert.equal(events[0]?.route, "/me");
    assert.deepEqual(events[0]?.details.prefillKeys, ["city", "roles"]);

    clearSagasanTelemetryEvents();
    assert.deepEqual(readSagasanTelemetryEvents(), []);
  } finally {
    teardown();
  }
});

test("telemetry sanitizes unknown event payloads safely", () => {
  const event = sanitizeSagasanTelemetryEvent({
    name: "fallback_used",
    at: new Date().toISOString(),
    persona: "host",
    route: "/projects/new",
    details: {
      internal: { should: "drop" },
      safe: "keep me",
      list: ["Producer", "Photographer"],
    },
  });

  assert.ok(event);
  assert.equal(event?.persona, "host");
  assert.deepEqual(event?.details.list, ["Producer", "Photographer"]);
  assert.equal("internal" in (event?.details || {}), false);
});
