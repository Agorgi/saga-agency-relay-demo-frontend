import {
  sourcingPlanSchema,
  type ProjectUnderstanding,
  type RoleMap,
  type SourcingPlan,
} from "@/sms-engine/producer/producerAgentTypes";

export function buildSourcingPlan(
  understanding: ProjectUnderstanding,
  roleMap: RoleMap,
): SourcingPlan {
  const allRoles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  const riskNotes = [
    ...understanding.riskFlags.map(
      (flag) => `Human review required for risk flag: ${flag}.`,
    ),
  ];

  if (understanding.sourceKind !== "organizer_project") {
    riskNotes.push("Do not source candidates until this is a reviewed project brief.");
  }

  return sourcingPlanSchema.parse({
    searchOrder: [
      "friends/direct connections",
      "mutuals",
      "same community",
      "prior attendees/collaborators",
      "local approved creator profiles",
      "broader internal contacts",
      "open web research later",
    ],
    perRoleSearchCriteria: Object.fromEntries(
      allRoles.map((role) => [
        role.roleType,
        {
          roleType: role.roleType,
          skills: role.requiredSkills,
          fandoms: role.preferredFandoms,
          location: role.localRequired ? understanding.city : null,
          localRequired: role.localRequired,
          reviewStatusPreference: "APPROVED preferred; PENDING_REVIEW requires admin review.",
        },
      ]),
    ),
    proximityPriority: [
      "friend",
      "mutual",
      "same community",
      "local",
      "internal approved profile",
      "broader internal contact",
    ],
    fandomFitCriteria: understanding.fandoms,
    locationFitCriteria: understanding.city
      ? [`Prefer ${understanding.city}`, "Remote only when role allows it"]
      : ["Ask for location before local sourcing"],
    riskNotes,
    humanReviewRequired:
      roleMap.humanReviewRequired ||
      understanding.riskFlags.length > 0 ||
      understanding.sourceKind !== "organizer_project",
    openWebResearchLater: true,
    explanationForAudit: [
      "Internal database first; no public web research is performed.",
      "Candidate outreach remains admin-approved and non-autonomous.",
    ],
  });
}
