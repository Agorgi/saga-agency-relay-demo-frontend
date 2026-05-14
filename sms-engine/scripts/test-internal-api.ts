import "dotenv/config";
import { redactForLog } from "@/lib/safeLogging";

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

type PersonResponse = {
  id: string;
};

type ProjectResponse = {
  id: string;
};

type RoleOpeningResponse = Array<{
  id: string;
}>;

type RecommendationsResponse = {
  groups: Array<{
    opportunityId: string;
    recommendations: unknown[];
  }>;
};

type OpportunitiesResponse = Array<{
  id: string;
}>;

type InterestCheckResponse = {
  id: string;
};

type InterestCheckInterestResponse = {
  interestCheck: {
    id: string;
  };
  convertedProjectId: string | null;
};

function requiredEnv() {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!appBaseUrl || !internalApiKey) {
    console.log(
      "Skipping internal API smoke test: APP_BASE_URL and INTERNAL_API_KEY are required.",
    );
    return null;
  }

  return { appBaseUrl, internalApiKey };
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

  return payload.data;
}

async function main() {
  const env = requiredEnv();
  if (!env) return;

  const suffix = Date.now();
  const suffixDigits = String(suffix).slice(-4);
  const organizerSagaUserId = `saga_internal_org_${suffix}`;
  const creatorSagaUserId = `saga_internal_creator_${suffix}`;
  const organizerPhone = `+1415555${suffixDigits}`;
  const creatorPhone = `+1415556${suffixDigits}`;

  const organizer = await request<PersonResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/users/upsert",
    body: {
      sagaUserId: organizerSagaUserId,
      name: "Internal Test Organizer",
      phone: organizerPhone,
      city: "Los Angeles",
      communities: ["anime", "cosplay"],
    },
  });

  const creator = await request<PersonResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/users/upsert",
    body: {
      sagaUserId: creatorSagaUserId,
      name: "Internal Test Photographer",
      phone: creatorPhone,
      city: "Los Angeles",
      roles: ["photographer"],
      skills: ["photography", "content"],
      fandoms: ["anime", "cosplay"],
      portfolioUrls: ["https://example.com/photo"],
    },
  });

  await request<{ count: number }>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/relationships/import",
    body: {
      edges: [
        {
          fromSagaUserId: organizerSagaUserId,
          toSagaUserId: creatorSagaUserId,
          relationshipType: "FRIEND",
          strength: 1,
        },
      ],
    },
  });

  const project = await request<ProjectResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/events/import",
    body: {
      existingSagaEventId: `evt_internal_${suffix}`,
      organizerSagaUserId,
      existingSagaCommunityId: "community_anime_la",
      source: "MOBILE_APP",
      title: "Internal API Anime Night",
      description: "A small creator-led anime music night.",
      city: "Los Angeles",
      targetDate: "Fall 2026",
      fandoms: ["anime", "cosplay"],
      ticketingEnabled: true,
      rsvpEnabled: true,
    },
  });

  const openings = await request<RoleOpeningResponse>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/projects/${project.id}/role-openings`,
    body: {
      publish: true,
      roleOpenings: [
        {
          roleType: "photographer",
          title: "Event Photographer",
          skills: ["photography", "content"],
          fandoms: ["anime", "cosplay"],
          compensationType: "UNKNOWN",
          quantityNeeded: 1,
          remoteAllowed: false,
        },
      ],
    },
  });

  const recommendations = await request<RecommendationsResponse>({
    ...env,
    method: "GET",
    path: `/api/internal/saga/projects/${project.id}/recommendations`,
  });

  const opportunities = await request<OpportunitiesResponse>({
    ...env,
    method: "GET",
    path: "/api/internal/saga/opportunities?city=Los%20Angeles&role=photographer",
  });

  const opportunityId =
    recommendations.groups[0]?.opportunityId || opportunities[0]?.id;
  if (!opportunityId) {
    throw new Error("Internal API smoke test could not find an opportunity.");
  }

  await request<{ recommendationId: string; status: string }>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/opportunities/${opportunityId}/interest`,
    body: {
      sagaUserId: creatorSagaUserId,
      message: "I am interested.",
      availability: "Weekends",
    },
  });

  const interestCheck = await request<InterestCheckResponse>({
    ...env,
    method: "POST",
    path: "/api/internal/saga/interest-checks",
    body: {
      creatorSagaUserId,
      title: `Internal Test Interest Check ${suffix}`,
      description: "Would people attend a fandom photo walk?",
      city: "Los Angeles",
      fandoms: ["anime"],
      thresholdType: "INTERESTED_COUNT",
      thresholdValue: 1,
    },
  });

  const interest = await request<InterestCheckInterestResponse>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/interest-checks/${interestCheck.id}/interest`,
    body: {
      sagaUserId: organizerSagaUserId,
    },
  });

  const converted = await request<ProjectResponse>({
    ...env,
    method: "POST",
    path: `/api/internal/saga/interest-checks/${interestCheck.id}/convert`,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: new URL(env.appBaseUrl).origin,
        organizer: organizer.id,
        creator: creator.id,
        project: project.id,
        roleOpenings: openings.length,
        recommendationGroups: recommendations.groups.length,
        opportunities: opportunities.length,
        interestCheck: interest.interestCheck.id,
        autoConvertedProject: interest.convertedProjectId,
        convertedProject: converted.id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(redactForLog(error));
  process.exit(1);
});
