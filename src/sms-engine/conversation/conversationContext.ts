import { getDb } from "@/sms-engine/db";
import { normalizePhone } from "@/sms-engine/phone";
import { getSmsSafetyConfig } from "@/sms-engine/smsSafety";
import { activeProjectStatuses } from "@/sms-engine/workflow";
import {
  conversationContextSchema,
  type ConversationContext,
  type ConversationIntent,
  type ContactReplyKnownFields,
  type GigSeekerKnownFields,
  type InterestCheckKnownFields,
  type OrganizerIntakeStage,
  type OrganizerKnownFields,
} from "@/sms-engine/conversation/conversationTypes";

const activeOutreachStatuses = [
  "SENT",
  "INTERESTED",
  "MAYBE",
  "NO_RESPONSE",
] as const;

type AllowlistResult = ConversationContext["allowlistResult"];

type LoadConversationContextOptions = {
  intent?: ConversationIntent;
  allowlistResult?: AllowlistResult;
  safetyFlags?: string[];
};

function nonEmpty(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function deriveProjectConcept(input: OrganizerKnownFields) {
  return (
    nonEmpty(input.description) ||
    nonEmpty(input.title) ||
    nonEmpty(input.projectType) ||
    nonEmpty(input.projectConcept)
  );
}

export function missingOrganizerRequiredFields(fields: OrganizerKnownFields) {
  const missing: string[] = [];
  if (!nonEmpty(fields.city)) missing.push("city");
  if (!deriveProjectConcept(fields)) missing.push("projectConcept");
  if (!nonEmpty(fields.scope) && !nonEmpty(fields.vibe)) {
    missing.push("scopeOrVibe");
  }
  return missing;
}

export function missingOrganizerOptionalFields(fields: OrganizerKnownFields) {
  const missing: string[] = [];
  if (!nonEmpty(fields.targetDate)) missing.push("targetDate");
  if (!nonEmpty(fields.budgetRange)) missing.push("budgetRange");
  if (!nonEmpty(fields.expectedAudienceSize)) {
    missing.push("expectedAudienceSize");
  }
  if (!nonEmpty(fields.helpNeeded)) missing.push("helpNeeded");
  return missing;
}

function currentStageFromBriefStatus(
  status?: string | null,
): OrganizerIntakeStage {
  if (status === "NEEDS_ADMIN") return "NEEDS_ADMIN";
  if (status === "BRIEF_READY_FOR_REVIEW") return "BRIEF_READY";
  if (status === "NEW_INBOUND") return "NEW";
  return "NEW";
}

function knownFieldsFromRecords({
  brief,
  project,
}: {
  brief?: {
    firstTimeHost?: boolean | null;
    city?: string | null;
    projectType?: string | null;
    title?: string | null;
    description?: string | null;
    targetDate?: string | null;
    budgetRange?: string | null;
    expectedAudienceSize?: string | null;
    scope?: string | null;
    vibe?: string | null;
    helpNeeded?: string | null;
  } | null;
  project?: {
    title?: string | null;
    description?: string | null;
    city?: string | null;
    targetDate?: string | null;
    budgetRange?: string | null;
    audience?: string | null;
  } | null;
}): OrganizerKnownFields {
  const fields: OrganizerKnownFields = {
    firstTimeHost: brief?.firstTimeHost ?? null,
    city: nonEmpty(brief?.city) || nonEmpty(project?.city),
    projectType: nonEmpty(brief?.projectType),
    title: nonEmpty(brief?.title) || nonEmpty(project?.title),
    description: nonEmpty(brief?.description) || nonEmpty(project?.description),
    targetDate: nonEmpty(brief?.targetDate) || nonEmpty(project?.targetDate),
    budgetRange: nonEmpty(brief?.budgetRange) || nonEmpty(project?.budgetRange),
    expectedAudienceSize:
      nonEmpty(brief?.expectedAudienceSize) || nonEmpty(project?.audience),
    scope: nonEmpty(brief?.scope),
    vibe: nonEmpty(brief?.vibe),
    helpNeeded: nonEmpty(brief?.helpNeeded),
  };
  fields.projectConcept = deriveProjectConcept(fields);
  return fields;
}

function compensationPreferenceFromProfile(
  preferredOpportunityTypes?: string[] | null,
): GigSeekerKnownFields["compensationPreference"] {
  const types = (preferredOpportunityTypes || []).map((item) =>
    item.toLowerCase(),
  );
  const wantsPaid = types.some((item) => item.includes("paid"));
  const wantsCollab = types.some(
    (item) => item.includes("collab") || item.includes("volunteer"),
  );

  if (wantsPaid && wantsCollab) return "paid_or_collab";
  if (wantsPaid) return "paid_only";
  if (wantsCollab) return "volunteer_collab";
  return "unknown";
}

function gigSeekerFieldsFromRecords({
  person,
}: {
  person?: {
    city?: string | null;
    creatorProfile?: {
      city?: string | null;
      roles?: string[] | null;
      skills?: string[] | null;
      fandoms?: string[] | null;
      communities?: string[] | null;
      portfolioUrls?: string[] | null;
      socialUrls?: string[] | null;
      availabilityNotes?: string | null;
      rateNotes?: string | null;
      preferredOpportunityTypes?: string[] | null;
    } | null;
  } | null;
}): GigSeekerKnownFields {
  const profile = person?.creatorProfile;

  return {
    city: nonEmpty(profile?.city) || nonEmpty(person?.city),
    desiredRoles: profile?.roles || [],
    skills: profile?.skills || [],
    fandoms: profile?.fandoms || [],
    communities: profile?.communities || [],
    portfolioUrls: profile?.portfolioUrls || [],
    socialUrls: profile?.socialUrls || [],
    availabilityNotes: nonEmpty(profile?.availabilityNotes),
    rateNotes: nonEmpty(profile?.rateNotes),
    compensationPreference: compensationPreferenceFromProfile(
      profile?.preferredOpportunityTypes,
    ),
    preferredOpportunityTypes: profile?.preferredOpportunityTypes || [],
    safetyFlags: [],
  };
}

function interestCheckFieldsFromMessages(
  priorMessages: ConversationContext["priorMessages"],
): InterestCheckKnownFields {
  const priorText = priorMessages
    .map((message) => message.body)
    .filter(Boolean)
    .join("\n");

  return {
    description: nonEmpty(priorText),
    fandoms: [],
    communities: [],
    safetyFlags: [],
    ambiguityNotes: [],
  };
}

function contactReplyFieldsFromRecords({
  contact,
  person,
  activeOutreach,
  activeProjectBrief,
}: {
  contact?: { id: string; smsOptedOutAt?: Date | string | null } | null;
  person?: { id: string; optedOut?: boolean | null } | null;
  activeOutreach?: {
    id: string;
    status?: string | null;
    consentToGroupChat?: boolean | null;
    candidateRecommendationId?: string | null;
    projectBriefId?: string | null;
  } | null;
  activeProjectBrief?: { id: string; projectId?: string | null } | null;
}): ContactReplyKnownFields {
  return {
    contactId: contact?.id || null,
    personId: person?.id || null,
    outreachId: activeOutreach?.id || null,
    projectBriefId: activeOutreach?.projectBriefId || activeProjectBrief?.id || null,
    projectId: activeProjectBrief?.projectId || null,
    candidateRecommendationId:
      activeOutreach?.candidateRecommendationId || null,
    currentOutreachStatus: activeOutreach?.status || null,
    consentToGroupChat: Boolean(activeOutreach?.consentToGroupChat),
    latestMessageBody: null,
    safetyFlags: [],
    optedOut: Boolean(contact?.smsOptedOutAt || person?.optedOut),
    hasActiveOutreach: Boolean(activeOutreach),
  };
}

export async function loadConversationContext(
  rawPhone: string,
  options: LoadConversationContextOptions = {},
): Promise<ConversationContext> {
  const normalizedPhone = normalizePhone(rawPhone);
  const db = getDb();
  const smsSafety = getSmsSafetyConfig();

  const [user, person, contact] = await Promise.all([
    db.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        smsOptedOutAt: true,
        hasCompletedFirstTimeHostQuestion: true,
      },
    }),
    db.person.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        optedOut: true,
        consentStatus: true,
        creatorProfile: {
          select: {
            id: true,
            reviewStatus: true,
            city: true,
            roles: true,
            skills: true,
            fandoms: true,
            communities: true,
            portfolioUrls: true,
            socialUrls: true,
            availabilityNotes: true,
            rateNotes: true,
            preferredOpportunityTypes: true,
          },
        },
      },
    }),
    db.contact.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        smsOptedOutAt: true,
      },
    }),
  ]);

  const messageScopes = [
    user ? { userId: user.id } : null,
    contact ? { contactId: contact.id } : null,
  ].filter(
    (item): item is { userId: string } | { contactId: string } =>
      Boolean(item),
  );

  const [activeProjectBrief, activeOutreach, priorMessages] = await Promise.all([
    user
      ? db.projectBrief.findFirst({
          where: {
            userId: user.id,
            status: { in: activeProjectStatuses },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            projectId: true,
            firstTimeHost: true,
            city: true,
            projectType: true,
            title: true,
            description: true,
            targetDate: true,
            budgetRange: true,
            expectedAudienceSize: true,
            scope: true,
            vibe: true,
            helpNeeded: true,
            project: {
              select: {
                id: true,
                status: true,
                title: true,
                description: true,
                city: true,
                targetDate: true,
                budgetRange: true,
                audience: true,
              },
            },
          },
        })
      : null,
    contact
      ? db.outreach.findFirst({
          where: {
            contactId: contact.id,
            status: { in: [...activeOutreachStatuses] },
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            projectBriefId: true,
            status: true,
            consentToGroupChat: true,
            opportunityId: true,
            candidateRecommendationId: true,
          },
        })
      : null,
    messageScopes.length > 0
      ? db.message.findMany({
          where: { OR: messageScopes },
          select: {
            id: true,
            direction: true,
            channel: true,
            body: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const project = activeProjectBrief?.project || null;
  const knownFields = knownFieldsFromRecords({
    brief: activeProjectBrief,
    project,
  });
  const gigSeekerKnownFields = gigSeekerFieldsFromRecords({ person });
  const interestCheckKnownFields = interestCheckFieldsFromMessages(priorMessages);
  const contactReplyKnownFields = contactReplyFieldsFromRecords({
    contact,
    person,
    activeOutreach,
    activeProjectBrief,
  });
  const missingRequiredFields = missingOrganizerRequiredFields(knownFields);
  const missingOptionalFields = missingOrganizerOptionalFields(knownFields);

  return conversationContextSchema.parse({
    normalizedPhone,
    userId: user?.id || null,
    personId: person?.id || null,
    contactId: contact?.id || null,
    projectBriefId: activeProjectBrief?.id || null,
    projectId: activeProjectBrief?.projectId || project?.id || null,
    activeOutreachId: activeOutreach?.id || null,
    intent: options.intent || "UNKNOWN",
    priorMessages,
    knownFields,
    gigSeekerKnownFields,
    interestCheckKnownFields,
    contactReplyKnownFields,
    missingRequiredFields,
    missingOptionalFields,
    hasCompletedFirstTimeHostQuestion: Boolean(
      user?.hasCompletedFirstTimeHostQuestion,
    ),
    optedOut: Boolean(
      user?.smsOptedOutAt || contact?.smsOptedOutAt || person?.optedOut,
    ),
    safetyFlags: options.safetyFlags || [],
    providerMode: smsSafety.providerMode,
    sendsDisabled: smsSafety.sendsDisabled,
    allowlistResult: options.allowlistResult || "unknown",
    currentStage: currentStageFromBriefStatus(activeProjectBrief?.status),
    user,
    person: person
      ? {
          id: person.id,
          optedOut: person.optedOut,
          consentStatus: person.consentStatus,
        }
      : null,
    contact,
    creatorProfile: person?.creatorProfile || null,
    activeProjectBrief: activeProjectBrief
      ? {
          id: activeProjectBrief.id,
          status: activeProjectBrief.status,
          projectId: activeProjectBrief.projectId,
          firstTimeHost: activeProjectBrief.firstTimeHost,
          city: activeProjectBrief.city,
          projectType: activeProjectBrief.projectType,
          title: activeProjectBrief.title,
          description: activeProjectBrief.description,
          targetDate: activeProjectBrief.targetDate,
          budgetRange: activeProjectBrief.budgetRange,
          expectedAudienceSize: activeProjectBrief.expectedAudienceSize,
          scope: activeProjectBrief.scope,
          vibe: activeProjectBrief.vibe,
          helpNeeded: activeProjectBrief.helpNeeded,
        }
      : null,
    activeOutreach,
  });
}
