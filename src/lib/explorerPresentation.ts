import type { CreativeProject, TalentRecommendation } from "@/types/sagaAgency";

const GENERIC_MATCH_PATTERNS = [
  /^Strong portfolio fit for /i,
  /^Saga ranks them highly for the /i,
];

export function getExplorerCardImage(candidate: TalentRecommendation) {
  return candidate.avatar || candidate.portfolioImages[0] || "/branding/saga-mark-cobalt.png";
}

export function getExplorerCandidateStatus(candidate: TalentRecommendation) {
  switch (candidate.candidateStatus) {
    case "shortlisted":
      return "Shortlist draft";
    case "saga-contacted":
      return "Outreach draft ready";
    case "replied":
      return "Reply simulated";
    case "negotiating":
      return "Terms draft";
    case "terms-ready":
      return "Needs approval";
    case "booked":
      return "Demo booking state";
    case "unavailable":
      return "Availability unconfirmed";
    case "passed":
      return "Set aside";
    case "suggested":
    default:
      return "Demo candidate — review first";
  }
}

export function getExplorerCandidateSummary(
  candidate: TalentRecommendation,
  project: CreativeProject | null,
) {
  const specificMatch = candidate.whySagaMatched.find(
    (reason) => !GENERIC_MATCH_PATTERNS.some((pattern) => pattern.test(reason)),
  );

  if (specificMatch) {
    return specificMatch;
  }

  if (project) {
    const cue = candidate.tags[0] || candidate.credits[0] || candidate.primaryRole;
    return `${candidate.name} could support ${project.title} with ${cue.toLowerCase()} cues in the work.`;
  }

  return `${candidate.name} is a demo candidate for ${candidate.primaryRole.toLowerCase()} review.`;
}
