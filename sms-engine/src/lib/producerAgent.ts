import type { Contact, ProjectBrief, User } from "@prisma/client";
import {
  runStructuredLlmTask,
  type LlmExecutionContext,
  type LlmExecutionContextDetails,
} from "@/lib/llm/llmProvider";
import {
  forbiddenClaimsGuidance,
  sagaLlmSystemPrompt,
  sagaVoiceGuidelines,
} from "@/lib/llm/prompts";
import {
  briefSummary,
  getNextIntakeQuestion,
  parseRequiredRoles,
  type RequiredRole,
} from "@/lib/workflow";
import { assessMessageSafety, softConfusionReply } from "@/lib/safety";
import { z } from "zod";

const SYSTEM_PROMPT = `${sagaLlmSystemPrompt}\n${sagaVoiceGuidelines}\n${forbiddenClaimsGuidance}`;

export const intakeReplySchema = z.object({
  message: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.7),
  needsAdmin: z.boolean().default(false),
  reason: z.string().nullable().default(null),
});

export const extractBriefFieldsSchema = z.object({
  firstTimeHost: z.boolean().nullable().optional(),
  city: z.string().nullable().optional(),
  projectType: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  budgetRange: z.string().nullable().optional(),
  expectedAudienceSize: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  vibe: z.string().nullable().optional(),
  helpNeeded: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.6),
  needsAdmin: z.boolean().default(false),
  safetyFlags: z.array(z.string()).default([]),
});

const requiredRoleSchema = z.object({
  role: z.string().min(1),
  reason: z.string().min(1),
  priority: z.enum(["core", "nice_to_have"]).default("core"),
  tags: z.array(z.string()).default([]),
});

const requiredRolesSchema = z.object({
  roles: z.array(requiredRoleSchema).min(1),
  confidence: z.number().min(0).max(1).default(0.7),
  needsAdmin: z.boolean().default(false),
});

const outreachDraftSchema = z.object({
  message: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.7),
  needsAdmin: z.boolean().default(false),
});

const shortlistSchema = z.object({
  message: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.7),
  needsAdmin: z.boolean().default(false),
});

const kickoffSchema = z.object({
  message: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.7),
  needsAdmin: z.boolean().default(false),
});

const taskSuggestionSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().nullable().optional(),
      ownerName: z.string().nullable().optional(),
      ownerPhone: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    }),
  ),
  confidence: z.number().min(0).max(1).default(0.6),
  needsAdmin: z.boolean().default(false),
});

type IntakeReply = z.infer<typeof intakeReplySchema>;
type ExtractBriefFields = z.infer<typeof extractBriefFieldsSchema>;
type TaskSuggestionResult = z.infer<typeof taskSuggestionSchema>;

const unsafeGeneratedCopyPattern =
  /\b(confirmed|booked|guarantee|guaranteed|payment|deposit|contract|legal|permit|insurance|venue approved|ticket sales|revenue|celebrity|influencer)\b/i;

function hasUnsafeGeneratedCommitment(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const maybeMessage = (value as Record<string, unknown>).message;
  return (
    typeof maybeMessage === "string" &&
    unsafeGeneratedCopyPattern.test(maybeMessage)
  );
}

async function structuredCompletion<T extends z.ZodType>({
  schema,
  schemaName,
  operation,
  entityType,
  entityId,
  userPrompt,
  fallback,
  executionContext,
  executionContextDetails,
}: {
  schema: T;
  schemaName: string;
  operation: string;
  entityType: string;
  entityId: string;
  userPrompt: string;
  fallback: z.infer<T>;
  executionContext?: LlmExecutionContext;
  executionContextDetails?: Partial<LlmExecutionContextDetails>;
}): Promise<z.infer<T>> {
  const result = await runStructuredLlmTask({
    operation,
    schema,
    schemaName,
    prompt: userPrompt,
    fallback,
    instructions: SYSTEM_PROMPT,
    entityType,
    entityId,
    executionContext,
    executionContextDetails,
    metadata: {
      unsafeGeneratedCopyPatternEnabled: true,
    },
  });

  if (hasUnsafeGeneratedCommitment(result.data)) return fallback;
  return result.data;
}

function nullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^unknown|not sure|no idea|tbd|n\/a$/i.test(trimmed)) {
    return "unknown";
  }
  return trimmed;
}

function inferTitle(message: string) {
  const trimmed = message.trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57).trimEnd() + "...";
}

