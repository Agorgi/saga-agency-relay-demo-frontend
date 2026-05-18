import type {
  OutboundDraftStatus,
  OutboundDraftType,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { getCandidateRecommendationQualityGate } from "@/sms-engine/sourcing/talentResearchQuality";

export const outboundDraftStatuses = [
  "DRAFT",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "BLOCKED",
  "SENT",
] as const;

export const outboundDraftReviewStatuses = [
  "DRAFT",
  "NEEDS_REVIEW",
  "APPROVED",
  "REJECTED",
  "BLOCKED",
] as const;

export const producerOutboundDraftAuditEvents = [
  "producer.organizer_shortlist_draft_generated",
  "producer.candidate_outreach_draft_generated",
  "producer.outbound_draft_edited",
  "producer.outbound_draft_approved",
  "producer.outbound_draft_rejected",
  "producer.outbound_draft_blocked",
] as const;

const editableOutboundDraftStatusSchema = z.enum(["DRAFT", "NEEDS_REVIEW"]);
const candidateSummarySchema = z.object({
  candidateRecommendationId: z.string().optional(),
  name: z.string(),
  role: z.string(),
  city: z.string().nullable().optional(),
  whyTheyFit: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  gaps: z.array(z.string()).optional(),
});

export type ProducerDraftSafetyCheck = {
  passed: boolean;
  flaggedTerms: string[];
  errors: string[];
};

export type ProducerOutboundDraft = {
  type: OutboundDraftType;
  status: "NEEDS_REVIEW" | "BLOCKED";
  body: string;
  source: "PRODUCER_AGENT";
  projectBriefId: string | null;
  projectId: string | null;
  shortlistPacketId?: string | null;
  candidateRecommendationId?: string | null;
  contactId?: string | null;
  personId?: string | null;
  recipientKind: "ORGANIZER" | "CANDIDATE";
  forbiddenClaimsCheck: ProducerDraftSafetyCheck;
  adminReviewRequired: true;
  blockReason?: string | null;
  metadata: Record<string, unknown>;
};

export type OrganizerShortlistDraftInput = {
  shortlistPacketId: string;
  status: string;
  projectBriefId?: string | null;
  projectId?: string | null;
  organizerFacingSummary: string;
  rolesMissing?: unknown;
  candidateSummaries: unknown;
};

export type CandidateOutreachDraftInput = {
  candidateRecommendationId: string;
  status: string;
  personId?: string | null;
  contactId?: string | null;
  displayName?: string | null;
  projectBriefId?: string | null;
  projectId?: string | null;
  projectType?: string | null;
  projectTitle?: string | null;
  city?: string | null;
  role?: string | null;
  matchingReasons?: string[];
  risks?: string[];
  optedOut?: boolean;
  // PR #52 — personalization inputs. Optional so existing callers
  // keep working without change; when present, the body composer
  // anchors on fandom overlap and the project's vibe instead of
  // emitting the generic template.
  projectFandoms?: string[];
  candidateFandoms?: string[];
  projectDescription?: string | null;
  candidateBio?: string | null;
};

export type OutboundDraftApprovalInput = {
  id?: string | null;
  type: OutboundDraftType | string;
  status: OutboundDraftStatus | string;
  body: string;
  editedBody?: string | null;
  projectBriefId?: string | null;
  projectId?: string | null;
  shortlistPacketId?: string | null;
  candidateRecommendationId?: string | null;
  personId?: string | null;
  contactId?: string | null;
};

const rawEmailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const rawPhonePattern =
  /(?:\+\d{8,15})|\b(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;
const privateNotesPattern =
  /\b(private note|internal note|admin note|do not share|secret|internal-only)\b/i;
const forbiddenClaimPatterns = [
  /\bguaranteed?\b/i,
  /\bbooked\b/i,
  /\bselected\b/i,
  /\bwill join\b/i,
  /\bhas agreed\b/i,
  /\bhas been contacted\b/i,
  /\bconfirmed (candidate|team|availability|booking|rate|payment|placement|role)\b/i,
  /\b(payment|rate|revenue|ticket sales|attendance|venue access) (is|are) confirmed\b/i,
  /\bpaid work is confirmed\b/i,
  /\bcelebrity\b/i,
  /\binfluencer participation\b/i,
];

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function safeText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function sentenceList(items: string[]) {
  if (items.length === 0) return "none yet";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function containsRawContactInfo(text: string) {
  return rawEmailPattern.test(text) || rawPhonePattern.test(text);
}

function findForbiddenClaims(text: string) {
  const matches: string[] = [];
  for (const pattern of forbiddenClaimPatterns) {
    const globalPattern = new RegExp(
      pattern,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    for (const match of text.matchAll(globalPattern)) {
      const index = match.index || 0;
      const prefix = text.slice(Math.max(0, index - 14), index).toLowerCase();
      if (/\b(not|are not|is not|no|not yet|not currently)\s*$/.test(prefix)) {
        continue;
      }
      matches.push(match[0].toLowerCase());
    }
  }
  return unique(matches);
}

function parseCandidateSummaries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => candidateSummarySchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data);
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function checkProducerDraftSafety({
  type,
  body,
}: {
  type: OutboundDraftType | string;
  body: string;
}): ProducerDraftSafetyCheck {
  const errors: string[] = [];
  const flaggedTerms = findForbiddenClaims(body);

  if (containsRawContactInfo(body)) {
    errors.push("Draft must not expose raw phone numbers or emails.");
  }
  if (privateNotesPattern.test(body)) {
    errors.push("Draft must not expose private, admin, or internal notes.");
  }
  if (flaggedTerms.length > 0) {
    errors.push(`Forbidden claims detected: ${flaggedTerms.join(", ")}.`);
  }
  if (type === "ORGANIZER_SHORTLIST") {
    if (
      !/\bnot confirmed\b/i.test(body) &&
      !/\bfor consideration\b/i.test(body) &&
      !/\bmay be worth considering\b/i.test(body)
    ) {
      errors.push(
        "Organizer shortlist drafts must say candidates are not confirmed or are for consideration.",
      );
    }
    if (/\bavailable\b/i.test(body) && !/\bnot available\b/i.test(body)) {
      errors.push("Organizer shortlist drafts must not claim candidates are available.");
    }
  }
  if (type === "CANDIDATE_OUTREACH") {
    if (!/\b(open|interested)\b/i.test(body) || !/\bconsidered\b/i.test(body)) {
      errors.push(
        "Candidate outreach drafts must ask whether the candidate is open to being considered.",
      );
    }
  }

  return {
    passed: errors.length === 0,
    flaggedTerms,
    errors,
  };
}

export function validateOutboundDraftForApproval(
  draft: OutboundDraftApprovalInput,
) {
  const body = draft.editedBody?.trim() || draft.body;
  const errors: string[] = [];
  const status = editableOutboundDraftStatusSchema.safeParse(draft.status);
  const safety = checkProducerDraftSafety({ type: draft.type, body });

  if (!status.success) {
    errors.push("Outbound draft must be DRAFT or NEEDS_REVIEW before approval.");
  }
  if (!draft.projectBriefId && !draft.projectId) {
    errors.push("Outbound draft must be linked to a ProjectBrief or Project.");
  }
  if (draft.type === "ORGANIZER_SHORTLIST" && !draft.shortlistPacketId) {
    errors.push("Organizer shortlist drafts must be linked to a ShortlistPacket.");
  }
  if (draft.type === "CANDIDATE_OUTREACH") {
    if (!draft.candidateRecommendationId) {
      errors.push("Candidate outreach drafts must be linked to a recommendation.");
    }
    if (!draft.personId && !draft.contactId) {
      errors.push("Candidate outreach drafts must be linked to a candidate.");
    }
  }
  errors.push(...safety.errors);

  return {
    ok: errors.length === 0,
    errors,
    forbiddenClaimsCheck: {
      passed: safety.flaggedTerms.length === 0,
      flaggedTerms: safety.flaggedTerms,
    },
  };
}

export function generateOrganizerShortlistMessageDraft(
  input: OrganizerShortlistDraftInput,
): ProducerOutboundDraft {
  const candidates = parseCandidateSummaries(input.candidateSummaries);
  const rolesMissing = parseStringArray(input.rolesMissing);
  const blocked = input.status !== "APPROVED";
  const candidateLines = candidates
    .slice(0, 8)
    .map((candidate) => {
      const reasons = (candidate.whyTheyFit || []).slice(0, 2).join("; ");
      const city = candidate.city ? `, ${candidate.city}` : "";
      return `- ${candidate.name} - ${candidate.role}${city}. ${reasons || "Potential fit for admin review."}`;
    })
    .join("\n");
  const missingLine =
    rolesMissing.length > 0
      ? `\n\nRoles still needing more research: ${sentenceList(rolesMissing)}.`
      : "";
  const body = blocked
    ? "Blocked draft: approve the shortlist packet before preparing organizer-facing copy."
    : `Here's a draft shortlist based on your brief. These people are not confirmed yet - they're candidates Saga thinks may be worth considering based on role fit, location, and community alignment.\n\n${candidateLines || "No approved candidates are ready for organizer review yet."}${missingLine}\n\nIf this direction looks right, the Saga team can review next steps before anyone is contacted.`;
  const safety = checkProducerDraftSafety({
    type: "ORGANIZER_SHORTLIST",
    body,
  });
  const status = blocked || !safety.passed ? "BLOCKED" : "NEEDS_REVIEW";

  return {
    type: "ORGANIZER_SHORTLIST",
    status,
    body,
    source: "PRODUCER_AGENT",
    projectBriefId: input.projectBriefId || null,
    projectId: input.projectId || null,
    shortlistPacketId: input.shortlistPacketId,
    recipientKind: "ORGANIZER",
    forbiddenClaimsCheck: safety,
    adminReviewRequired: true,
    blockReason: blocked
      ? "shortlist_packet_not_approved"
      : safety.passed
        ? null
        : safety.errors.join(" "),
    metadata: {
      shortlistPacketStatus: input.status,
      candidateCount: candidates.length,
      rolesMissing,
    },
  };
}

/**
 * Compose the body of a candidate outreach SMS draft.
 *
 * Personalization layers, applied in order of strength:
 *  1. Project anchor — prefer the project's actual title (e.g., "Formal
 *     ball inspired by Love and Deepspace in Los Angeles") over the
 *     generic "a creative project" fallback.
 *  2. Fandom anchor — when the project's fandoms overlap the candidate's
 *     fandoms, name the shared signal explicitly. This is the strongest
 *     "Saga knows me" moment and design partners screenshot drafts that
 *     hit on it.
 *  3. Reason sentence — pulled from the producer's matching reasons (role
 *     match, skill fit, location, etc.) and rewritten as a natural-language
 *     phrase, skipping any reason that would duplicate the fandom anchor.
 *
 * Hard constraints (enforced by checkProducerDraftSafety so coordinate
 * before changing the close):
 *  - Body MUST contain "open" or "interested" AND "considered".
 *  - Body MUST NOT contain forbidden-claim words like "confirmed",
 *    "booked", "available" except in negated forms (handled by the
 *    forbidden-claims pattern list).
 *  - SMS-shape: aim for a single short paragraph under ~320 chars.
 *
 * Exported so the layer is unit-testable without touching the DB
 * persister.
 */
export function composeCandidateOutreachBody(
  input: CandidateOutreachDraftInput,
): string {
  const role = safeText(input.role, "this role");
  const city = input.city?.trim() || null;
  const name = safeText(input.displayName, "there");

  const title = input.projectTitle?.trim() || null;
  const type = input.projectType?.trim() || null;
  const cityClause = city ? ` in ${city}` : "";
  const projectAnchor = title || type || "a creative project";
  const projectClause = `${projectAnchor}${cityClause}`;

  const overlap = findFandomOverlap(
    input.projectFandoms,
    input.candidateFandoms,
  );

  // If the project title itself already names the overlap fandom (e.g.
  // "Formal ball inspired by Love and Deepspace"), don't echo it in a
  // dedicated anchor sentence — the user already saw it in the opener.
  const fandomAlreadyInTitle =
    !!overlap &&
    !!title &&
    title.toLowerCase().includes(overlap.toLowerCase());
  const useFandomAnchor = !!overlap && !fandomAlreadyInTitle;

  const cleanReasons = (input.matchingReasons || []).filter(
    (r) => r.trim() && !containsRawContactInfo(r),
  );
  const reasonSentence = pickReasonSentence(cleanReasons, overlap, role);

  const opener = `Hey ${name} — Saga is helping an organizer plan ${projectClause}.`;
  const fandomAnchor = useFandomAnchor
    ? ` They're building it around ${overlap} and your work felt aligned.`
    : "";
  const reasonLine = reasonSentence
    ? ` ${reasonSentence}`
    : useFandomAnchor
      ? "" // dedicated fandom anchor already carried the personalization
      : ` Your work felt like a fit for the ${role} slot.`;
  // The close is load-bearing for the safety check ("open" + "considered").
  // Don't trim it without also updating checkProducerDraftSafety.
  const close = ` Open to being considered for the team if the organizer moves forward?`;

  return `${opener}${fandomAnchor}${reasonLine}${close}`;
}

function findFandomOverlap(
  projectFandoms: string[] | undefined,
  candidateFandoms: string[] | undefined,
): string | null {
  if (!projectFandoms?.length || !candidateFandoms?.length) return null;
  const candidateSet = new Set(
    candidateFandoms
      .map((f) => f.trim().toLowerCase())
      .filter((f) => f.length > 0),
  );
  for (const f of projectFandoms) {
    const lower = f.trim().toLowerCase();
    if (lower && candidateSet.has(lower)) return f.trim();
  }
  return null;
}

function pickReasonSentence(
  reasons: string[],
  overlap: string | null,
  role: string,
): string | null {
  const overlapLower = overlap?.toLowerCase().trim();
  for (const raw of reasons) {
    const lower = raw.toLowerCase();
    // Skip the fandom reason if we already mentioned that fandom in
    // the dedicated anchor — repeating it sounds robotic.
    if (
      overlapLower &&
      lower.includes("fandom") &&
      lower.includes(overlapLower)
    ) {
      continue;
    }
    // Skip generic-trust signals — they don't say anything specific.
    if (/profile reviewed|portfolio or social proof/i.test(lower)) continue;
    // Skip pure-proximity reasons; the organizer's network graph isn't
    // a story we want to lead with in candidate-facing copy.
    if (/^proximity:/i.test(lower)) continue;

    const phrase = phraseFromReason(raw, role);
    if (phrase) return phrase;
  }
  return null;
}

function phraseFromReason(raw: string, role: string): string {
  const match = raw.match(
    /^(Role match|Skill fit|Fandom\/community fit|Same city):\s*(.+)$/i,
  );
  if (!match) {
    return `Your ${raw.toLowerCase()} caught my eye for the ${role} slot.`;
  }
  const [, label, valueRaw] = match;
  const value = valueRaw.trim();
  if (/role match/i.test(label)) {
    return `Your ${value} portfolio felt like a fit for the ${role} slot.`;
  }
  if (/skill fit/i.test(label)) {
    const skills = value
      .split(/,\s*/)
      .filter(Boolean)
      .slice(0, 2)
      .join(" and ");
    return `Your ${skills} experience felt like a fit for the ${role} slot.`;
  }
  if (/fandom/i.test(label)) {
    return `Your ${value} background felt like a fit for the ${role} slot.`;
  }
  if (/same city/i.test(label)) {
    return `Being in ${value} is part of why — they want someone local for this one.`;
  }
  return `Your work felt like a fit for the ${role} slot.`;
}

export function generateCandidateOutreachDraft(
  input: CandidateOutreachDraftInput,
): ProducerOutboundDraft {
  const role = safeText(input.role, "this role");
  const blocked = input.status !== "APPROVED_FOR_SHORTLIST" || Boolean(input.optedOut);
  const body = blocked
    ? "Blocked draft: candidate must be approved for shortlist and not opted out before outreach copy is prepared."
    : composeCandidateOutreachBody(input);
  const safety = checkProducerDraftSafety({
    type: "CANDIDATE_OUTREACH",
    body,
  });
  const status = blocked || !safety.passed ? "BLOCKED" : "NEEDS_REVIEW";

  return {
    type: "CANDIDATE_OUTREACH",
    status,
    body,
    source: "PRODUCER_AGENT",
    projectBriefId: input.projectBriefId || null,
    projectId: input.projectId || null,
    candidateRecommendationId: input.candidateRecommendationId,
    contactId: input.contactId || null,
    personId: input.personId || null,
    recipientKind: "CANDIDATE",
    forbiddenClaimsCheck: safety,
    adminReviewRequired: true,
    blockReason: blocked
      ? input.optedOut
        ? "candidate_opted_out"
        : "candidate_not_approved_for_shortlist"
      : safety.passed
        ? null
        : safety.errors.join(" "),
    metadata: {
      recommendationStatus: input.status,
      role,
      riskCount: input.risks?.length || 0,
    },
  };
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

async function upsertOutboundDraft({
  draft,
  lookup,
}: {
  draft: ProducerOutboundDraft;
  lookup: Prisma.OutboundDraftWhereInput;
}) {
  const db = getDb();
  const existing = await db.outboundDraft.findFirst({
    where: {
      ...lookup,
      status: { in: ["DRAFT", "NEEDS_REVIEW", "BLOCKED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    type: draft.type,
    status: draft.status,
    body: draft.body,
    source: draft.source,
    projectBriefId: draft.projectBriefId,
    projectId: draft.projectId,
    shortlistPacketId: draft.shortlistPacketId,
    candidateRecommendationId: draft.candidateRecommendationId,
    contactId: draft.contactId,
    personId: draft.personId,
    recipientKind: draft.recipientKind,
    blockReason: draft.blockReason,
    metadata: toJson({
      ...draft.metadata,
      forbiddenClaimsCheck: draft.forbiddenClaimsCheck,
      adminReviewRequired: true,
      noSmsSent: true,
      noOutreachCreated: true,
      noGroupChatCreated: true,
    }),
  };

  return existing
    ? getDb().outboundDraft.update({
        where: { id: existing.id },
        data: {
          ...data,
          editedBody: null,
          approvedAt: null,
          approvedBy: null,
          rejectedAt: null,
          sentAt: null,
        },
      })
    : getDb().outboundDraft.create({ data });
}

export async function generateOrganizerShortlistMessageDraftForPacket(
  shortlistPacketId: string,
) {
  const packet = await getDb().shortlistPacket.findUniqueOrThrow({
    where: { id: shortlistPacketId },
  });
  const draft = generateOrganizerShortlistMessageDraft({
    shortlistPacketId: packet.id,
    status: packet.status,
    projectBriefId: packet.projectBriefId,
    projectId: packet.projectId,
    organizerFacingSummary: packet.organizerFacingSummary,
    rolesMissing: packet.rolesMissing,
    candidateSummaries: packet.candidateSummaries,
  });
  const persisted = await upsertOutboundDraft({
    draft,
    lookup: {
      type: "ORGANIZER_SHORTLIST",
      shortlistPacketId: packet.id,
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action:
      persisted.status === "BLOCKED"
        ? "producer.outbound_draft_blocked"
        : "producer.organizer_shortlist_draft_generated",
    entityType: "OutboundDraft",
    entityId: persisted.id,
    metadata: {
      projectBriefId: persisted.projectBriefId,
      projectId: persisted.projectId,
      shortlistPacketId: packet.id,
      draftId: persisted.id,
      draftType: persisted.type,
      status: persisted.status,
      blockReason: persisted.blockReason,
      candidateCount: parseCandidateSummaries(packet.candidateSummaries).length,
      noSmsSent: true,
    },
  });

  return persisted;
}

type RecommendationForDraft = Prisma.CandidateRecommendationGetPayload<{
  include: {
    person: {
      include: {
        creatorProfile: true;
        legacyContact: true;
      };
    };
    opportunity: {
      include: {
        roleOpening: {
          include: {
            project: true;
          };
        };
      };
    };
  };
}>;

function candidateInputForDraft(
  recommendation: RecommendationForDraft,
): CandidateOutreachDraftInput {
  const profile = recommendation.person.creatorProfile;
  const project = recommendation.opportunity.roleOpening.project;
  return {
    candidateRecommendationId: recommendation.id,
    status: recommendation.status,
    personId: recommendation.personId,
    contactId: recommendation.person.legacyContact?.id || null,
    displayName:
      profile?.displayName || recommendation.person.name || "there",
    projectBriefId: project.legacyProjectBriefId,
    projectId: project.id,
    projectType: project.title || project.description,
    projectTitle: project.title,
    city: project.city,
    role: recommendation.opportunity.roleOpening.title,
    matchingReasons: recommendation.matchingReasons,
    risks: recommendation.risks,
    optedOut: recommendation.person.optedOut,
    // PR #52 — personalization fields. The composer uses these to
    // pick a fandom anchor and a candidate-specific reason instead
    // of the generic "your fit for {role}" fallback.
    projectFandoms: project.fandoms,
    candidateFandoms: profile?.fandoms ?? [],
    projectDescription: project.description,
    candidateBio: profile?.bio ?? null,
  };
}

export async function generateCandidateOutreachDraftsForProjectBrief(
  projectBriefId: string,
) {
  const project = await getDb().project.findUnique({
    where: { legacyProjectBriefId: projectBriefId },
    select: { id: true },
  });
  if (!project) {
    throw new Error(
      "Generate Producer Agent role map and candidate recommendations before drafting candidate outreach.",
    );
  }

  return generateCandidateOutreachDraftsForProject(project.id);
}

/**
 * Sibling of generateCandidateOutreachDraftsForProjectBrief that accepts
 * a Project id directly. New tracer-flow Projects (created via
 * upsertProjectFromBrief) don't always have a legacyProjectBriefId, so
 * this is the path the journey/candidate-review code uses to kick off
 * draft generation when transitioning to outreach_prep.
 *
 * Behaviour is identical to the project-brief variant: reads every
 * APPROVED_FOR_SHORTLIST recommendation under the project, runs them
 * through the quality gate, and upserts an OutboundDraft per
 * candidate. Idempotent: re-running re-resolves drafts in place rather
 * than duplicating.
 */
export async function generateCandidateOutreachDraftsForProject(
  projectId: string,
) {
  const recommendations = await getDb().candidateRecommendation.findMany({
    where: {
      status: "APPROVED_FOR_SHORTLIST",
      opportunity: {
        roleOpening: {
          projectId,
        },
      },
    },
    include: {
      person: {
        include: {
          creatorProfile: true,
          legacyContact: true,
        },
      },
      opportunity: {
        include: {
          roleOpening: {
            include: { project: true },
          },
        },
      },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });

  const persisted = [];
  for (const recommendation of recommendations) {
    const qualityGate = await getCandidateRecommendationQualityGate(
      recommendation.id,
    );
    const draftInput = candidateInputForDraft(recommendation);
    const draft = generateCandidateOutreachDraft({
      ...draftInput,
      status: qualityGate.allowed ? draftInput.status : "NEEDS_MORE_INFO",
      risks: [...(draftInput.risks || []), ...qualityGate.blockers],
    });
    const saved = await upsertOutboundDraft({
      draft,
      lookup: {
        type: "CANDIDATE_OUTREACH",
        candidateRecommendationId: recommendation.id,
      },
    });
    persisted.push(saved);

    await logAudit({
      actorType: "ADMIN",
      action:
        saved.status === "BLOCKED"
          ? "producer.outbound_draft_blocked"
          : "producer.candidate_outreach_draft_generated",
      entityType: "OutboundDraft",
      entityId: saved.id,
      metadata: {
        projectBriefId: saved.projectBriefId,
        projectId: saved.projectId,
        candidateRecommendationId: recommendation.id,
        draftId: saved.id,
        draftType: saved.type,
        status: saved.status,
        blockReason: saved.blockReason,
        noSmsSent: true,
        noOutreachCreated: true,
        noGroupChatCreated: true,
      },
    });
  }

  return persisted;
}

export async function editOutboundDraft({
  outboundDraftId,
  editedBody,
  adminNotes,
}: {
  outboundDraftId: string;
  editedBody: string;
  adminNotes?: string | null;
}) {
  const current = await getDb().outboundDraft.findUniqueOrThrow({
    where: { id: outboundDraftId },
  });
  const safety = checkProducerDraftSafety({
    type: current.type,
    body: editedBody,
  });
  const nextStatus =
    current.status === "APPROVED"
      ? "NEEDS_REVIEW"
      : safety.passed
        ? current.status === "BLOCKED"
          ? "NEEDS_REVIEW"
          : current.status
        : "BLOCKED";
  const updated = await getDb().outboundDraft.update({
    where: { id: outboundDraftId },
    data: {
      editedBody,
      adminNotes,
      status: nextStatus,
      blockReason: safety.passed ? null : safety.errors.join(" "),
      ...(current.status === "APPROVED"
        ? { approvedAt: null, approvedBy: null }
        : {}),
      metadata: toJson({
        ...(typeof current.metadata === "object" && current.metadata
          ? current.metadata
          : {}),
        forbiddenClaimsCheck: safety,
      }),
    },
  });

  await logAudit({
    actorType: "ADMIN",
    action:
      updated.status === "BLOCKED"
        ? "producer.outbound_draft_blocked"
        : "producer.outbound_draft_edited",
    entityType: "OutboundDraft",
    entityId: outboundDraftId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId: updated.shortlistPacketId,
      candidateRecommendationId: updated.candidateRecommendationId,
      draftId: updated.id,
      draftType: updated.type,
      oldStatus: current.status,
      newStatus: updated.status,
      blockReason: updated.blockReason,
    },
  });

  return updated;
}

export async function approveOutboundDraft({
  outboundDraftId,
  approvedBy = "admin",
}: {
  outboundDraftId: string;
  approvedBy?: string | null;
}) {
  const current = await getDb().outboundDraft.findUniqueOrThrow({
    where: { id: outboundDraftId },
  });
  const validation = validateOutboundDraftForApproval({
    id: current.id,
    type: current.type,
    status: current.status,
    body: current.body,
    editedBody: current.editedBody,
    projectBriefId: current.projectBriefId,
    projectId: current.projectId,
    shortlistPacketId: current.shortlistPacketId,
    candidateRecommendationId: current.candidateRecommendationId,
    contactId: current.contactId,
    personId: current.personId,
  });

  if (!validation.ok) {
    const blocked = await getDb().outboundDraft.update({
      where: { id: outboundDraftId },
      data: {
        status: "BLOCKED",
        blockReason: validation.errors.join(" "),
        metadata: toJson({
          ...(typeof current.metadata === "object" && current.metadata
            ? current.metadata
            : {}),
          forbiddenClaimsCheck: validation.forbiddenClaimsCheck,
        }),
      },
    });
    await logAudit({
      actorType: "ADMIN",
      action: "producer.outbound_draft_blocked",
      entityType: "OutboundDraft",
      entityId: outboundDraftId,
      metadata: {
        projectBriefId: blocked.projectBriefId,
        projectId: blocked.projectId,
        shortlistPacketId: blocked.shortlistPacketId,
        candidateRecommendationId: blocked.candidateRecommendationId,
        draftId: blocked.id,
        draftType: blocked.type,
        oldStatus: current.status,
        newStatus: blocked.status,
        blockReason: blocked.blockReason,
      },
    });
    throw new Error(validation.errors.join(" "));
  }

  const updated = await getDb().outboundDraft.update({
    where: { id: outboundDraftId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy,
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: "producer.outbound_draft_approved",
    entityType: "OutboundDraft",
    entityId: outboundDraftId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId: updated.shortlistPacketId,
      candidateRecommendationId: updated.candidateRecommendationId,
      draftId: updated.id,
      draftType: updated.type,
      oldStatus: current.status,
      newStatus: updated.status,
      noSmsSent: true,
      noOutreachCreated: true,
      noGroupChatCreated: true,
    },
  });

  return updated;
}

export async function rejectOutboundDraft({
  outboundDraftId,
  adminNotes,
}: {
  outboundDraftId: string;
  adminNotes?: string | null;
}) {
  const current = await getDb().outboundDraft.findUniqueOrThrow({
    where: { id: outboundDraftId },
  });
  const updated = await getDb().outboundDraft.update({
    where: { id: outboundDraftId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      adminNotes: adminNotes || current.adminNotes,
    },
  });
  await logAudit({
    actorType: "ADMIN",
    action: "producer.outbound_draft_rejected",
    entityType: "OutboundDraft",
    entityId: outboundDraftId,
    metadata: {
      projectBriefId: updated.projectBriefId,
      projectId: updated.projectId,
      shortlistPacketId: updated.shortlistPacketId,
      candidateRecommendationId: updated.candidateRecommendationId,
      draftId: updated.id,
      draftType: updated.type,
      oldStatus: current.status,
      newStatus: updated.status,
    },
  });

  return updated;
}
