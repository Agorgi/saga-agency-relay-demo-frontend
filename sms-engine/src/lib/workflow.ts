import type { Prisma, ProjectBrief, ProjectStatus, User } from "@prisma/client";

export const activeProjectStatuses: ProjectStatus[] = [
  "NEW_INBOUND",
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
  "NEEDS_ADMIN",
];

export type RequiredRole = {
  role: string;
  reason: string;
  priority: "core" | "nice_to_have";
  tags?: string[];
};

export type BriefPatch = Partial<
  Pick<
    ProjectBrief,
    | "firstTimeHost"
    | "city"
    | "projectType"
    | "title"
    | "description"
    | "targetDate"
    | "budgetRange"
    | "expectedAudienceSize"
    | "scope"
    | "vibe"
    | "helpNeeded"
  >
> & {
  requiredRoles?: Prisma.InputJsonValue;
};

const intakeFieldOrder: Array<{
  field: keyof ProjectBrief | "firstTimeHost";
  question: string;
}> = [
  {
    field: "firstTimeHost",
    question:
      "Love this. I can help turn it into an actual production plan. First - have you hosted something like this before, or would this be your first one?",
  },
  {
    field: "city",
    question: "Great. What city or general location are you thinking for this?",
  },
  {
    field: "description",
    question:
      "Nice. Give me the core concept in a sentence or two - what are we making happen?",
  },
  {
    field: "vibe",
    question:
      "What's the vibe and scale you're imagining: intimate, wild, polished, experimental, community-led, something else?",
  },
  {
    field: "targetDate",
    question:
      "Do you have a target date or timing in mind yet? Totally fine if it's still loose.",
  },
  {
    field: "budgetRange",
    question:
      "Do you have a budget range in mind, even a rough one? You can also say unknown.",
  },
  {
    field: "expectedAudienceSize",
    question:
      "About how many people do you imagine attending or participating?",
  },
  {
    field: "helpNeeded",
    question:
      "Last intake piece: what kind of help do you already know you need?",
  },
];

export function mergeBriefPatch(brief: ProjectBrief, patch: BriefPatch) {
  const merged = { ...brief };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged as ProjectBrief;
}

export function getNextIntakeQuestion(brief: ProjectBrief, user: User) {
  if (!user.hasCompletedFirstTimeHostQuestion) {
    return intakeFieldOrder[0].question;
  }

  const missing = intakeFieldOrder.find(({ field }) => {
    if (field === "firstTimeHost") return false;
    const value = brief[field as keyof ProjectBrief];
    return value === null || value === "";
  });

  return missing?.question ?? null;
}

export function isIntakeComplete(brief: ProjectBrief, user: User) {
  return !getNextIntakeQuestion(brief, user);
}

export function nextStatusAfterIntake(
  brief: ProjectBrief,
  user: User,
): ProjectStatus {
  if (brief.status === "NEEDS_ADMIN") {
    return "NEEDS_ADMIN";
  }

  return isIntakeComplete(brief, user)
    ? "BRIEF_READY_FOR_REVIEW"
    : "INTAKE_IN_PROGRESS";
}

export function finalIntakeReply() {
  return "Got it. I'm going to turn this into a brief and start mapping the kind of team that could bring it to life. I'll follow up with a shortlist once I've checked who's interested.";
}

export function afterBriefReadyReply() {
  return "I've got the brief queued for review now. I'll use this to map roles and check who might be interested before sending you a shortlist.";
}

export function parseRequiredRoles(value: Prisma.JsonValue | null): RequiredRole[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): RequiredRole | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const role = typeof record.role === "string" ? record.role : null;
      const reason = typeof record.reason === "string" ? record.reason : "";
      const priority: RequiredRole["priority"] =
        record.priority === "nice_to_have" ? "nice_to_have" : "core";
      const tags = Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string")
        : [];

      return role ? { role, reason, priority, tags } : null;
    })
    .filter((item): item is RequiredRole => Boolean(item));
}

export function briefTitle(brief: Pick<ProjectBrief, "title" | "projectType">) {
  return brief.title || brief.projectType || "Untitled project";
}

export function briefSummary(
  brief: Pick<
    ProjectBrief,
    | "title"
    | "city"
    | "description"
    | "targetDate"
    | "vibe"
    | "scope"
    | "expectedAudienceSize"
  >,
) {
  const parts = [
    brief.title,
    brief.city ? `in ${brief.city}` : null,
    brief.targetDate ? `around ${brief.targetDate}` : null,
    brief.expectedAudienceSize ? `for ${brief.expectedAudienceSize} people` : null,
  ].filter(Boolean);

  const headline = parts.length > 0 ? parts.join(" ") : "this project";
  const details = [brief.description, brief.vibe, brief.scope]
    .filter(Boolean)
    .join(" ");

  return details ? `${headline}. ${details}` : headline;
}