function fallbackExtractBriefFields(
  projectBrief: ProjectBrief,
  latestMessage: string,
): ExtractBriefFields {
  const body = latestMessage.trim();
  const lower = body.toLowerCase();
  const safety = assessMessageSafety(body);
  const patch: ExtractBriefFields = {
    confidence: 0.55,
    needsAdmin: safety.needsAdmin,
    safetyFlags: safety.flags,
  };

  if (projectBrief.firstTimeHost === null) {
    if (/\b(first|first time|never|nope|no)\b/i.test(body)) {
      patch.firstTimeHost = true;
    } else if (/\b(yes|yeah|yep|hosted|produced|before|several|many)\b/i.test(body)) {
      patch.firstTimeHost = false;
    } else if (!projectBrief.description) {
      patch.description = body;
      patch.title = inferTitle(body);
    }
  } else if (!projectBrief.city) {
    patch.city = nullableText(body);
  } else if (!projectBrief.description) {
    patch.description = body;
    patch.title = inferTitle(body);
    if (/\b(event|party|show|screening|activation|festival|workshop|project|launch|meetup)\b/i.test(body)) {
      patch.projectType = lower.match(
        /\b(event|party|show|screening|activation|festival|workshop|project|launch|meetup)\b/i,
      )?.[0];
    }
  } else if (!projectBrief.vibe) {
    patch.vibe = body;
    patch.scope = body;
  } else if (!projectBrief.targetDate) {
    patch.targetDate = nullableText(body);
  } else if (!projectBrief.budgetRange) {
    patch.budgetRange = nullableText(body);
  } else if (!projectBrief.expectedAudienceSize) {
    patch.expectedAudienceSize = nullableText(body);
  } else if (!projectBrief.helpNeeded) {
    patch.helpNeeded = nullableText(body);
  }

  return patch;
}

