import "dotenv/config";

type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error?: string;
      issues?: unknown;
    };

type SafePersonResponse = {
  id: string;
  sagaUserId: string | null;
  phoneConfigured?: boolean;
  emailConfigured?: boolean;
  creatorProfile?: {
    id: string;
    roles: string[];
    skills: string[];
    fandoms: string[];
    communities: string[];
  } | null;
};

type ProjectResponse = {
  id: string;
  existingSagaEventId: string | null;
  existingSagaCommunityId: string | null;
  title: string | null;
  source: string;
};

type RoleOpeningResponse = Array<{
  id: string;
  roleType: string;
  title: string;
  opportunities?: Array<{ id: string }>;
}>;

type RecommendationsResponse = {
  project: ProjectResponse;
  groups: Array<{
    roleOpening: {
      id: string;
      roleType: string;
      title: string;
    };
    opportunityId: string;
    recommendations: Array<{
      id: string;
      score: number;
      matchingReasons: string[];
      risks: string[];
      candidate: SafePersonResponse;
    }>;
  }>;
};

type OpportunitiesResponse = Array<{
  id: string;
  status: string;
  roleOpening: {
    id: string;
    roleType: string;
    title: string;
  };
  project: ProjectResponse;
  interestStatus?: string;
}>;

type OpportunityInterestResponse = {
  recommendationId: string;
  status: string;
};

const forbiddenIntegrationKeys = [
  "ticketingEnabled",
  "rsvpEnabled",
  "qrCode",
  "qrCodes",
  "payment",
  "payments",
  "ticketSales",
  "sales",
];

function requiredEnv() {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!appBaseUrl || !internalApiKey) {
    console.log(
      "Skipping mock app integration rehearsal: APP_BASE_URL and INTERNAL_API_KEY are required.",
    );
    return null;
  }

  return { appBaseUrl, internalApiKey };
}

function redact(value: unknown) {
  return JSON.stringify(value)
    .replaceAll(process.env.INTERNAL_API_KEY || "__missing__", "[redacted]")
    .replace(/\+1\d{10}/g, "[redacted-phone]");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoForbiddenKeys(value: unknown, context: string) {
  const walk = (item: unknown, path: string[]) => {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) {
      item.forEach((entry, index) => walk(entry, [...path, String(index)]));
      return;
    }

    for (const [key, nested] of Object.entries(item as Record<string, unknown>)) {
      if (
        forbiddenIntegrationKeys.some(
          (forbidden) => forbidden.toLowerCase() === key.toLowerCase(),
        )
      ) {
        throw new Error(
          `${context} exposed integration-owned field ${[...path, key].join(".")}.`,
        );
      }
      walk(nested, [...path, key]);
    }
  };

  walk(value, []);
}

