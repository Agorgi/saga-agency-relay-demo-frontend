import type { PublicWebResearchRequest } from "@/lib/sourcing/publicWebResearchProvider";

export const publicWebLiveDryRunFixture = {
  sourceTag: "live_dry_run",
  projectTitle: "Anime picnic in Los Angeles / Silver Lake",
  roleTarget: "cosplay or anime event photographer",
  city: "Los Angeles",
  query: "Los Angeles anime cosplay event photographer portfolio",
  criteria: [
    "public portfolio URL",
    "cosplay/anime event photography evidence",
    "Los Angeles or nearby service-area evidence",
    "source citations required",
    "availability, willingness, and rates remain unknown",
  ],
} as const;

export function buildPublicWebLiveDryRunRequest(): PublicWebResearchRequest {
  const sourceTag =
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG ||
    publicWebLiveDryRunFixture.sourceTag;
  return {
    sourceTag,
    queryPlan: [publicWebLiveDryRunFixture.query],
    roleTargets: [
      {
        role: publicWebLiveDryRunFixture.roleTarget,
        city: publicWebLiveDryRunFixture.city,
        criteria: [...publicWebLiveDryRunFixture.criteria],
      },
    ],
  };
}
