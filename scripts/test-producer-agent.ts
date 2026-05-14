import type { Prisma, ProjectBrief, User } from "@prisma/client";
import {
  extractBriefFields,
  generateIntakeReply,
  suggestRequiredRoles,
} from "@/lib/producerAgent";
import { getLlmConfigPresence } from "@/lib/env";
import { redactForLog } from "@/lib/safeLogging";
import { assessMessageSafety } from "@/lib/safety";
import { mergeBriefPatch } from "@/lib/workflow";

const now = new Date("2026-05-06T12:00:00.000Z");

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user",
    phone: "+14155550000",
    name: null,
    hasCompletedFirstTimeHostQuestion: false,
    smsOptedOutAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function baseProject(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return {
    id: "test-project",
    userId: "test-user",
    projectId: null,
    status: "INTAKE_IN_PROGRESS",
    previousStatus: null,
    escalationReason: null,
    escalationFlags: [] as Prisma.JsonArray,
    escalationResolvedAt: null,
    firstTimeHost: null,
    city: null,
    projectType: null,
    title: null,
    description: null,
    targetDate: null,
    budgetRange: null,
    expectedAudienceSize: null,
    scope: null,
    vibe: null,
    helpNeeded: null,
    requiredRoles: [] as Prisma.JsonArray,
    adminNotes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const samples: Array<{
  name: string;
  message: string;
  user?: Partial<User>;
  project?: Partial<ProjectBrief>;
}> = [
  {
    name: "anime rave in LA",
    message: "I want to throw an anime rave in LA for maybe 200 people.",
  },
  {
    name: "cosplay picnic in NYC",
    message: "A cozy cosplay picnic in Brooklyn with photographers and vendors.",
  },
  {
    name: "gaming pop-up in Atlanta",
    message: "Gaming pop-up in Atlanta, probably a weekend afternoon.",
  },
  {
    name: "creator photoshoot in LA",
    message: "Creator photoshoot day in LA with 8 influencers and styled sets.",
  },
  {
    name: "brand launch party",
    message: "A small brand launch party, polished but not too corporate.",
  },
  {
    name: "vague missing city",
    message: "I have a vague idea for a community art thing.",
  },
  {
    name: "unsafe high-risk event",
    message: "I want pyro and a packed warehouse, can Saga make it happen?",
  },
  {
    name: "alcohol question",
    message: "Can you handle alcohol permits and security for the night?",
  },
  {
    name: "guaranteed ticket sales",
    message: "Can Saga guarantee 500 ticket sales?",
  },
  {
    name: "first-time answer",
    message: "This would be my first time hosting anything.",
  },
  {
    name: "experienced answer",
    message: "Yes, I have produced several pop-ups before.",
  },
  {
    name: "city only",
    message: "Los Angeles, probably east side.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: { firstTimeHost: true },
  },
  {
    name: "concept after city",
    message: "A late-night cosplay karaoke lounge with DJs and content capture.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: { firstTimeHost: true, city: "Los Angeles" },
  },
  {
    name: "scope vibe",
    message: "Playful, stylish, community-led, about 100 to 150 people.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: {
      firstTimeHost: false,
      city: "New York",
      description: "Cosplay picnic and creator meetup.",
    },
  },
  {
    name: "date timing",
    message: "Late August or early September if that is realistic.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: {
      firstTimeHost: false,
      city: "Atlanta",
      description: "Gaming pop-up.",
      vibe: "high energy",
    },
  },
  {
    name: "budget range",
    message: "Probably 5k to 8k to start.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: {
      firstTimeHost: false,
      city: "Los Angeles",
      description: "Creator photoshoot.",
      vibe: "editorial",
      targetDate: "June",
    },
  },
  {
    name: "audience size",
    message: "Maybe 75 people max.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: {
      firstTimeHost: true,
      city: "Chicago",
      description: "Indie game meetup.",
      vibe: "casual",
      targetDate: "fall",
      budgetRange: "unknown",
    },
  },
  {
    name: "help needed",
    message: "I need a DJ, photographer, venue lead, and someone to coordinate vendors.",
    user: { hasCompletedFirstTimeHostQuestion: true },
    project: {
      firstTimeHost: true,
      city: "Los Angeles",
      description: "Anime rave.",
      vibe: "high energy",
      targetDate: "summer",
      budgetRange: "10k",
      expectedAudienceSize: "200",
    },
  },
  {
    name: "contracts payment dispute",
    message: "The vendor wants a deposit and contract tonight. Should I sign?",
  },
  {
    name: "minors safety",
    message: "There may be minors, medical needs, and a security plan.",
  },
];

async function main() {
  const llm = getLlmConfigPresence();
  console.log(
    JSON.stringify(
      {
        llm,
        fallbackUsage: llm.configured
          ? "LLM enabled; deterministic fallback is used on errors or invalid JSON."
          : "OPENAI_API_KEY missing; deterministic fallback mode.",
        sampleCount: samples.length,
      },
      null,
      2,
    ),
  );

  for (const sample of samples) {
    const user = baseUser(sample.user);
    const project = baseProject(sample.project);
    const extracted = await extractBriefFields(project, sample.message);
    const projectedBrief = mergeBriefPatch(project, {
      firstTimeHost: extracted.firstTimeHost ?? undefined,
      city: extracted.city ?? undefined,
      projectType: extracted.projectType ?? undefined,
      title: extracted.title ?? undefined,
      description: extracted.description ?? undefined,
      targetDate: extracted.targetDate ?? undefined,
      budgetRange: extracted.budgetRange ?? undefined,
      expectedAudienceSize: extracted.expectedAudienceSize ?? undefined,
      scope: extracted.scope ?? undefined,
      vibe: extracted.vibe ?? undefined,
      helpNeeded: extracted.helpNeeded ?? undefined,
    });
    const roles = await suggestRequiredRoles(projectedBrief);
    const reply = await generateIntakeReply(projectedBrief, sample.message, user);
    const safety = assessMessageSafety(sample.message);

    console.log(
      JSON.stringify(
        {
          name: sample.name,
          inbound: sample.message,
          extracted,
          roleNames: roles.map((role) => role.role),
          reply,
          escalatedToNeedsAdmin:
            safety.needsAdmin ||
            extracted.needsAdmin ||
            reply.needsAdmin ||
            extracted.confidence < 0.35 ||
            reply.confidence < 0.35,
          safetyFlags: [...new Set([...safety.flags, ...extracted.safetyFlags])],
          validationErrors:
            "Zod validation errors are caught inside producerAgent and return deterministic fallbacks.",
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
