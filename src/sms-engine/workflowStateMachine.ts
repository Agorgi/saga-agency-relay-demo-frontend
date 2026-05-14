import type {
  AuditActorType,
  CandidateRecommendationStatus,
  GroupChatStatus,
  InterestCheckStatus,
  NetworkProjectStatus,
  OpportunityStatus,
  OutreachStatus,
  ProductionConversationStatus,
  ProjectStatus,
  RoleOpeningStatus,
  TaskStatus,
  TeamMemberStatus,
  TeamStatus,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTransitionError";
  }
}

type TransitionContext = {
  allowAdminOverride?: boolean;
  adminApproved?: boolean;
  humanApproved?: boolean;
  hasMessage?: boolean;
  hasConsent?: boolean;
  hasExplicitConsent?: boolean;
  hasConfirmedTeamMember?: boolean;
  participantCount?: number;
  convertedProjectId?: string | null;
};

function fail(message: string): never {
  throw new WorkflowTransitionError(message);
}

function assertAllowed<T extends string>({
  entity,
  from,
  to,
  allowed,
  allowAdminOverride,
}: {
  entity: string;
  from: T;
  to: T;
  allowed: Record<T, readonly T[]>;
  allowAdminOverride?: boolean;
}) {
  if (from === to) return;
  if (allowAdminOverride) return;
  if ((allowed[from] || []).includes(to)) return;
  fail(`Invalid ${entity} status transition: ${from} -> ${to}.`);
}

const projectBriefTransitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  NEW_INBOUND: ["INTAKE_IN_PROGRESS", "NEEDS_ADMIN", "ARCHIVED"],
  INTAKE_IN_PROGRESS: ["BRIEF_READY_FOR_REVIEW", "NEEDS_ADMIN", "ARCHIVED"],
  BRIEF_READY_FOR_REVIEW: [
    "ROLE_MAPPING_READY",
    "OUTREACH_DRAFTED",
    "NEEDS_ADMIN",
    "ARCHIVED",
  ],
  ROLE_MAPPING_READY: ["OUTREACH_DRAFTED", "NEEDS_ADMIN", "ARCHIVED"],
  OUTREACH_DRAFTED: ["OUTREACH_IN_PROGRESS", "SHORTLIST_READY", "NEEDS_ADMIN", "ARCHIVED"],
  OUTREACH_IN_PROGRESS: [
    "SHORTLIST_READY",
    "SHORTLIST_SENT",
    "NEEDS_ADMIN",
    "ARCHIVED",
  ],
  SHORTLIST_READY: [
    "SHORTLIST_SENT",
    "GROUPCHAT_PENDING",
    "GROUPCHAT_ACTIVE",
    "NEEDS_ADMIN",
    "ARCHIVED",
  ],
  SHORTLIST_SENT: ["GROUPCHAT_PENDING", "GROUPCHAT_ACTIVE", "NEEDS_ADMIN", "ARCHIVED"],
  GROUPCHAT_PENDING: ["GROUPCHAT_ACTIVE", "NEEDS_ADMIN", "ARCHIVED"],
  GROUPCHAT_ACTIVE: ["PRODUCTION_IN_PROGRESS", "NEEDS_ADMIN", "ARCHIVED"],
  PRODUCTION_IN_PROGRESS: ["NEEDS_ADMIN", "ARCHIVED"],
  NEEDS_ADMIN: [
    "INTAKE_IN_PROGRESS",
    "BRIEF_READY_FOR_REVIEW",
    "ROLE_MAPPING_READY",
    "OUTREACH_DRAFTED",
    "OUTREACH_IN_PROGRESS",
    "SHORTLIST_READY",
    "SHORTLIST_SENT",
    "GROUPCHAT_PENDING",
    "GROUPCHAT_ACTIVE",
    "PRODUCTION_IN_PROGRESS",
    "ARCHIVED",
  ],
  ARCHIVED: [],
};

const projectTransitions: Record<NetworkProjectStatus, readonly NetworkProjectStatus[]> = {
  INTAKE: ["BRIEF_READY", "NEEDS_ADMIN", "ARCHIVED"],
  BRIEF_READY: ["ROLE_MAPPING", "RECRUITING", "NEEDS_ADMIN", "ARCHIVED"],
  ROLE_MAPPING: ["RECRUITING", "SHORTLIST_READY", "NEEDS_ADMIN", "ARCHIVED"],
  RECRUITING: ["SHORTLIST_READY", "TEAM_FORMING", "NEEDS_ADMIN", "ARCHIVED"],
  SHORTLIST_READY: ["TEAM_FORMING", "NEEDS_ADMIN", "ARCHIVED"],
  TEAM_FORMING: ["IN_PRODUCTION", "NEEDS_ADMIN", "ARCHIVED"],
  IN_PRODUCTION: ["NEEDS_ADMIN", "ARCHIVED"],
  NEEDS_ADMIN: [
    "INTAKE",
    "BRIEF_READY",
    "ROLE_MAPPING",
    "RECRUITING",
    "SHORTLIST_READY",
    "TEAM_FORMING",
    "IN_PRODUCTION",
    "ARCHIVED",
  ],
  ARCHIVED: [],
};

