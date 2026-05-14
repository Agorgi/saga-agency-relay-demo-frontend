import "dotenv/config";
import { execFileSync } from "node:child_process";
import { getDb } from "@/sms-engine/db";
import { normalizePhone } from "@/sms-engine/phone";
import { redactForLog } from "@/sms-engine/safeLogging";

const seedContactPhones = [
  "+14155550111",
  "+14155550112",
  "+14155550113",
  "+14155550114",
  "+14155550115",
  "+14155550116",
].map(normalizePhone);

const seedPersonPhones = [
  "+14155550999",
  "+14155550111",
  "+14155550112",
  "+14155550113",
  "+14155550114",
  "+14155550115",
  "+14155550116",
  "+14155550117",
  "+14155550118",
  "+14155550119",
  "+14155550120",
  "+14155550121",
  "+14155550122",
  "+14155550123",
  "+14155550124",
  "+14155550125",
  "+14155550126",
  "+14155550127",
  "+14155550128",
  "+14155550129",
].map(normalizePhone);

const seedProjectBriefId = "seed_project_brief_cosplay_night_market";
const seedProjectEventIds = [
  "evt_demo_anime_rave_la",
  "evt_demo_nyc_cosplay_picnic",
  "evt_demo_horror_market",
];
const seedInterestCheckTitles = [
  "Maid cafe pop-up interest check",
  "Indie horror cosplay photo night",
];

function runSeed() {
  execFileSync("npm", ["run", "prisma:seed"], {
    stdio: "inherit",
    env: {
      ...process.env,
      MESSAGING_PROVIDER: process.env.MESSAGING_PROVIDER || "MOCK",
    },
  });
}

async function snapshot() {
  const db = getDb();
  const seedProjects = await db.project.findMany({
    where: { existingSagaEventId: { in: seedProjectEventIds } },
    select: { id: true },
  });
  const seedProjectIds = seedProjects.map((project) => project.id);

  return {
    contacts: await db.contact.count({
      where: { phone: { in: seedContactPhones } },
    }),
    people: await db.person.count({
      where: { phone: { in: seedPersonPhones } },
    }),
    creatorProfiles: await db.creatorProfile.count({
      where: { person: { phone: { in: seedPersonPhones } } },
    }),
    projectBriefs: await db.projectBrief.count({
      where: { id: seedProjectBriefId },
    }),
    projects: seedProjects.length,
    roleOpenings: await db.roleOpening.count({
      where: { projectId: { in: seedProjectIds } },
    }),
    opportunities: await db.opportunity.count({
      where: { roleOpening: { projectId: { in: seedProjectIds } } },
    }),
    recommendations: await db.candidateRecommendation.count({
      where: {
        opportunity: { roleOpening: { projectId: { in: seedProjectIds } } },
      },
    }),
    interestChecks: await db.interestCheck.count({
      where: { title: { in: seedInterestCheckTitles } },
    }),
    seedMessages: await db.message.count({
      where: {
        projectBriefId: seedProjectBriefId,
        metadata: { path: ["seed"], equals: true },
      },
    }),
    seedAuditLogs: await db.auditLog.count({
      where: {
        OR: [
          {
            action: "seed.created",
            entityType: "ProjectBrief",
            entityId: seedProjectBriefId,
          },
          {
            action: "seed.network_demo_created",
            entityType: "Person",
          },
        ],
      },
    }),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("Skipping seed idempotency test: DATABASE_URL is not set.");
    return;
  }

  runSeed();
  const first = await snapshot();
  runSeed();
  const second = await snapshot();

  if (JSON.stringify(first) !== JSON.stringify(second)) {
    console.error("Seed counts changed between consecutive runs.");
    console.error("First:", JSON.stringify(first, null, 2));
    console.error("Second:", JSON.stringify(second, null, 2));
    throw new Error("Seed is not idempotent for the tracked demo rows.");
  }

  console.log("Seed idempotency counts are stable:");
  console.log(JSON.stringify(second, null, 2));
}

main()
  .catch((error) => {
    console.error(redactForLog(error));
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await getDb().$disconnect();
  });