function fallbackRequiredRoles(projectBrief: ProjectBrief): RequiredRole[] {
  const text = [
    projectBrief.projectType,
    projectBrief.description,
    projectBrief.helpNeeded,
    projectBrief.vibe,
    projectBrief.scope,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const roles: RequiredRole[] = [
    {
      role: "Producer",
      reason: "Owns the production plan, timeline, vendors, and communication.",
      priority: "core",
      tags: ["producer", "operations"],
    },
  ];

  if (/\b(photo|photographer|content|creator|cosplay|costume)\b/.test(text)) {
    roles.push({
      role: "Photographer",
      reason: "Captures the project and supports post-event promotion.",
      priority: "core",
      tags: ["photo", "content"],
    });
  }

  if (/\b(music|dj|dance|party|show|club)\b/.test(text)) {
    roles.push({
      role: "DJ",
      reason: "Shapes music, pacing, and energy for the room.",
      priority: "core",
      tags: ["music", "audio"],
    });
  }

  if (/\b(venue|space|location|pop-up|popup)\b/.test(text) || projectBrief.city) {
    roles.push({
      role: "Venue Partner",
      reason: "Helps evaluate a realistic space for the concept and audience size.",
      priority: "core",
      tags: ["venue", "space"],
    });
  }

  if (/\b(vendor|market|booth|food|brand|activation)\b/.test(text)) {
    roles.push({
      role: "Vendor Coordinator",
      reason: "Coordinates partners, vendor needs, and on-site setup expectations.",
      priority: "core",
      tags: ["vendor", "partners"],
    });
  }

  if (/\b(volunteer|community|audience|festival|large)\b/.test(text)) {
    roles.push({
      role: "Volunteer Coordinator",
      reason: "Organizes helpers, arrival windows, and day-of coverage.",
      priority: "nice_to_have",
      tags: ["volunteers", "staffing"],
    });
  }

  if (roles.length < 3) {
    roles.push({
      role: "Creative Lead",
      reason: "Keeps the concept coherent across experience, visuals, and tone.",
      priority: "nice_to_have",
      tags: ["creative", "direction"],
    });
  }

  return roles;
}

export async function generateIntakeReply(
  projectBrief: ProjectBrief,
  latestMessage: string,
  user: User,
  llmExecution?: {
    executionContext?: LlmExecutionContext;
    executionContextDetails?: Partial<LlmExecutionContextDetails>;
  },
): Promise<IntakeReply> {
  const nextQuestion = getNextIntakeQuestion(projectBrief, user);
  const fallback = intakeReplySchema.parse({
    message:
      nextQuestion ||
      "I've got enough to start shaping the brief. I'll map the team needs next and follow up once there's a shortlist to review.",
    confidence: 0.75,
    needsAdmin: false,
  });

  const safety = assessMessageSafety(latestMessage);
  if (safety.needsAdmin) {
    return {
      message: softConfusionReply(),
      confidence: 1,
      needsAdmin: true,
      reason: safety.flags.join(", "),
    };
  }

  return structuredCompletion({
    schema: intakeReplySchema,
    schemaName: "organizer_reply_language",
    operation: "organizer_reply_language",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    executionContext: llmExecution?.executionContext,
    executionContextDetails: llmExecution?.executionContextDetails,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

User JSON:
${JSON.stringify(user)}

Latest organizer text:
${latestMessage}

Backend-selected next question:
${nextQuestion || "(intake complete)"}

Write one concise SMS reply in Saga's tone. Ask only the backend-selected question if present.
Do not ask multiple intake questions at once.
JSON shape: {"message": string, "confidence": number, "needsAdmin": boolean, "reason"?: string}
`,
  });
}

export async function extractBriefFields(
  projectBrief: ProjectBrief,
  latestMessage: string,
  llmExecution?: {
    executionContext?: LlmExecutionContext;
    executionContextDetails?: Partial<LlmExecutionContextDetails>;
  },
): Promise<ExtractBriefFields> {
  const fallback = fallbackExtractBriefFields(projectBrief, latestMessage);

  const result = await structuredCompletion({
    schema: extractBriefFieldsSchema,
    schemaName: "brief_field_extraction",
    operation: "brief_field_extraction",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    executionContext: llmExecution?.executionContext,
    executionContextDetails: llmExecution?.executionContextDetails,
    userPrompt: `
Current project brief JSON:
${JSON.stringify(projectBrief)}

Latest organizer text:
${latestMessage}

Extract only fields that are clearly present or inferable from the latest text.
Use null or omit fields that are not present. Keep fuzzy dates and budget ranges as strings.
If there are safety, legal, payment, explicit, illegal, or high-stakes logistics concerns, set needsAdmin true and include safetyFlags.
JSON shape:
{
  "firstTimeHost"?: boolean|null,
  "city"?: string|null,
  "projectType"?: string|null,
  "title"?: string|null,
  "description"?: string|null,
  "targetDate"?: string|null,
  "budgetRange"?: string|null,
  "expectedAudienceSize"?: string|null,
  "scope"?: string|null,
  "vibe"?: string|null,
  "helpNeeded"?: string|null,
  "confidence": number,
  "needsAdmin": boolean,
  "safetyFlags": string[]
}
`,
  });

  const deterministicSafety = assessMessageSafety(latestMessage);
  return {
    ...result,
    needsAdmin: result.needsAdmin || deterministicSafety.needsAdmin,
    safetyFlags: [
      ...new Set([...(result.safetyFlags || []), ...deterministicSafety.flags]),
    ],
  };
}

export async function suggestRequiredRoles(
  projectBrief: ProjectBrief,
): Promise<RequiredRole[]> {
  const fallback = requiredRolesSchema.parse({
    roles: fallbackRequiredRoles(projectBrief),
    confidence: 0.72,
    needsAdmin: false,
  });

  const result = await structuredCompletion({
    schema: requiredRolesSchema,
    schemaName: "producer_role_map_refinement",
    operation: "producer_role_map_refinement",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

Suggest practical production roles needed for this MVP project.
Return 3-7 roles max. Include role, reason, priority, and matching tags.
Avoid legal, contract, booking, payment, permit, or insurance commitments.
JSON shape: {"roles": [{"role": string, "reason": string, "priority": "core"|"nice_to_have", "tags": string[]}], "confidence": number, "needsAdmin": boolean}
`,
  });

  if (result.needsAdmin || result.confidence < 0.35) {
    return fallback.roles;
  }

  return result.roles;
}

export async function draftOutreachMessage(
  projectBrief: ProjectBrief,
  contact: Contact,
) {
  const roleHint =
    parseRequiredRoles(projectBrief.requiredRoles).find((role) =>
      contact.roles.some(
        (contactRole) =>
          contactRole.toLowerCase() === role.role.toLowerCase() ||
          role.tags?.some(
            (tag) => tag.toLowerCase() === contactRole.toLowerCase(),
          ),
      ),
    )?.role ||
    contact.roles[0] ||
    "creative collaborator";

  const summary = briefSummary(projectBrief);
  const projectKind =
    projectBrief.projectType || projectBrief.title || "creative project";
  const city = projectBrief.city || "your area";
  const fallback = outreachDraftSchema.parse({
    message: `Hey ${contact.name} - Saga is helping put together a ${projectKind} in ${city}. Your work looks like a strong fit for ${roleHint}. Would you be interested in being considered for the team? Reply YES, NO, or MAYBE.`,
    confidence: 0.72,
    needsAdmin: false,
  });

  const result = await structuredCompletion({
    schema: outreachDraftSchema,
    schemaName: "shortlist_outreach_draft_language",
    operation: "candidate_outreach_draft_language",
    entityType: "Contact",
    entityId: contact.id,
    fallback,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

Contact JSON:
${JSON.stringify({
  name: contact.name,
  city: contact.city,
  roles: contact.roles,
  tags: contact.tags,
})}

Project summary:
${summary}

Draft a concise first SMS outreach. Ask if they are open to hearing more.
Do not imply they are booked, paid, selected, or confirmed.
Do not mention private notes.
JSON shape: {"message": string, "confidence": number, "needsAdmin": boolean}
`,
  });

  return result.needsAdmin || result.confidence < 0.35
    ? fallback.message
    : result.message;
}

export async function summarizeShortlist(
  projectBrief: ProjectBrief,
  interestedContacts: Contact[],
) {
  const fallback = shortlistSchema.parse({
    message: `Good news - I found a few people interested in helping bring this to life. Here's the first shortlist:\n${interestedContacts
      .map((contact) => {
        const role = contact.roles[0] || "Collaborator";
        return `* ${contact.name} - ${role}${contact.city ? `, ${contact.city}` : ""}. Good fit based on ${[...contact.roles, ...contact.tags].slice(0, 2).join(", ") || "their background"}.`;
      })
      .join("\n")}`,
    confidence: 0.74,
    needsAdmin: false,
  });

  const result = await structuredCompletion({
    schema: shortlistSchema,
    schemaName: "shortlist_outreach_draft_language",
    operation: "organizer_shortlist_draft_language",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

Interested contacts JSON:
${JSON.stringify(
  interestedContacts.map((contact) => ({
    name: contact.name,
    city: contact.city,
    roles: contact.roles,
    tags: contact.tags,
    portfolioUrl: contact.portfolioUrl,
    instagramUrl: contact.instagramUrl,
  })),
)}

Write a concise organizer-facing SMS shortlist. Include names, likely role, city, and a short reason.
Do not include private notes. Do not imply anyone is booked or confirmed.
JSON shape: {"message": string, "confidence": number, "needsAdmin": boolean}
`,
  });

  return result.needsAdmin || result.confidence < 0.35
    ? fallback.message
    : result.message;
}

