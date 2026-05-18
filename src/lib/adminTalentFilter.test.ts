import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  ADMIN_INCLUDE_COMPOSITES_QUERY_KEY,
  adminCompositeFilterLabel,
  buildAdminCreatorProfileWhere,
  buildAdminPersonWhere,
  shouldIncludeComposites,
} from "@/lib/adminTalentFilter";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.outboundDraft.deleteMany();
    await db.candidateRecommendation.deleteMany();
    await db.opportunity.deleteMany();
    await db.roleOpening.deleteMany();
    await db.creatorProfile.deleteMany();
    await db.webSession.deleteMany();
    await db.projectJourney.deleteMany();
    await db.project.deleteMany();
    await db.person.deleteMany();
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

test("shouldIncludeComposites parses the searchParams object form", () => {
  assert.equal(shouldIncludeComposites(undefined), false);
  assert.equal(shouldIncludeComposites(null), false);
  assert.equal(shouldIncludeComposites({}), false);
  // Truthy values
  assert.equal(shouldIncludeComposites({ includeComposites: "1" }), true);
  assert.equal(shouldIncludeComposites({ includeComposites: "true" }), true);
  assert.equal(shouldIncludeComposites({ includeComposites: "TRUE" }), true);
  assert.equal(shouldIncludeComposites({ includeComposites: "yes" }), true);
  // Falsy / unrelated values
  assert.equal(shouldIncludeComposites({ includeComposites: "0" }), false);
  assert.equal(shouldIncludeComposites({ includeComposites: "false" }), false);
  assert.equal(shouldIncludeComposites({ includeComposites: "" }), false);
  assert.equal(shouldIncludeComposites({ unrelated: "1" }), false);
});

test("shouldIncludeComposites handles array-shaped searchParams values", () => {
  // Next.js can hand us string | string[] | undefined; the parser
  // picks the first array element. Defensive against duplicate
  // query keys.
  assert.equal(
    shouldIncludeComposites({ includeComposites: ["1", "0"] }),
    true,
  );
  assert.equal(
    shouldIncludeComposites({ includeComposites: ["0", "1"] }),
    false,
  );
  assert.equal(
    shouldIncludeComposites({ includeComposites: [] }),
    false,
  );
});

test("shouldIncludeComposites accepts URLSearchParams directly", () => {
  assert.equal(
    shouldIncludeComposites(new URLSearchParams("includeComposites=1")),
    true,
  );
  assert.equal(
    shouldIncludeComposites(new URLSearchParams("other=value")),
    false,
  );
  assert.equal(shouldIncludeComposites(new URLSearchParams("")), false);
});

test("ADMIN_INCLUDE_COMPOSITES_QUERY_KEY is the stable, exported key admin pages link with", () => {
  // Locks the query-string contract so admin page link rewrites
  // can't drift away from the parser. If we ever change the key,
  // this test fails and forces an audit of every link.
  assert.equal(ADMIN_INCLUDE_COMPOSITES_QUERY_KEY, "includeComposites");
});

test("buildAdminPersonWhere hides DEMO_COMPOSITE by default and shows everything when opted in", () => {
  const hide = buildAdminPersonWhere({ includeComposites: false });
  assert.deepEqual(hide, { source: { not: "DEMO_COMPOSITE" } });

  const show = buildAdminPersonWhere({ includeComposites: true });
  assert.deepEqual(show, {});
});

test("buildAdminCreatorProfileWhere filters via the related Person.source", () => {
  const hide = buildAdminCreatorProfileWhere({ includeComposites: false });
  assert.deepEqual(hide, {
    person: { source: { not: "DEMO_COMPOSITE" } },
  });

  const show = buildAdminCreatorProfileWhere({ includeComposites: true });
  assert.deepEqual(show, {});
});

test("adminCompositeFilterLabel returns distinct labels for the two states", () => {
  assert.match(
    adminCompositeFilterLabel({ includeComposites: false }),
    /Hiding composites/i,
  );
  assert.match(
    adminCompositeFilterLabel({ includeComposites: true }),
    /Showing real talent.*composites/i,
  );
});

test("integration: Person.findMany with the default filter hides DEMO_COMPOSITE rows but keeps real Person rows", async () => {
  await withFreshDb(async (db) => {
    await db.person.create({
      data: { name: "Real Producer", source: "ADMIN" },
    });
    await db.person.create({
      data: { name: "Composite Producer", source: "DEMO_COMPOSITE" },
    });

    const hidden = await db.person.findMany({
      where: buildAdminPersonWhere({ includeComposites: false }),
    });
    assert.equal(hidden.length, 1);
    assert.equal(hidden[0].name, "Real Producer");

    const shown = await db.person.findMany({
      where: buildAdminPersonWhere({ includeComposites: true }),
    });
    assert.equal(shown.length, 2);
  });
});

test("integration: CreatorProfile.findMany filters via Person.source under the default filter", async () => {
  await withFreshDb(async (db) => {
    const real = await db.person.create({
      data: { name: "Real Stylist", source: "ADMIN" },
    });
    await db.creatorProfile.create({
      data: { personId: real.id, displayName: "Real Stylist", roles: ["stylist"] },
    });

    const composite = await db.person.create({
      data: { name: "Composite Stylist", source: "DEMO_COMPOSITE" },
    });
    await db.creatorProfile.create({
      data: {
        personId: composite.id,
        displayName: "Composite Stylist",
        roles: ["stylist"],
      },
    });

    const hidden = await db.creatorProfile.findMany({
      where: buildAdminCreatorProfileWhere({ includeComposites: false }),
    });
    assert.equal(hidden.length, 1);
    assert.equal(hidden[0].displayName, "Real Stylist");

    const shown = await db.creatorProfile.findMany({
      where: buildAdminCreatorProfileWhere({ includeComposites: true }),
    });
    assert.equal(shown.length, 2);
  });
});
