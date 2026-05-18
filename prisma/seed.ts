import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../src/sms-engine/phone";
import { redactForLog } from "../src/sms-engine/safeLogging";

const prisma = new PrismaClient();

async function main() {
  const contacts = [
    {
      name: "Maya Chen",
      phone: "+14155550111",
      email: "maya@example.com",
      city: "Los Angeles",
      roles: ["photographer", "content"],
      tags: ["photo", "editorial", "events"],
      portfolioUrl: "https://example.com/maya",
      instagramUrl: "https://instagram.com/maya",
      notes: "Strong nightlife and cosplay coverage.",
    },
    {
      name: "Luis Rivera",
      phone: "+14155550112",
      email: "luis@example.com",
      city: "Los Angeles",
      roles: ["venue partner", "venue owner"],
      tags: ["venue", "warehouse", "pop-up"],
      portfolioUrl: null,
      instagramUrl: "https://instagram.com/luisvenue",
      notes: "Runs a flexible east side venue.",
    },
    {
      name: "Ari Stone",
      phone: "+14155550113",
      email: "ari@example.com",
      city: "Los Angeles",
      roles: ["cosplayer", "creative lead"],
      tags: ["cosplay", "community", "costume"],
      portfolioUrl: "https://example.com/ari",
      instagramUrl: "https://instagram.com/aricos",
      notes: "Reliable community connector.",
    },
    {
      name: "Jules Carter",
      phone: "+14155550114",
      email: "jules@example.com",
      city: "Los Angeles",
      roles: ["dj"],
      tags: ["music", "nightlife", "audio"],
      portfolioUrl: "https://example.com/jules",
      instagramUrl: "https://instagram.com/julesdj",
      notes: "Good for playful, high-energy rooms.",
    },
    {
      name: "Nina Patel",
      phone: "+14155550115",
      email: "nina@example.com",
      city: "San Francisco",
      roles: ["volunteer coordinator", "producer"],
      tags: ["volunteers", "staffing", "operations"],
      portfolioUrl: null,
      instagramUrl: null,
      notes: "Very buttoned-up day-of operator.",
    },
    {
      name: "Theo Brooks",
      phone: "+14155550116",
      email: "theo@example.com",
      city: "Los Angeles",
      roles: ["vendor coordinator"],
      tags: ["vendor", "market", "food", "partners"],
      portfolioUrl: "https://example.com/theo",
      instagramUrl: null,
      notes: "Has a deep indie vendor network.",
    },
  ];

  for (const contact of contacts) {
    await prisma.contact.upsert({
      where: { phone: normalizePhone(contact.phone) },
      update: {
        ...contact,
        phone: normalizePhone(contact.phone),
      },
      create: {
        ...contact,
        phone: normalizePhone(contact.phone),
      },
    });
  }

  const user = await prisma.user.upsert({
    where: { phone: normalizePhone("+14155550999") },
    update: {},
    create: {
      phone: normalizePhone("+14155550999"),
      name: "Sample Organizer",
      hasCompletedFirstTimeHostQuestion: true,
    },
  });

  const seedProjectBriefId = "seed_project_brief_cosplay_night_market";
  const project = await prisma.projectBrief.upsert({
    where: { id: seedProjectBriefId },
    update: {
      userId: user.id,
      status: "BRIEF_READY_FOR_REVIEW",
      firstTimeHost: true,
      city: "Los Angeles",
      projectType: "pop-up event",
      title: "Cosplay Night Market",
      description:
        "A small night market for cosplayers, indie vendors, music, and photo moments.",
      targetDate: "Late summer",
      budgetRange: "Unknown",
      expectedAudienceSize: "100-150",
      scope: "Community-led pop-up with vendors, DJ, photo coverage, and light programming.",
      vibe: "Playful, welcoming, polished but not corporate.",
      helpNeeded:
        "Venue, vendor coordination, DJ, photographer, and volunteer support.",
      requiredRoles: [
        {
          role: "Venue Partner",
          reason: "Helps identify and coordinate a realistic space.",
          priority: "core",
          tags: ["venue", "space"],
        },
        {
          role: "Vendor Coordinator",
          reason: "Coordinates indie vendors and setup expectations.",
          priority: "core",
          tags: ["vendor", "market"],
        },
        {
          role: "Photographer",
          reason: "Captures cosplay looks and market energy.",
          priority: "core",
          tags: ["photo", "content"],
        },
      ],
      adminNotes: "Seed project for local and staging demo testing.",
    },
    create: {
      id: seedProjectBriefId,
      userId: user.id,
      status: "BRIEF_READY_FOR_REVIEW",
      firstTimeHost: true,
      city: "Los Angeles",
      projectType: "pop-up event",
      title: "Cosplay Night Market",
      description:
        "A small night market for cosplayers, indie vendors, music, and photo moments.",
      targetDate: "Late summer",
      budgetRange: "Unknown",
      expectedAudienceSize: "100-150",
      scope: "Community-led pop-up with vendors, DJ, photo coverage, and light programming.",
      vibe: "Playful, welcoming, polished but not corporate.",
      helpNeeded:
        "Venue, vendor coordination, DJ, photographer, and volunteer support.",
      requiredRoles: [
        {
          role: "Venue Partner",
          reason: "Helps identify and coordinate a realistic space.",
          priority: "core",
          tags: ["venue", "space"],
        },
        {
          role: "Vendor Coordinator",
          reason: "Coordinates indie vendors and setup expectations.",
          priority: "core",
          tags: ["vendor", "market"],
        },
        {
          role: "Photographer",
          reason: "Captures cosplay looks and market energy.",
          priority: "core",
          tags: ["photo", "content"],
        },
      ],
      adminNotes: "Seed project for local and staging demo testing.",
    },
  });

  await prisma.message.deleteMany({
    where: {
      projectBriefId: project.id,
      metadata: {
        path: ["seed"],
        equals: true,
      },
    },
  });
  await prisma.message.createMany({
    data: [
      {
        direction: "INBOUND",
        channel: "SMS",
        userId: user.id,
        projectBriefId: project.id,
        body: "I want to host a cosplay night market in LA with vendors and music.",
        metadata: { seed: true },
      },
      {
        direction: "OUTBOUND",
        channel: "SMS",
        userId: user.id,
        projectBriefId: project.id,
        body: "Love this. I can help turn it into an actual production plan. First — have you hosted something like this before?",
        metadata: { seed: true },
      },
      {
        direction: "INBOUND",
        channel: "SMS",
        userId: user.id,
        projectBriefId: project.id,
        body: "First one.",
        metadata: { seed: true },
      },
      {
        direction: "OUTBOUND",
        channel: "SMS",
        userId: user.id,
        projectBriefId: project.id,
        body: "Got it. I'm going to turn this into a brief and start mapping the kind of team that could bring it to life. I'll follow up with a shortlist once I've checked who's interested.",
        metadata: { seed: true },
      },
    ],
  });

  await prisma.auditLog.deleteMany({
    where: {
      action: "seed.created",
      entityType: "ProjectBrief",
      entityId: project.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: "seed.created",
      entityType: "ProjectBrief",
      entityId: project.id,
      metadata: { contactCount: contacts.length, seed: true },
    },
  });

  const networkPeople = [
    {
      name: "Sample Organizer",
      phone: "+14155550999",
      city: "Los Angeles",
      roles: ["producer", "community organizer"],
      skills: ["production", "community", "events"],
      fandoms: ["anime", "cosplay", "gaming"],
      communities: ["LA Cosplay Circle"],
      links: ["https://example.com/sample-organizer"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Maya Chen",
      phone: "+14155550111",
      city: "Los Angeles",
      roles: ["photographer"],
      skills: ["photography", "content", "events"],
      fandoms: ["anime", "cosplay"],
      communities: ["LA Cosplay Circle"],
      links: ["https://example.com/maya", "https://instagram.com/maya"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Jules Carter",
      phone: "+14155550114",
      city: "Los Angeles",
      roles: ["dj"],
      skills: ["music", "audio", "nightlife"],
      fandoms: ["anime", "gaming", "K-pop"],
      communities: ["Anime Rave LA"],
      links: ["https://example.com/jules"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Ari Stone",
      phone: "+14155550113",
      city: "Los Angeles",
      roles: ["cosplayer", "host"],
      skills: ["cosplay", "costume", "performance"],
      fandoms: ["cosplay", "fantasy", "comics"],
      communities: ["LA Cosplay Circle"],
      links: ["https://example.com/ari"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Luis Rivera",
      phone: "+14155550112",
      city: "Los Angeles",
      roles: ["venue owner", "venue"],
      skills: ["venue", "space", "operations"],
      fandoms: ["anime", "gaming"],
      communities: ["Eastside Event Spaces"],
      links: ["https://instagram.com/luisvenue"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Theo Brooks",
      phone: "+14155550116",
      city: "Los Angeles",
      roles: ["vendor coordinator"],
      skills: ["vendor", "market", "partners"],
      fandoms: ["anime", "cosplay", "comics"],
      communities: ["Indie Vendor Network"],
      links: ["https://example.com/theo"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Nina Patel",
      phone: "+14155550115",
      city: "San Francisco",
      roles: ["volunteer coordinator", "producer"],
      skills: ["volunteers", "staffing", "operations"],
      fandoms: ["gaming", "fantasy"],
      communities: ["Bay Area Game Makers"],
      links: [],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Kiko Tanaka",
      phone: "+14155550117",
      city: "Los Angeles",
      roles: ["illustrator"],
      skills: ["illustration", "art", "visual"],
      fandoms: ["anime", "horror", "fantasy"],
      communities: ["Artist Alley LA"],
      links: ["https://example.com/kiko"],
      reviewStatus: "PENDING_REVIEW" as const,
    },
    {
      name: "Sam Okafor",
      phone: "+14155550118",
      city: "Los Angeles",
      roles: ["graphic designer"],
      skills: ["design", "graphics", "branding"],
      fandoms: ["gaming", "comics"],
      communities: ["Creator Design Guild"],
      links: ["https://example.com/sam"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Priya Shah",
      phone: "+14155550119",
      city: "New York",
      roles: ["photographer", "videographer"],
      skills: ["photography", "video", "content"],
      fandoms: ["cosplay", "K-pop"],
      communities: ["NYC Cosplay Shoots"],
      links: ["https://example.com/priya"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Marco Silva",
      phone: "+14155550120",
      city: "New York",
      roles: ["dj"],
      skills: ["music", "audio", "nightlife"],
      fandoms: ["K-pop", "anime"],
      communities: ["NYC Anime Club"],
      links: ["https://example.com/marco"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Leah Kim",
      phone: "+14155550121",
      city: "New York",
      roles: ["cosplayer", "host"],
      skills: ["cosplay", "hosting", "community"],
      fandoms: ["anime", "cosplay", "comics"],
      communities: ["NYC Anime Club"],
      links: ["https://example.com/leah"],
      reviewStatus: "PENDING_REVIEW" as const,
    },
    {
      name: "Drew Martin",
      phone: "+14155550122",
      city: "Los Angeles",
      roles: ["production assistant"],
      skills: ["production", "logistics", "operations"],
      fandoms: ["horror", "gaming"],
      communities: ["Event Ops LA"],
      links: [],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Imani Ross",
      phone: "+14155550123",
      city: "Los Angeles",
      roles: ["videographer"],
      skills: ["video", "camera", "content"],
      fandoms: ["anime", "horror"],
      communities: ["LA Content Crew"],
      links: ["https://example.com/imani"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Noah Weiss",
      phone: "+14155550124",
      city: "New York",
      roles: ["venue owner"],
      skills: ["venue", "space", "operations"],
      fandoms: ["gaming", "comics"],
      communities: ["Brooklyn Indie Venues"],
      links: ["https://example.com/noah"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Tara Singh",
      phone: "+14155550125",
      city: "Los Angeles",
      roles: ["sponsor partner"],
      skills: ["brand", "sponsor", "partnerships"],
      fandoms: ["anime", "K-pop"],
      communities: ["Culture Brand Partners"],
      links: ["https://example.com/tara"],
      reviewStatus: "NEEDS_MORE_INFO" as const,
    },
    {
      name: "Ben Park",
      phone: "+14155550126",
      city: "Los Angeles",
      roles: ["vendor coordinator", "producer"],
      skills: ["vendor", "production", "market"],
      fandoms: ["gaming", "anime"],
      communities: ["Indie Vendor Network"],
      links: ["https://example.com/ben"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Sofia Garcia",
      phone: "+14155550127",
      city: "New York",
      roles: ["illustrator", "graphic designer"],
      skills: ["illustration", "design", "art"],
      fandoms: ["fantasy", "comics"],
      communities: ["NYC Artist Alley"],
      links: ["https://example.com/sofia"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Em Carter",
      phone: "+14155550128",
      city: "Los Angeles",
      roles: ["host", "cosplayer"],
      skills: ["hosting", "cosplay", "performance"],
      fandoms: ["maid cafe", "anime", "cosplay"],
      communities: ["Maid Cafe LA"],
      links: ["https://example.com/em"],
      reviewStatus: "APPROVED" as const,
    },
    {
      name: "Rae Morgan",
      phone: "+14155550129",
      city: "Los Angeles",
      roles: ["photographer", "producer"],
      skills: ["photography", "production", "community"],
      fandoms: ["horror", "fantasy", "cosplay"],
      communities: ["Horror Fans LA"],
      links: ["https://example.com/rae"],
      reviewStatus: "PENDING_REVIEW" as const,
    },
  ];

  const personByPhone = new Map<string, string>();

  for (const item of networkPeople) {
    const person = await prisma.person.upsert({
      where: { phone: normalizePhone(item.phone) },
      update: {
        name: item.name,
        city: item.city,
        source: item.name === "Sample Organizer" ? "APP" : "IMPORT",
        consentStatus: "IMPLIED",
      },
      create: {
        name: item.name,
        phone: normalizePhone(item.phone),
        city: item.city,
        source: item.name === "Sample Organizer" ? "APP" : "IMPORT",
        consentStatus: "IMPLIED",
      },
    });
    personByPhone.set(item.phone, person.id);

    if (item.name !== "Sample Organizer") {
      await prisma.creatorProfile.upsert({
        where: { personId: person.id },
        update: {
          displayName: item.name,
          city: item.city,
          roles: item.roles,
          skills: item.skills,
          fandoms: item.fandoms,
          communities: item.communities,
          portfolioUrls: item.links.filter((link) => link.startsWith("http")),
          socialUrls: item.links,
          preferredOpportunityTypes: ["paid", "collab"],
          reviewStatus: item.reviewStatus,
        },
        create: {
          personId: person.id,
          displayName: item.name,
          city: item.city,
          roles: item.roles,
          skills: item.skills,
          fandoms: item.fandoms,
          communities: item.communities,
          portfolioUrls: item.links.filter((link) => link.startsWith("http")),
          socialUrls: item.links,
          preferredOpportunityTypes: ["paid", "collab"],
          reviewStatus: item.reviewStatus,
        },
      });
    }
  }

  const organizerPersonId = personByPhone.get("+14155550999") as string;
  const relationshipRows = [
    ["+14155550999", "+14155550111", "FRIEND", 1],
    ["+14155550999", "+14155550114", "MUTUAL", 1],
    ["+14155550999", "+14155550113", "SAME_COMMUNITY", 1],
    ["+14155550999", "+14155550112", "COLLABORATED", 1],
    ["+14155550999", "+14155550116", "ATTENDED_SAME_EVENT", 1],
    ["+14155550111", "+14155550123", "COLLABORATED", 0.8],
    ["+14155550113", "+14155550128", "SAME_COMMUNITY", 0.9],
    ["+14155550120", "+14155550121", "FRIEND", 1],
    ["+14155550124", "+14155550127", "IMPORTED_CONNECTION", 0.5],
  ] as const;

  for (const [fromPhone, toPhone, relationshipType, strength] of relationshipRows) {
    await prisma.relationshipEdge.upsert({
      where: {
        fromPersonId_toPersonId_relationshipType: {
          fromPersonId: personByPhone.get(fromPhone) as string,
          toPersonId: personByPhone.get(toPhone) as string,
          relationshipType,
        },
      },
      update: { strength },
      create: {
        fromPersonId: personByPhone.get(fromPhone) as string,
        toPersonId: personByPhone.get(toPhone) as string,
        relationshipType,
        strength,
      },
    });
  }

  const networkProjectSpecs = [
    {
      existingSagaEventId: "evt_demo_anime_rave_la",
      title: "Anime Rave LA",
      city: "Los Angeles",
      targetDate: "Late summer",
      description:
        "A fandom-aligned music night with DJs, guest cosplayers, photo moments, and community vendors.",
      fandoms: ["anime", "cosplay", "gaming"],
      roles: ["dj", "photographer", "guest cosplayer", "venue", "vendor coordinator"],
    },
    {
      existingSagaEventId: "evt_demo_nyc_cosplay_picnic",
      title: "NYC Cosplay Picnic",
      city: "New York",
      targetDate: "June",
      description:
        "A low-lift cosplay picnic with photo walks, community hosts, and artist alley vendors.",
      fandoms: ["cosplay", "anime", "comics"],
      roles: ["photographer", "host", "vendor coordinator", "graphic designer"],
    },
    {
      existingSagaEventId: "evt_demo_horror_market",
      title: "Horror Artist Night Market",
      city: "Los Angeles",
      targetDate: "October",
      description:
        "A horror and fantasy artist market with creators, photo coverage, and sponsor-friendly moments.",
      fandoms: ["horror", "fantasy", "comics"],
      roles: ["venue", "illustrator", "photographer", "sponsor partner"],
    },
  ];

  const roleTemplateByType: Record<string, { title: string; skills: string[] }> = {
    dj: { title: "DJ", skills: ["music", "audio", "nightlife"] },
    photographer: { title: "Photographer", skills: ["photography", "content", "events"] },
    "guest cosplayer": { title: "Guest Cosplayer", skills: ["cosplay", "costume", "community"] },
    venue: { title: "Venue Partner", skills: ["venue", "space", "operations"] },
    "vendor coordinator": { title: "Vendor Coordinator", skills: ["vendor", "market", "partners"] },
    host: { title: "Host", skills: ["hosting", "community", "performance"] },
    "graphic designer": { title: "Graphic Designer", skills: ["design", "graphics", "branding"] },
    illustrator: { title: "Illustrator", skills: ["illustration", "art", "visual"] },
    "sponsor partner": { title: "Sponsor / Brand Partner", skills: ["brand", "sponsor", "partnerships"] },
  };

  for (const spec of networkProjectSpecs) {
    let networkProject = await prisma.project.findFirst({
      where: { existingSagaEventId: spec.existingSagaEventId },
    });
    networkProject ||= await prisma.project.create({
      data: {
        source: "MOBILE_APP",
        existingSagaEventId: spec.existingSagaEventId,
        organizerPersonId,
        title: spec.title,
        city: spec.city,
        targetDate: spec.targetDate,
        description: spec.description,
        fandoms: spec.fandoms,
        status: "ROLE_MAPPING",
      },
    });

    for (const roleType of spec.roles) {
      const template = roleTemplateByType[roleType];
      let opening = await prisma.roleOpening.findFirst({
        where: { projectId: networkProject.id, roleType },
      });
      opening ||= await prisma.roleOpening.create({
        data: {
          projectId: networkProject.id,
          roleType,
          title: template.title,
          description: `Demo opening for ${template.title}.`,
          requiredSkills: template.skills,
          preferredFandoms: spec.fandoms,
          locationRequirement: spec.city,
          compensationType: "PAID",
          budgetRange: "Demo TBD",
          status: "OPEN",
        },
      });

      const existingOpportunity = await prisma.opportunity.findFirst({
        where: { roleOpeningId: opening.id },
      });
      if (!existingOpportunity) {
        await prisma.opportunity.create({
          data: {
            roleOpeningId: opening.id,
            visibility: "FRIENDS",
            applicationMode: "INVITE_AND_APPLY",
            status: "ACTIVE",
          },
        });
      }
    }
  }

  const interestChecks = [
    {
      title: "Maid cafe pop-up interest check",
      description:
        "A cute, fandom-led maid cafe pop-up with performers, themed snacks, and photo moments.",
      city: "Los Angeles",
      fandoms: ["anime", "maid cafe", "cosplay"],
      currentInterestCount: 2,
      thresholdValue: 3,
    },
    {
      title: "Indie horror cosplay photo night",
      description:
        "A horror-themed creator shoot and mini-market if enough local fans want it.",
      city: "Los Angeles",
      fandoms: ["horror", "cosplay"],
      currentInterestCount: 6,
      thresholdValue: 10,
    },
  ];

  for (const check of interestChecks) {
    const existing = await prisma.interestCheck.findFirst({
      where: { title: check.title },
    });
    if (!existing) {
      await prisma.interestCheck.create({
        data: {
          ...check,
          creatorPersonId: personByPhone.get("+14155550128"),
          thresholdType: "INTERESTED_COUNT",
          status:
            check.currentInterestCount >= check.thresholdValue
              ? "THRESHOLD_MET"
              : "ACTIVE",
        },
      });
    }
  }

  await prisma.auditLog.deleteMany({
    where: {
      action: "seed.network_demo_created",
      entityType: "Person",
      entityId: organizerPersonId,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: "seed.network_demo_created",
      entityType: "Person",
      entityId: organizerPersonId,
      metadata: {
        people: networkPeople.length,
        projects: networkProjectSpecs.length,
        interestChecks: interestChecks.length,
        seed: true,
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(redactForLog(error));
    await prisma.$disconnect();
    process.exit(1);
  });
