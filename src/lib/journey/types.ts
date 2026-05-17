/**
 * Journey state machine types — pure TypeScript, no framework imports.
 *
 * These types are intended to be liftable into `packages/middleware` in the
 * Try-Saga/saga monorepo during Phase 2 backend convergence without changes.
 * Keep imports minimal: zod for runtime validation, nothing else.
 *
 * See CLAUDE.md "Core types" and "State transitions" sections for context.
 */

import { z } from "zod";

export const PROJECT_JOURNEY_STEPS = [
  "intake",
  "brief_ready",
  "crew_reviewing",
  "outreach_prep",
  "outreach_awaiting_send",
  "outreach_sent",
  "archived",
] as const;

export type ProjectJourneyStep = (typeof PROJECT_JOURNEY_STEPS)[number];

export const projectJourneyStepSchema = z.enum(PROJECT_JOURNEY_STEPS);

export const actionIntentSchema = z.enum([
  "navigate",
  "approve",
  "edit",
  "submit_chat",
]);

export type ActionIntent = z.infer<typeof actionIntentSchema>;

export const actionDescriptorSchema = z.object({
  label: z.string().min(1).max(80),
  intent: actionIntentSchema,
  href: z.string().min(1).max(500).optional(),
  enabled: z.boolean(),
  blockedReason: z.string().min(1).max(200).optional(),
});

export type ActionDescriptor = z.infer<typeof actionDescriptorSchema>;

export const blockerTypeSchema = z.enum([
  "missing_brief_field",
  "no_roles_suggested",
  "no_candidates_approved",
  "a2p_not_approved",
  "twilio_kill_switch",
]);

export type BlockerType = z.infer<typeof blockerTypeSchema>;

export const blockerSchema = z.object({
  type: blockerTypeSchema,
  detail: z.string().min(1).max(200),
  resolvable: z.enum(["by_user", "by_admin"]),
});

export type Blocker = z.infer<typeof blockerSchema>;

export const projectJourneySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  step: projectJourneyStepSchema,
  primaryAction: actionDescriptorSchema,
  blockers: z.array(blockerSchema),
  lastTransition: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProjectJourney = z.infer<typeof projectJourneySchema>;

/**
 * Intents the agent / API can request when advancing the journey. Each is
 * validated against the current step in `service.advanceJourney`; illegal
 * transitions throw a `JourneyTransitionError`.
 */
export const advanceIntentSchema = z.enum([
  "brief_ready",
  "build_crew",
  "approve_candidates",
  "approve_outreach",
  "send_outreach",
  "archive",
  "back_to_intake",
  "back_to_brief_ready",
]);

export type AdvanceIntent = z.infer<typeof advanceIntentSchema>;

/**
 * Allowed transitions: (currentStep, intent) → nextStep.
 *
 * Single source of truth for the state machine. The service validates every
 * advance() call against this table; UI surfaces should read journey.step and
 * journey.primaryAction rather than guessing the next state locally.
 *
 * See CLAUDE.md "State transitions" for the rationale of each edge.
 */
export const JOURNEY_TRANSITIONS: Array<{
  from: ProjectJourneyStep;
  intent: AdvanceIntent;
  to: ProjectJourneyStep;
}> = [
  // Forward path
  { from: "intake", intent: "brief_ready", to: "brief_ready" },
  { from: "brief_ready", intent: "build_crew", to: "crew_reviewing" },
  {
    from: "crew_reviewing",
    intent: "approve_candidates",
    to: "outreach_prep",
  },
  {
    from: "outreach_prep",
    intent: "approve_outreach",
    to: "outreach_awaiting_send",
  },
  {
    from: "outreach_awaiting_send",
    intent: "send_outreach",
    to: "outreach_sent",
  },

  // Soft reverts — used when the user re-enters chat or edits a brief
  { from: "brief_ready", intent: "back_to_intake", to: "intake" },
  { from: "crew_reviewing", intent: "back_to_brief_ready", to: "brief_ready" },
  { from: "outreach_prep", intent: "back_to_brief_ready", to: "brief_ready" },

  // Archive is allowed from any non-archived state — handled in service.
];

export function findAllowedTransition(
  from: ProjectJourneyStep,
  intent: AdvanceIntent,
): ProjectJourneyStep | null {
  if (intent === "archive") {
    return from === "archived" ? null : "archived";
  }
  const edge = JOURNEY_TRANSITIONS.find(
    (t) => t.from === from && t.intent === intent,
  );
  return edge ? edge.to : null;
}

export class JourneyTransitionError extends Error {
  constructor(
    public readonly from: ProjectJourneyStep,
    public readonly intent: AdvanceIntent,
    public readonly reason: string,
  ) {
    super(
      `Cannot advance journey from "${from}" with intent "${intent}": ${reason}`,
    );
    this.name = "JourneyTransitionError";
  }
}