const roleOpeningTransitions: Record<RoleOpeningStatus, readonly RoleOpeningStatus[]> = {
  DRAFT: ["OPEN", "ARCHIVED"],
  OPEN: ["RECOMMENDING", "OUTREACHING", "FILLED", "ARCHIVED"],
  RECOMMENDING: ["OPEN", "OUTREACHING", "FILLED", "ARCHIVED"],
  OUTREACHING: ["OPEN", "FILLED", "ARCHIVED"],
  FILLED: ["ARCHIVED"],
  ARCHIVED: [],
};

const opportunityTransitions: Record<OpportunityStatus, readonly OpportunityStatus[]> = {
  DRAFT: ["ACTIVE", "PAUSED", "ARCHIVED"],
  ACTIVE: ["PAUSED", "FILLED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  FILLED: ["ARCHIVED"],
  ARCHIVED: [],
};

const candidateTransitions: Record<
  CandidateRecommendationStatus,
  readonly CandidateRecommendationStatus[]
> = {
  SUGGESTED: [
    "APPROVED",
    "APPROVED_FOR_SHORTLIST",
    "CONTACTED",
    "INTERESTED",
    "REJECTED",
    "NEEDS_MORE_INFO",
    "CONTACT_LATER",
    "DO_NOT_CONTACT",
  ],
  APPROVED: [
    "APPROVED_FOR_SHORTLIST",
    "CONTACTED",
    "INTERESTED",
    "REJECTED",
    "NEEDS_MORE_INFO",
    "CONTACT_LATER",
    "DO_NOT_CONTACT",
  ],
  APPROVED_FOR_SHORTLIST: [
    "CONTACTED",
    "INTERESTED",
    "SHORTLISTED",
    "REJECTED",
    "NEEDS_MORE_INFO",
    "CONTACT_LATER",
    "DO_NOT_CONTACT",
  ],
  NEEDS_MORE_INFO: [
    "SUGGESTED",
    "APPROVED_FOR_SHORTLIST",
    "REJECTED",
    "CONTACT_LATER",
    "DO_NOT_CONTACT",
  ],
  CONTACT_LATER: [
    "SUGGESTED",
    "APPROVED_FOR_SHORTLIST",
    "REJECTED",
    "DO_NOT_CONTACT",
  ],
  DO_NOT_CONTACT: [],
  CONTACTED: ["INTERESTED", "DECLINED", "REJECTED", "DO_NOT_CONTACT"],
  INTERESTED: [
    "APPROVED_FOR_SHORTLIST",
    "SHORTLISTED",
    "DECLINED",
    "REJECTED",
    "DO_NOT_CONTACT",
  ],
  SHORTLISTED: ["ADDED_TO_TEAM", "DECLINED", "REJECTED"],
  ADDED_TO_TEAM: ["REJECTED"],
  DECLINED: [],
  REJECTED: [],
};

const outreachTransitions: Record<OutreachStatus, readonly OutreachStatus[]> = {
  DRAFTED: ["SENT"],
  SENT: ["INTERESTED", "NOT_INTERESTED", "MAYBE", "NO_RESPONSE"],
  INTERESTED: ["APPROVED_FOR_GROUPCHAT", "NOT_INTERESTED", "MAYBE"],
  NOT_INTERESTED: [],
  MAYBE: ["INTERESTED", "NOT_INTERESTED", "APPROVED_FOR_GROUPCHAT"],
  NO_RESPONSE: ["SENT", "INTERESTED", "NOT_INTERESTED", "MAYBE"],
  APPROVED_FOR_GROUPCHAT: [],
};

const teamTransitions: Record<TeamStatus, readonly TeamStatus[]> = {
  FORMING: ["ACTIVE", "COMPLETED", "ARCHIVED"],
  ACTIVE: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

const teamMemberTransitions: Record<TeamMemberStatus, readonly TeamMemberStatus[]> = {
  INVITED: ["INTERESTED", "CONFIRMED", "REMOVED"],
  INTERESTED: ["CONFIRMED", "REMOVED"],
  CONFIRMED: ["REMOVED"],
  REMOVED: [],
};

const conversationTransitions: Record<
  ProductionConversationStatus | GroupChatStatus,
  readonly (ProductionConversationStatus | GroupChatStatus)[]
> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["ARCHIVED"],
  ARCHIVED: [],
};

const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "DONE", "BLOCKED"],
  IN_PROGRESS: ["TODO", "DONE", "BLOCKED"],
  DONE: ["TODO", "IN_PROGRESS"],
  BLOCKED: ["TODO", "IN_PROGRESS", "DONE"],
};

