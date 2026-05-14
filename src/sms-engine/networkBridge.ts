import type { Contact, NetworkProjectStatus, ProjectStatus } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { normalizePhone } from "@/sms-engine/phone";
import { parseRequiredRoles } from "@/sms-engine/workflow";

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function inferFandomsFromText(text: string) {
  const lower = text.toLowerCase();
  const pairs = [
    ["anime", "anime"],
    ["cosplay", "cosplay"],
    ["gaming", "gaming"],
    ["game", "gaming"],
    ["k-pop", "K-pop"],
    ["kpop", "K-pop"],
    ["horror", "horror"],
    ["fantasy", "fantasy"],
    ["comic", "comics"],
    ["maid cafe", "maid cafe"],
  ];
  return unique(
    pairs
      .filter(([needle]) => lower.includes(needle))
      .map(([, fandom]) => fandom),
  );
}

function networkStatusFromBrief(status: ProjectStatus): NetworkProjectStatus {
  if (status === "ARCHIVED") return "ARCHIVED";
  if (status === "NEEDS_ADMIN") return "NEEDS_ADMIN";
  if (status === "GROUPCHAT_ACTIVE" || status === "PRODUCTION_IN_PROGRESS") {
    return "TEAM_FORMING";
  }
  if (status === "SHORTLIST_READY" || status === "SHORTLIST_SENT") {
    return "SHORTLIST_READY";
  }
  if (status === "OUTREACH_DRAFTED" || status === "OUTREACH_IN_PROGRESS") {
    return "RECRUITING";
  }
  if (status === "ROLE_MAPPING_READY") return "ROLE_MAPPING";
  if (status === "BRIEF_READY_FOR_REVIEW") return "BRIEF_READY";
  return "INTAKE";
}

export async function ensurePersonForUser(user: {
  id: string;
  phone: string;
  name?: string | null;
}) {
  const db = getDb();
  const phone = normalizePhone(user.phone);
  const existing = await db.person.findUnique({ where: { phone } });

  if (existing) {
    return db.person.update({
      where: { id: existing.id },
      data: {
        name: user.name || existing.name,
        source: existing.source === "ADMIN" ? "SMS" : existing.source,
        consentStatus:
          existing.consentStatus === "UNKNOWN" ? "IMPLIED" : existing.consentStatus,
      },
    });
  }

  return db.person.create({
    data: {
      phone,
      name: user.name,
      source: "SMS",
      consentStatus: "IMPLIED",
    },
  });
}

export async function ensureProjectForProjectBrief(projectBriefId: string) {
  const db = getDb();
  const brief = await db.projectBrief.findUniqueOrThrow({
    where: { id: projectBriefId },
    include: { user: true, project: true },
  });

  const organizer = await ensurePersonForUser(brief.user);
  const fandoms = inferFandomsFromText(
    [
      brief.title,
      brief.projectType,
      brief.description,
      brief.scope,
      brief.vibe,
      brief.helpNeeded,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const projectData = {
    source: "SMS" as const,
    legacyProjectBriefId: brief.id,
    organizerPersonId: organizer.id,
    title: brief.title || brief.projectType || "SMS project brief",
    description: brief.description || brief.scope || brief.vibe || brief.helpNeeded,
    city: brief.city,
    targetDate: brief.targetDate,
    budgetRange: brief.budgetRange,
    audience: brief.expectedAudienceSize,
    fandoms,
    status: networkStatusFromBrief(brief.status),
  };

  const existing =
    brief.project ||
    (await db.project.findUnique({
      where: { legacyProjectBriefId: brief.id },
    }));

  const project = existing
    ? await db.project.update({
        where: { id: existing.id },
        data: projectData,
      })
    : await db.project.create({
        data: projectData,
      });

  if (brief.projectId !== project.id) {
    await db.projectBrief.update({
      where: { id: brief.id },
      data: { projectId: project.id },
    });
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "network.project_bridged_from_project_brief",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      projectBriefId: brief.id,
      organizerPersonId: organizer.id,
    },
  });

  return project;
}