export async function generateGroupChatKickoff(
  projectBrief: ProjectBrief,
  participants: Array<{ name: string; role: string; phone: string }>,
) {
  const roles = parseRequiredRoles(projectBrief.requiredRoles);
  const participantRoles = participants
    .map((participant) => `- ${participant.name}: ${participant.role}`)
    .join("\n");
  const fallback = kickoffSchema.parse({
    message: `Hey everyone - Saga here. I'll help keep this organized.\n\nQuick recap: ${briefSummary(projectBrief)}\n\nSuggested roles:\n${
      participantRoles ||
      roles.map((role) => `- TBD: ${role.role}`).join("\n") ||
      "- Organizer: Project lead"
    }\n\nFirst next steps:\n1. Confirm the target date\n2. Confirm venue direction\n3. Confirm who owns photography/content\n4. Align on the next decision deadline`,
    confidence: 0.72,
    needsAdmin: false,
  });

  const result = await structuredCompletion({
    schema: kickoffSchema,
    schemaName: "organizer_reply_language",
    operation: "group_chat_kickoff_language",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

Participants:
${JSON.stringify(participants)}

Write a concise kickoff SMS for a Twilio group conversation.
Be friendly and organized. Assign soft next steps, not binding commitments.
Use a quick recap, suggested roles, and numbered first next steps.
Do not discuss payment, contracts, deposits, permits, insurance, or booking guarantees.
JSON shape: {"message": string, "confidence": number, "needsAdmin": boolean}
`,
  });

  return result.needsAdmin || result.confidence < 0.35
    ? fallback.message
    : result.message;
}

export async function suggestTasksFromGroupChat(
  projectBrief: ProjectBrief,
  recentMessages: string[],
): Promise<TaskSuggestionResult> {
  const fallback = taskSuggestionSchema.parse({
    tasks: [],
    confidence: 0.55,
    needsAdmin: false,
  });

  return structuredCompletion({
    schema: taskSuggestionSchema,
    schemaName: "task_suggestions",
    operation: "task_suggestions",
    entityType: "ProjectBrief",
    entityId: projectBrief.id,
    fallback,
    userPrompt: `
Project brief JSON:
${JSON.stringify(projectBrief)}

Recent group chat messages:
${recentMessages.join("\n")}

Extract only clear, non-sensitive action items. Do not create tasks for contracts, deposits, legal, permits, insurance, or safety decisions.
Use dueDate only if a date is explicit; otherwise null.
JSON shape: {"tasks": [{"title": string, "description"?: string|null, "ownerName"?: string|null, "ownerPhone"?: string|null, "dueDate"?: string|null}], "confidence": number, "needsAdmin": boolean}
`,
  });
}
