/**
 * Decides which primary-action UI the outreach page should render.
 *
 * Three cases:
 * - "approve": render the OutreachApproveButton client island. Wins
 *   whenever state is "ready_for_review", even if the journey's
 *   primaryAction is technically enabled — its href at that step is
 *   this same page, so rendering it as a Link dead-ends the user.
 * - "navigate": render a Link with the journey primaryAction's
 *   href + label. Used when the action points somewhere actionable
 *   that isn't this page itself.
 * - "blocked": render a disabled button with the journey's blocked
 *   reason. Used at outreach_awaiting_send (A2P gate) and other
 *   terminal states.
 *
 * Pure function — split out so the routing rule is unit-testable and
 * the component file stays focused on JSX.
 */

import type {
  ActionDescriptor,
  ProjectJourney,
} from "@/lib/journey/types";
import type { OutreachViewState } from "@/lib/projectOutreachView";

export type OutreachPrimaryUi = "approve" | "navigate" | "blocked";

export function chooseOutreachPrimaryUi({
  state,
  action,
  projectId,
}: {
  state: OutreachViewState;
  action: ActionDescriptor;
  projectId: string;
}): OutreachPrimaryUi {
  if (state === "ready_for_review") {
    return "approve";
  }
  const primaryEnabled = action.enabled && Boolean(action.href);
  if (!primaryEnabled) {
    return "blocked";
  }
  const isSelfLink =
    typeof action.href === "string" &&
    action.href.replace(/\/$/, "").endsWith(`/projects/${projectId}/outreach`);
  return isSelfLink ? "blocked" : "navigate";
}

// Re-export ProjectJourney so callers can spread it through without
// pulling the journey/types import themselves. Helps the view file
// stay terse.
export type { ProjectJourney };