const interestCheckTransitions: Record<InterestCheckStatus, readonly InterestCheckStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["THRESHOLD_MET", "CONVERTED_TO_PROJECT", "ARCHIVED"],
  THRESHOLD_MET: ["CONVERTED_TO_PROJECT", "ARCHIVED"],
  CONVERTED_TO_PROJECT: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertProjectBriefStatusTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "ProjectBrief",
    from,
    to,
    allowed: projectBriefTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
}

export function assertProjectStatusTransition(
  from: NetworkProjectStatus,
  to: NetworkProjectStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "Project",
    from,
    to,
    allowed: projectTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
}

export function assertRoleOpeningStatusTransition(
  from: RoleOpeningStatus,
  to: RoleOpeningStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "RoleOpening",
    from,
    to,
    allowed: roleOpeningTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "FILLED" && !context.hasConfirmedTeamMember) {
    fail("RoleOpening cannot become FILLED without a confirmed team member.");
  }
}

export function assertOpportunityStatusTransition(
  from: OpportunityStatus,
  to: OpportunityStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "Opportunity",
    from,
    to,
    allowed: opportunityTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "FILLED" && !context.hasConfirmedTeamMember) {
    fail("Opportunity cannot become FILLED without a confirmed team member.");
  }
}

export function assertCandidateRecommendationStatusTransition(
  from: CandidateRecommendationStatus,
  to: CandidateRecommendationStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "CandidateRecommendation",
    from,
    to,
    allowed: candidateTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "CONTACTED" && !context.humanApproved) {
    fail("CandidateRecommendation cannot become CONTACTED without human approval.");
  }
  if (to === "SHORTLISTED" && !context.hasConsent) {
    fail("CandidateRecommendation cannot become SHORTLISTED without consent.");
  }
  if (
    to === "ADDED_TO_TEAM" &&
    (!context.humanApproved || !context.hasExplicitConsent || !context.hasConfirmedTeamMember)
  ) {
    fail(
      "CandidateRecommendation cannot become ADDED_TO_TEAM without approval, consent, and a confirmed team member.",
    );
  }
}

export function assertOutreachStatusTransition(
  from: OutreachStatus,
  to: OutreachStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "Outreach",
    from,
    to,
    allowed: outreachTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "SENT" && (!context.adminApproved || !context.hasMessage)) {
    fail("Outreach cannot become SENT without admin approval and a message body.");
  }
  if (to === "APPROVED_FOR_GROUPCHAT" && !context.hasConsent) {
    fail("Outreach cannot become APPROVED_FOR_GROUPCHAT without explicit consent.");
  }
}

export function assertTeamStatusTransition(
  from: TeamStatus,
  to: TeamStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "Team",
    from,
    to,
    allowed: teamTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "ACTIVE" && !context.hasConfirmedTeamMember) {
    fail("Team cannot become ACTIVE without at least one confirmed team member.");
  }
}

export function assertTeamMemberStatusTransition(
  from: TeamMemberStatus,
  to: TeamMemberStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "TeamMember",
    from,
    to,
    allowed: teamMemberTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "CONFIRMED" && (!context.humanApproved || !context.hasExplicitConsent)) {
    fail("TeamMember cannot become CONFIRMED without human approval and explicit consent.");
  }
}

export function assertProductionConversationStatusTransition(
  from: ProductionConversationStatus,
  to: ProductionConversationStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "ProductionConversation",
    from,
    to,
    allowed: conversationTransitions as Record<ProductionConversationStatus, readonly ProductionConversationStatus[]>,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "ACTIVE" && (context.participantCount || 0) < 2) {
    fail("ProductionConversation cannot become ACTIVE without at least two participants.");
  }
}

export function assertGroupChatStatusTransition(
  from: GroupChatStatus,
  to: GroupChatStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "GroupChat",
    from,
    to,
    allowed: conversationTransitions as Record<GroupChatStatus, readonly GroupChatStatus[]>,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "ACTIVE" && (context.participantCount || 0) < 2) {
    fail("GroupChat cannot become ACTIVE without at least two participants.");
  }
}

export function assertTaskStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "Task",
    from,
    to,
    allowed: taskTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
}

export function assertInterestCheckStatusTransition(
  from: InterestCheckStatus,
  to: InterestCheckStatus,
  context: TransitionContext = {},
) {
  assertAllowed({
    entity: "InterestCheck",
    from,
    to,
    allowed: interestCheckTransitions,
    allowAdminOverride: context.allowAdminOverride,
  });
  if (to === "CONVERTED_TO_PROJECT" && context.convertedProjectId) {
    fail("InterestCheck cannot convert twice.");
  }
}

export async function logWorkflowTransition({
  actorType = "SYSTEM",
  action = "workflow.status_changed",
  entityType,
  entityId,
  fromStatus,
  toStatus,
  metadata = {},
}: {
  actorType?: AuditActorType;
  action?: string;
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  metadata?: Record<string, unknown>;
}) {
  if (fromStatus === toStatus) return;
  await logAudit({
    actorType,
    action,
    entityType,
    entityId,
    metadata: {
      ...metadata,
      fromStatus,
      toStatus,
    },
  });
}
