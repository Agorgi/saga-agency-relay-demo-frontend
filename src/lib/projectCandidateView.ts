/**
 * Server-side loader for the /projects/[id]/crew/[roleId] candidate review page.
 *
 * Loads role + candidate recommendations + person details, shapes them into
 * the CandidateCardData "honesty contract" — every card must visibly carry
 * sourceMode, contactability, reviewStatus, and outreachStatus so the UI
 * can't lie about what's happening with each candidate.
 *
 * Returns null when the slug + roleId doesn't resolve to a valid pair.
 */

import { getDb } from "@/sms-engine/db";
import { getOrCreateJourney } from "@/lib/journey/service";
import { looksLikeProjectId } from "@/lib/projectBriefView";
import type { ProjectJourney } from "@/lib/journey/types";

export type CandidateSourceMode =
  | "real"
  | "demo_composite"
  | "researched_unverified";

export type CandidateReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "needs_info";

export type CandidateContactability =
  | "researched"
  | "verified"
  | "unknown"
  | "do_not_contact";

export type CandidateCardData = {
  id: string;
  display: {
    name: string;
    sourceMode: CandidateSourceMode;
    location: string | null;
    primaryRole: string | null;
    secondaryRoles: string[];
  };
  whyFit: string;
  evidence: Array<{ label: string; href: string; domain: string }>;
  contactability: CandidateContactability;
  reviewStatus: CandidateReviewStatus;
  /** Pinned at the data shape level — this page never shows "contacted". */
  outreachStatus: "not_prepared";
};

export type CandidateReviewData = {
  projectId: string;
  roleId: string;
  role: {
    title: string;
    whyNeeded: string;
  };
  candidates: CandidateCardData[];
  state: "ready" | "researching" | "no_candidates";
  journey: ProjectJourney;
  backHref: string;
};

const APPROVED_STATUSES = new Set([
  "APPROVED",
  "APPROVED_FOR_SHORTLIST",
  "SHORTLISTED",
]);

const NEEDS_INFO_STATUSES = new Set(["NEEDS_MORE_INFO"]);

const REJECTED_STATUSES = new Set(["REJECTED", "DO_NOT_CONTACT", "DECLINED"]);

function mapReviewStatus(raw: string): CandidateReviewStatus {
  if (APPROVED_STATUSES.has(raw)) return "approved";
  if (NEEDS_INFO_STATUSES.has(raw)) return "needs_info";
  if (REJECTED_STATUSES.has(raw)) return "rejected";
  return "pending";
}

function domainFromHref(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function buildWhyFit(
  reasons: string[],
  matchingReasonsFallback: string,
): string {
  const trimmed = reasons
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (trimmed.length === 0) return matchingReasonsFallback;
  return trimmed.join(" · ");
}

export async function loadCandidateReview({
  projectId,
  roleId,
}: {
  projectId: string;
  roleId: string;
}): Promise<CandidateReviewData | null> {
  if (!looksLikeProjectId(projectId) || !looksLikeProjectId(roleId)) {
    return null;
  }

  const db = getDb();

  const role = await db.roleOpening.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      projectId: true,
      title: true,
      description: true,
      opportunities: {
        select: {
          recommendations: {
            select: {
              id: true,
              status: true,
              matchingReasons: true,
              shortlistReasonOverride: true,
              organizerFacingSummaryOverride: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  state: true,
                  creatorProfile: {
                    select: {
                      displayName: true,
                      bio: true,
                      roles: true,
                      portfolioUrls: true,
                      socialUrls: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!role) return null;
  if (role.projectId !== projectId) return null;

  const journey = await getOrCreateJourney(projectId);

  const recommendations = role.opportunities.flatMap(
    (opp) => opp.recommendations,
  );

  const candidates: CandidateCardData[] = recommendations.map((rec) => {
    const person = rec.person;
    const profile = person.creatorProfile;
    const evidence: Array<{ label: string; href: string; domain: string }> = [];
    for (const url of profile?.portfolioUrls?.slice(0, 2) ?? []) {
      evidence.push({
        label: "Portfolio",
        href: url,
        domain: domainFromHref(url),
      });
    }
    for (const url of profile?.socialUrls?.slice(0, 2) ?? []) {
      evidence.push({
        label: domainFromHref(url),
        href: url,
        domain: domainFromHref(url),
      });
    }

    const fallbackSummary =
      rec.organizerFacingSummaryOverride ||
      rec.shortlistReasonOverride ||
      profile?.bio ||
      "Saga is gathering more detail on this match.";

    return {
      id: rec.id,
      display: {
        name: profile?.displayName || person.name || "Demo candidate",
        sourceMode: profile?.displayName || person.name ? "real" : "demo_composite",
        location: [person.city, person.state].filter(Boolean).join(", ") || null,
        primaryRole: profile?.roles?.[0] ?? null,
        secondaryRoles: profile?.roles?.slice(1, 3) ?? [],
      },
      whyFit: buildWhyFit(rec.matchingReasons, fallbackSummary),
      evidence,
      contactability: "researched",
      reviewStatus: mapReviewStatus(rec.status as string),
      outreachStatus: "not_prepared",
    };
  });

  return {
    projectId,
    roleId,
    role: {
      title: role.title,
      whyNeeded: role.description || "",
    },
    candidates,
    state:
      candidates.length === 0
        ? recommendations.length === 0
          ? "researching"
          : "no_candidates"
        : "ready",
    journey,
    backHref: `/projects/${projectId}/crew`,
  };
}
