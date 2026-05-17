import assert from "node:assert/strict";
import test from "node:test";
import { computePrimaryAction } from "@/lib/journey/service";
import {
  PROJECT_JOURNEY_STEPS,
  advanceIntentSchema,
  blockerSchema,
  actionDescriptorSchema,
  findAllowedTransition,
  JOURNEY_TRANSITIONS,
  JourneyTransitionError,
  projectJourneyStepSchema,
} from "@/lib/journey/types";

test("PROJECT_JOURNEY_STEPS is the canonical enum order", () => {
  // Pin the enum order so a future "convenient" reorder is a deliberate
  // architectural decision, not a silent diff.
  assert.deepEqual(PROJECT_JOURNEY_STEPS, [
    "intake",
    "brief_ready",
    "crew_reviewing",
    "outreach_prep",
    "outreach_awaiting_send",
    "outreach_sent",
    "archived",
  ]);
});

test("schemas reject malformed data", () => {
  // ActionDescriptor must have label and intent.
  assert.equal(
    actionDescriptorSchema.safeParse({ label: "Go", intent: "navigate", enabled: true }).success,
    true,
  );
  assert.equal(
    actionDescriptorSchema.safeParse({ label: "", intent: "navigate", enabled: true }).success,
    false,
  );
  assert.equal(
    actionDescriptorSchema.safeParse({ label: "Go", intent: "bogus", enabled: true }).success,
    false,
  );

  // Blocker requires all three fields.
  assert.equal(
    blockerSchema.safeParse({
      type: "missing_brief_field",
      detail: "city is missing",
      resolvable: "by_user",
    }).success,
    true,
  );
  assert.equal(
    blockerSchema.safeParse({
      type: "missing_brief_field",
      detail: "x",
      resolvable: "by_alien",
    }).success,
    false,
  );

  // Step enum is exhaustive.
  for (const step of PROJECT_JOURNEY_STEPS) {
    assert.equal(projectJourneyStepSchema.safeParse(step).success, true);
  }
  assert.equal(projectJourneyStepSchema.safeParse("not_a_step").success, false);
});

test("advanceIntentSchema enumerates the legal intents", () => {
  const legal = [
    "brief_ready",
    "build_crew",
    "approve_candidates",
    "approve_outreach",
    "send_outreach",
    "archive",
    "back_to_intake",
    "back_to_brief_ready",
  ];
  for (const intent of legal) {
    assert.equal(advanceIntentSchema.safeParse(intent).success, true);
  }
  assert.equal(advanceIntentSchema.safeParse("yolo").success, false);
});

test("forward-path transitions are legal in the expected order", () => {
  assert.equal(findAllowedTransition("intake", "brief_ready"), "brief_ready");
  assert.equal(findAllowedTransition("brief_ready", "build_crew"), "crew_reviewing");
  assert.equal(
    findAllowedTransition("crew_reviewing", "approve_candidates"),
    "outreach_prep",
  );
  assert.equal(
    findAllowedTransition("outreach_prep", "approve_outreach"),
    "outreach_awaiting_send",
  );
  assert.equal(
    findAllowedTransition("outreach_awaiting_send", "send_outreach"),
    "outreach_sent",
  );
});

test("soft-revert transitions are legal", () => {
  // Going back from brief_ready to intake (user wants to refine the brief).
  assert.equal(findAllowedTransition("brief_ready", "back_to_intake"), "intake");

  // Going back from crew_reviewing or outreach_prep to brief_ready.
  assert.equal(
    findAllowedTransition("crew_reviewing", "back_to_brief_ready"),
    "brief_ready",
  );
  assert.equal(
    findAllowedTransition("outreach_prep", "back_to_brief_ready"),
    "brief_ready",
  );
});

test("archive is allowed from any non-archived step, blocked from archived", () => {
  for (const from of PROJECT_JOURNEY_STEPS) {
    const to = findAllowedTransition(from, "archive");
    if (from === "archived") {
      assert.equal(to, null, `archive from ${from} must be blocked`);
    } else {
      assert.equal(to, "archived", `archive from ${from} must reach archived`);
    }
  }
});

test("illegal step+intent combinations return null", () => {
  // Cannot skip forward.
  assert.equal(findAllowedTransition("intake", "build_crew"), null);
  assert.equal(findAllowedTransition("brief_ready", "approve_candidates"), null);
  assert.equal(findAllowedTransition("crew_reviewing", "send_outreach"), null);

  // Cannot revert past available rollback points.
  assert.equal(findAllowedTransition("intake", "back_to_intake"), null);
  assert.equal(findAllowedTransition("intake", "back_to_brief_ready"), null);
  assert.equal(
    findAllowedTransition("outreach_awaiting_send", "back_to_brief_ready"),
    null,
  );

  // Terminal step cannot advance forward.
  assert.equal(findAllowedTransition("outreach_sent", "send_outreach"), null);
  assert.equal(findAllowedTransition("archived", "build_crew"), null);
});

test("every transition in the table is reachable from a real step", () => {
  for (const edge of JOURNEY_TRANSITIONS) {
    assert.ok(
      PROJECT_JOURNEY_STEPS.includes(edge.from),
      `transition origin ${edge.from} is not in PROJECT_JOURNEY_STEPS`,
    );
    assert.ok(
      PROJECT_JOURNEY_STEPS.includes(edge.to),
      `transition target ${edge.to} is not in PROJECT_JOURNEY_STEPS`,
    );
  }
});

test("computePrimaryAction yields an enabled action for forward steps", () => {
  const projectId = "proj_abc123";

  const intake = computePrimaryAction("intake", projectId);
  assert.equal(intake.enabled, true);
  assert.equal(intake.intent, "submit_chat");

  const briefReady = computePrimaryAction("brief_ready", projectId);
  assert.equal(briefReady.enabled, true);
  assert.equal(briefReady.intent, "navigate");
  assert.equal(briefReady.href, `/projects/${projectId}/crew`);
  assert.match(briefReady.label, /Build my crew/i);

  const outreachPrep = computePrimaryAction("outreach_prep", projectId);
  assert.equal(outreachPrep.enabled, true);
  assert.equal(outreachPrep.href, `/projects/${projectId}/outreach`);
});

test("computePrimaryAction yields a blocked action with reason for gated steps", () => {
  const projectId = "proj_xyz";

  const crew = computePrimaryAction("crew_reviewing", projectId);
  assert.equal(crew.enabled, false);
  assert.ok(crew.blockedReason);
  assert.match(crew.blockedReason || "", /at least one/i);

  // Outreach send is held until A2P + Twilio gates lift.
  const send = computePrimaryAction("outreach_awaiting_send", projectId);
  assert.equal(send.enabled, false);
  assert.match(send.blockedReason || "", /A2P|Twilio/i);

  const archived = computePrimaryAction("archived", projectId);
  assert.equal(archived.enabled, false);
});

test("every step yields a valid ActionDescriptor", () => {
  for (const step of PROJECT_JOURNEY_STEPS) {
    const action = computePrimaryAction(step, "proj_test");
    const parsed = actionDescriptorSchema.safeParse(action);
    assert.equal(
      parsed.success,
      true,
      `computePrimaryAction("${step}") produced an invalid descriptor`,
    );
  }
});

test("JourneyTransitionError carries its context", () => {
  const err = new JourneyTransitionError(
    "intake",
    "send_outreach",
    "transition not in JOURNEY_TRANSITIONS table",
  );
  assert.equal(err.name, "JourneyTransitionError");
  assert.equal(err.from, "intake");
  assert.equal(err.intent, "send_outreach");
  assert.match(err.message, /Cannot advance journey/);
});