async function request<T>({
  appBaseUrl,
  internalApiKey,
  method,
  path,
  body,
}: {
  appBaseUrl: string;
  internalApiKey: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}) {
  const response = await fetch(`${appBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-saga-internal-key": internalApiKey,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = (await response.json().catch(() => ({
    ok: false,
    error: "Response was not JSON.",
  }))) as ApiEnvelope<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(
      `${method} ${path} failed with ${response.status}: ${
        payload.ok ? "Unknown error" : payload.error || JSON.stringify(payload.issues)
      }`,
    );
  }

  assertNoForbiddenKeys(payload.data, `${method} ${path}`);
  return payload.data;
}

async function main() {
  const env = requiredEnv();
  if (!env) return;

  const suffix = Date.now();
  const suffixDigits = String(suffix).slice(-4);
  const organizerSagaUserId = `mock_app_org_${suffix}`;
  const photographerSagaUserId = `mock_app_photo_${suffix}`;
  const djSagaUserId = `mock_app_dj_${suffix}`;
  const communityIds = ["mock-community-anime-la", "mock-community-cosplay-la"];
  const existingSagaEventId = `mock_app_event_${suffix}`;

  const organizer = await request<SafePersonResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/users/upsert",
    body: {
      sagaUserId: organizerSagaUserId,
      name: "Mock App Organizer",
      phone: `+1415557${suffixDigits}`,
      city: "Los Angeles",
      communities: communityIds,
    },
  });
  assert(organizer.id, "Organizer upsert did not return a Person id.");

  const photographer = await request<SafePersonResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/users/upsert",
    body: {
      sagaUserId: photographerSagaUserId,
      name: "Mock App Photographer",
      phone: `+1415558${suffixDigits}`,
      city: "Los Angeles",
      communities: communityIds,
      roles: ["photographer"],
      skills: ["photography", "content", "events"],
      fandoms: ["anime", "cosplay"],
      portfolioUrls: ["https://example.test/mock-photo"],
      socialUrls: ["https://instagram.test/mock-photo"],
    },
  });
  assert(
    photographer.creatorProfile?.roles.includes("photographer"),
    "Creator profile roles were not created for the photographer.",
  );

  const dj = await request<SafePersonResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/users/upsert",
    body: {
      sagaUserId: djSagaUserId,
      name: "Mock App DJ",
      city: "Los Angeles",
      communities: [communityIds[0], "mock-community-gaming-la"],
      roles: ["dj"],
      skills: ["music", "audio", "nightlife"],
      fandoms: ["anime", "gaming"],
      socialUrls: ["https://instagram.test/mock-dj"],
    },
  });
  assert(dj.creatorProfile?.roles.includes("dj"), "Creator profile roles missing.");

  const relationships = await request<{ count: number }>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/relationships/import",
    body: {
      edges: [
        {
          fromSagaUserId: organizerSagaUserId,
          toSagaUserId: photographerSagaUserId,
          relationshipType: "FRIEND",
          strength: 1,
          metadata: { source: "mock-app-integration", communityId: communityIds[0] },
        },
        {
          fromSagaUserId: organizerSagaUserId,
          toSagaUserId: djSagaUserId,
          relationshipType: "SAME_COMMUNITY",
          strength: 0.8,
          metadata: { source: "mock-app-integration", communityId: communityIds[1] },
        },
      ],
    },
  });
  assert(relationships.count >= 2, "Relationship import did not return both edges.");

  const project = await request<ProjectResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/events/import",
    body: {
      existingSagaEventId,
      organizerSagaUserId,
      existingSagaCommunityId: communityIds[0],
      source: "MOBILE_APP",
      title: "Mock App Anime Creator Night",
      description:
        "Synthetic app-imported event reference for staging integration rehearsal.",
      city: "Los Angeles",
      targetDate: "Staging rehearsal window",
      fandoms: ["anime", "cosplay", "gaming"],
    },
  });
  assert(project.existingSagaEventId === existingSagaEventId, "Event import failed.");
  assert(
    project.existingSagaCommunityId === communityIds[0],
    "Fake community reference was not preserved.",
  );

  const roleOpenings = await request<RoleOpeningResponse>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/projects/${project.id}/role-openings`,
    body: {
      publish: true,
      roleOpenings: [
        {
          roleType: "photographer",
          title: "Event Photographer",
          description: "Capture creator portraits and event coverage.",
          skills: ["photography", "content"],
          fandoms: ["anime", "cosplay"],
          compensationType: "UNKNOWN",
          quantityNeeded: 1,
          remoteAllowed: false,
          locationRequirement: "Los Angeles",
        },
        {
          roleType: "dj",
          title: "DJ",
          description: "Shape music and room energy.",
          skills: ["music", "audio"],
          fandoms: ["anime", "gaming"],
          compensationType: "UNKNOWN",
          quantityNeeded: 1,
          remoteAllowed: false,
          locationRequirement: "Los Angeles",
        },
      ],
    },
  });
  assert(roleOpenings.length >= 2, "Expected role openings to be created.");

  const recommendations = await request<RecommendationsResponse>({
    ...env,
    method: "GET",
    path: `/api/internal/saga/projects/${project.id}/recommendations`,
  });
  assert(
    recommendations.groups.length >= 2,
    "Expected recommendations grouped by role opening.",
  );
  assert(
    recommendations.groups.some((group) => group.recommendations.length > 0),
    "Expected at least one synthetic candidate recommendation.",
  );

  const opportunities = await request<OpportunitiesResponse>({
    ...env,
    method: "GET",
    path: `/api/internal/saga/opportunities?city=Los%20Angeles&fandom=anime`,
  });
  const projectOpportunity =
    opportunities.find(
      (opportunity) => opportunity.project.existingSagaEventId === existingSagaEventId,
    ) || opportunities.find((opportunity) => opportunity.id === recommendations.groups[0]?.opportunityId);
  assert(projectOpportunity, "Expected imported event opportunity to be listed.");

  const interest = await request<OpportunityInterestResponse>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/opportunities/${projectOpportunity.id}/interest`,
    body: {
      sagaUserId: photographerSagaUserId,
      message: "Synthetic staging user is interested.",
      availability: "Weekends in staging rehearsal.",
    },
  });
  assert(
    interest.status === "INTERESTED",
    `Expected opportunity interest to become INTERESTED, got ${interest.status}.`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: new URL(env.appBaseUrl).origin,
        users: {
          organizer: organizer.id,
          photographer: photographer.id,
          dj: dj.id,
        },
        communities: communityIds,
        event: project.id,
        roleOpenings: roleOpenings.length,
        recommendationGroups: recommendations.groups.length,
        listedOpportunities: opportunities.length,
        interestStatus: interest.status,
        ticketingRsvpQrPaymentTouched: false,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(redact(error));
  process.exit(1);
});