export async function ensurePersonForContact(contact: Contact) {
  const db = getDb();
  const normalizedPhone = normalizePhone(contact.phone);
  const existing =
    (contact.personId
      ? await db.person.findUnique({ where: { id: contact.personId } })
      : null) ||
    (await db.person.findUnique({ where: { phone: normalizedPhone } })) ||
    (contact.email
      ? await db.person.findUnique({ where: { email: contact.email } })
      : null);

  const personData = {
    phone: normalizedPhone,
    email: contact.email,
    name: contact.name,
    city: contact.city,
    source: "IMPORT" as const,
    optedOut: Boolean(contact.smsOptedOutAt),
    consentStatus: contact.smsOptedOutAt ? ("OPTED_OUT" as const) : ("IMPLIED" as const),
  };

  const person = existing
    ? await db.person.update({
        where: { id: existing.id },
        data: {
          ...personData,
          email: contact.email || existing.email,
          city: contact.city || existing.city,
        },
      })
    : await db.person.create({
        data: personData,
      });

  if (contact.personId !== person.id) {
    await db.contact.update({
      where: { id: contact.id },
      data: { personId: person.id },
    });
  }

  const links = unique([contact.portfolioUrl, contact.instagramUrl]);
  const contactFandoms = inferFandomsFromText(
    [...contact.tags, contact.notes].filter(Boolean).join(" "),
  );
  await db.creatorProfile.upsert({
    where: { personId: person.id },
    update: {
      displayName: contact.name,
      city: contact.city,
      roles: unique(contact.roles),
      skills: unique([...contact.roles, ...contact.tags]),
      fandoms: contactFandoms,
      communities: unique(contact.tags),
      portfolioUrls: contact.portfolioUrl ? [contact.portfolioUrl] : [],
      socialUrls: links,
    },
    create: {
      personId: person.id,
      displayName: contact.name,
      city: contact.city,
      roles: unique(contact.roles),
      skills: unique([...contact.roles, ...contact.tags]),
      fandoms: contactFandoms,
      communities: unique(contact.tags),
      portfolioUrls: contact.portfolioUrl ? [contact.portfolioUrl] : [],
      socialUrls: links,
      preferredOpportunityTypes: [],
      reviewStatus: "PENDING_REVIEW",
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "network.person_bridged_from_contact",
    entityType: "Person",
    entityId: person.id,
    metadata: { contactId: contact.id },
  });

  return person;
}

export async function syncContactToPersonCreatorProfile(contactId: string) {
  const contact = await getDb().contact.findUniqueOrThrow({
    where: { id: contactId },
  });
  return ensurePersonForContact(contact);
}

export async function syncAllContactsToPeople() {
  const contacts = await getDb().contact.findMany();
  const people = [];
  for (const contact of contacts) {
    people.push(await ensurePersonForContact(contact));
  }
  return people;
}

export async function syncRoleOpeningsFromProjectBrief(projectBriefId: string) {
  const db = getDb();
  const [brief, project] = await Promise.all([
    db.projectBrief.findUniqueOrThrow({ where: { id: projectBriefId } }),
    ensureProjectForProjectBrief(projectBriefId),
  ]);
  const roles = parseRequiredRoles(brief.requiredRoles);
  const openings = [];

  for (const role of roles) {
    const roleType = role.role.toLowerCase();
    const existing = await db.roleOpening.findFirst({
      where: { projectId: project.id, roleType },
    });
    const data = {
      title: role.role,
      description: role.reason || undefined,
      requiredSkills: role.tags || [],
      preferredFandoms: project.fandoms,
      locationRequirement: project.city,
      status: "OPEN" as const,
    };
    openings.push(
      existing
        ? await db.roleOpening.update({
            where: { id: existing.id },
            data,
          })
        : await db.roleOpening.create({
            data: {
              projectId: project.id,
              roleType,
              ...data,
            },
          }),
    );
  }

  return openings;
}

export async function ensureNetworkLinksForOutreach(outreachId: string) {
  const db = getDb();
  const outreach = await db.outreach.findUniqueOrThrow({
    where: { id: outreachId },
    include: { contact: true, projectBrief: true },
  });
  const person = await ensurePersonForContact(outreach.contact);
  const project = await ensureProjectForProjectBrief(outreach.projectBriefId);
  const roleType = outreach.contact.roles[0] || "collaborator";
  const roleOpening =
    (await db.roleOpening.findFirst({
      where: { projectId: project.id, roleType },
    })) ||
    (await db.roleOpening.create({
      data: {
        projectId: project.id,
        roleType,
        title: outreach.contact.roles[0] || "Collaborator",
        description: "Legacy SMS outreach candidate bridged into the production network.",
        requiredSkills: unique([...outreach.contact.roles, ...outreach.contact.tags]),
        preferredFandoms: project.fandoms,
        locationRequirement: project.city,
        compensationType: "UNKNOWN",
        status: "OUTREACHING",
      },
    }));
  const opportunity =
    (await db.opportunity.findFirst({
      where: { roleOpeningId: roleOpening.id },
    })) ||
    (await db.opportunity.create({
      data: {
        roleOpeningId: roleOpening.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    }));
  const recommendation = await db.candidateRecommendation.upsert({
    where: {
      opportunityId_personId: {
        opportunityId: opportunity.id,
        personId: person.id,
      },
    },
    update: {
      status:
        outreach.status === "INTERESTED" || outreach.status === "APPROVED_FOR_GROUPCHAT"
          ? "INTERESTED"
          : outreach.status === "NOT_INTERESTED"
            ? "DECLINED"
            : outreach.adminApproved
              ? "CONTACTED"
              : "SUGGESTED",
      matchingReasons: ["Legacy SMS outreach bridge"],
      risks: outreach.contact.smsOptedOutAt ? ["Opted out"] : [],
      score: 1,
      scoreBreakdown: {
        proximity: 0,
        roleFit: 1,
        fandomFit: 0,
        location: 0,
        reliability: 0,
      },
    },
    create: {
      opportunityId: opportunity.id,
      personId: person.id,
      score: 1,
      scoreBreakdown: {
        proximity: 0,
        roleFit: 1,
        fandomFit: 0,
        location: 0,
        reliability: 0,
      },
      proximityTier: "UNKNOWN",
      matchingReasons: ["Legacy SMS outreach bridge"],
      risks: outreach.contact.smsOptedOutAt ? ["Opted out"] : [],
      status: outreach.adminApproved ? "CONTACTED" : "SUGGESTED",
    },
  });

  return db.outreach.update({
    where: { id: outreach.id },
    data: {
      opportunityId: opportunity.id,
      candidateRecommendationId: recommendation.id,
    },
  });
}

export async function ensureProductionConversationForGroupChat(groupChatId: string) {
  const db = getDb();
  const groupChat = await db.groupChat.findUniqueOrThrow({
    where: { id: groupChatId },
    include: { projectBrief: true, productionConversation: true },
  });
  if (groupChat.productionConversation) return groupChat.productionConversation;

  const project = await ensureProjectForProjectBrief(groupChat.projectBriefId);
  const conversation = await db.productionConversation.create({
    data: {
      projectId: project.id,
      provider: "TWILIO",
      externalConversationId: groupChat.twilioConversationSid,
      status: groupChat.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    },
  });
  await db.groupChat.update({
    where: { id: groupChat.id },
    data: { productionConversationId: conversation.id },
  });
  return conversation;
}
