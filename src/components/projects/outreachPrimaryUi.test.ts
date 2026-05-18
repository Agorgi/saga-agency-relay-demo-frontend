import assert from "node:assert/strict";
import test from "node:test";
import { chooseOutreachPrimaryUi } from "@/components/projects/outreachPrimaryUi";
import type { ActionDescriptor } from "@/lib/journey/types";

const projectId = "cm0abc123def456ghi789jkl";

function buildAction(overrides: Partial<ActionDescriptor>): ActionDescriptor {
  return {
    label: "default",
    intent: "navigate",
    enabled: false,
    ...overrides,
  };
}

test("chooseOutreachPrimaryUi returns 'approve' at ready_for_review even when journey primaryAction is enabled", () => {
  // Codex's P1 regression: the journey primaryAction at outreach_prep
  // points back to this same page. The naive "render primaryAction
  // first" code rendered a "Review outreach drafts" Link that linked
  // back to the page the user was already on, never reaching the
  // approve UI below. The new helper sends ready_for_review straight
  // to "approve" regardless of what the journey primaryAction is.
  const ui = chooseOutreachPrimaryUi({
    state: "ready_for_review",
    action: buildAction({
      label: "Review outreach drafts",
      enabled: true,
      href: `/projects/${projectId}/outreach`,
    }),
    projectId,
  });
  assert.equal(ui, "approve");
});

test("chooseOutreachPrimaryUi at awaiting_send returns 'blocked' (A2P gate)", () => {
  const ui = chooseOutreachPrimaryUi({
    state: "awaiting_send",
    action: buildAction({
      label: "Send outreach",
      intent: "approve",
      enabled: false,
      blockedReason:
        "Outreach is held until A2P approval and the Twilio kill switch are lifted.",
    }),
    projectId,
  });
  assert.equal(ui, "blocked");
});

test("chooseOutreachPrimaryUi at before_outreach_prep returns 'navigate' when action points elsewhere", () => {
  const ui = chooseOutreachPrimaryUi({
    state: "before_outreach_prep",
    action: buildAction({
      label: "Approve at least 1 candidate per core role",
      enabled: true,
      href: `/projects/${projectId}/crew`,
    }),
    projectId,
  });
  assert.equal(ui, "navigate");
});

test("chooseOutreachPrimaryUi never renders a self-link — falls back to 'blocked' even if enabled", () => {
  // If a future journey edge points enabled=true at this page, the
  // helper must NOT render it as a navigate-Link. Better to render
  // a blocked button than a no-op self-link.
  const ui = chooseOutreachPrimaryUi({
    state: "approved",
    action: buildAction({
      label: "View sent outreach",
      enabled: true,
      href: `/projects/${projectId}/outreach`,
    }),
    projectId,
  });
  assert.equal(ui, "blocked");
});

test("chooseOutreachPrimaryUi treats a trailing-slash self-link the same way", () => {
  // Defensive — href normalisation. Either /projects/<id>/outreach
  // or /projects/<id>/outreach/ is a self-link.
  const ui = chooseOutreachPrimaryUi({
    state: "approved",
    action: buildAction({
      label: "View sent outreach",
      enabled: true,
      href: `/projects/${projectId}/outreach/`,
    }),
    projectId,
  });
  assert.equal(ui, "blocked");
});

test("chooseOutreachPrimaryUi returns 'blocked' when action has no href", () => {
  const ui = chooseOutreachPrimaryUi({
    state: "empty",
    action: buildAction({
      label: "Project archived",
      enabled: false,
    }),
    projectId,
  });
  assert.equal(ui, "blocked");
});

test("chooseOutreachPrimaryUi at preparing returns 'blocked' so users aren't given a misleading CTA", () => {
  // The "Saga is preparing outreach drafts" empty state shouldn't
  // dangle an active primary CTA below it. Render the blocked
  // variant — gives the user the journey's blockedReason copy.
  const ui = chooseOutreachPrimaryUi({
    state: "preparing",
    action: buildAction({
      label: "Review outreach drafts",
      enabled: true,
      href: `/projects/${projectId}/outreach`,
    }),
    projectId,
  });
  // Self-link → blocked, not navigate.
  assert.equal(ui, "blocked");
});
