import assert from "node:assert/strict";
import test from "node:test";
import { getLlmConfigPresence } from "@/sms-engine/env";

// PR #71 introduces the `LLM_ACTIVE_LIVE_ALLOWED` env-driven gate.
// Default is `false`; only the literal string `"true"` opts in. Any
// other value (unset, "false", "1", "yes") must NOT activate the
// live path — the safe default preserves "deterministic fallback"
// behavior unless the operator has explicitly chosen to flip.

type EnvSnap = {
  llmActiveLiveAllowed: string | undefined;
  llmProvider: string | undefined;
  llmMode: string | undefined;
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
};

function snap(): EnvSnap {
  return {
    llmActiveLiveAllowed: process.env.LLM_ACTIVE_LIVE_ALLOWED,
    llmProvider: process.env.LLM_PROVIDER,
    llmMode: process.env.LLM_MODE,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
  };
}

function restore(s: EnvSnap) {
  const restoreOne = (k: keyof EnvSnap, name: string) => {
    const value = s[k];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };
  restoreOne("llmActiveLiveAllowed", "LLM_ACTIVE_LIVE_ALLOWED");
  restoreOne("llmProvider", "LLM_PROVIDER");
  restoreOne("llmMode", "LLM_MODE");
  restoreOne("openaiApiKey", "OPENAI_API_KEY");
  restoreOne("openaiModel", "OPENAI_MODEL");
}

test("LLM gate: activeLiveAllowed defaults to false when LLM_ACTIVE_LIVE_ALLOWED is unset", () => {
  const s = snap();
  try {
    delete process.env.LLM_ACTIVE_LIVE_ALLOWED;
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_MODE = "active_live";
    process.env.OPENAI_API_KEY = "test-key";

    const config = getLlmConfigPresence();
    assert.equal(config.activeLiveAllowed, false);
    // Mode downgrades to fallback because the gate is closed.
    assert.equal(config.modeEffective, "fallback");
    assert.ok(config.warnings.includes("active_live_disabled"));
  } finally {
    restore(s);
  }
});

test("LLM gate: activeLiveAllowed=true only when LLM_ACTIVE_LIVE_ALLOWED is literally 'true'", () => {
  const s = snap();
  try {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_MODE = "active_live";
    process.env.OPENAI_API_KEY = "test-key";

    process.env.LLM_ACTIVE_LIVE_ALLOWED = "true";
    const allowed = getLlmConfigPresence();
    assert.equal(allowed.activeLiveAllowed, true);
    assert.equal(allowed.modeEffective, "active_live");
    assert.ok(!allowed.warnings.includes("active_live_disabled"));

    // Common typos / non-true values: all keep the gate closed.
    for (const negative of ["false", "1", "yes", "TRUE", "True", " true ", ""]) {
      process.env.LLM_ACTIVE_LIVE_ALLOWED = negative;
      const blocked = getLlmConfigPresence();
      assert.equal(
        blocked.activeLiveAllowed,
        false,
        `LLM_ACTIVE_LIVE_ALLOWED=${JSON.stringify(negative)} must not open the gate`,
      );
      assert.equal(blocked.modeEffective, "fallback");
      assert.ok(blocked.warnings.includes("active_live_disabled"));
    }
  } finally {
    restore(s);
  }
});

test("LLM gate: gate stays closed when OPENAI_API_KEY is missing, even if LLM_ACTIVE_LIVE_ALLOWED=true", () => {
  // Layered defense — opting into active_live without an API key
  // shouldn't lie about the runtime state.
  const s = snap();
  try {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_MODE = "active_live";
    process.env.LLM_ACTIVE_LIVE_ALLOWED = "true";
    delete process.env.OPENAI_API_KEY;

    const config = getLlmConfigPresence();
    // activeLiveAllowed reflects the env var (it's a flag, not a
    // runtime guarantee), but providerEffective + modeEffective
    // downgrade because the key is missing.
    assert.equal(config.activeLiveAllowed, true);
    assert.equal(config.providerEffective, "fallback");
    assert.equal(config.modeEffective, "fallback");
    assert.ok(config.warnings.includes("openai_api_key_missing"));
  } finally {
    restore(s);
  }
});
