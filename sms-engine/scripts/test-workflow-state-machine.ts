import {
  assertCandidateRecommendationStatusTransition,
  assertGroupChatStatusTransition,
  assertInterestCheckStatusTransition,
  assertOpportunityStatusTransition,
  assertOutreachStatusTransition,
  assertProjectBriefStatusTransition,
  WorkflowTransitionError,
} from "@/lib/workflowStateMachine";

function expectPass(name: string, run: () => void) {
  run();
  console.log(`PASS ${name}`);
}

function expectFail(name: string, run: () => void) {
  try {
    run();
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      console.log(`PASS ${name}`);
      return;
    }
    throw error;
  }
  throw new Error(`Expected workflow transition to fail: ${name}`);
}

expectPass("project brief can progress through intake", () => {
  assertProjectBriefStatusTransition("NEW_INBOUND", "INTAKE_IN_PROGRESS");
  assertProjectBriefStatusTransition(
    "INTAKE_IN_PROGRESS",
    "BRIEF_READY_FOR_REVIEW",
  );
});

expectPass("admin-approved outreach can be sent", () => {
  assertOutreachStatusTransition("DRAFTED", "SENT", {
    adminApproved: true,
    hasMessage: true,
  });
});

expectFail("mock outreach cannot bypass approval", () => {
  assertOutreachStatusTransition("DRAFTED", "SENT", {
    adminApproved: false,
    hasMessage: true,
  });
});

expectPass("candidate can move from contacted to interested", () => {
  assertCandidateRecommendationStatusTransition("CONTACTED", "INTERESTED");
});

expectFail("candidate cannot be added to team without consent", () => {
  assertCandidateRecommendationStatusTransition("SHORTLISTED", "ADDED_TO_TEAM", {
    humanApproved: true,
    hasExplicitConsent: false,
    hasConfirmedTeamMember: true,
  });
});

expectPass("candidate can be added to team with approval and consent", () => {
  assertCandidateRecommendationStatusTransition("SHORTLISTED", "ADDED_TO_TEAM", {
    humanApproved: true,
    hasExplicitConsent: true,
    hasConfirmedTeamMember: true,
  });
});

expectFail("group conversation cannot activate without participants", () => {
  assertGroupChatStatusTransition("DRAFT", "ACTIVE", { participantCount: 1 });
});

expectPass("group conversation can activate with organizer and participant", () => {
  assertGroupChatStatusTransition("DRAFT", "ACTIVE", { participantCount: 2 });
});

expectFail("opportunity cannot be filled without confirmed team member", () => {
  assertOpportunityStatusTransition("ACTIVE", "FILLED", {
    hasConfirmedTeamMember: false,
  });
});

expectPass("opportunity can be filled after confirmed team member", () => {
  assertOpportunityStatusTransition("ACTIVE", "FILLED", {
    hasConfirmedTeamMember: true,
  });
});

expectFail("interest check cannot convert twice", () => {
  assertInterestCheckStatusTransition("THRESHOLD_MET", "CONVERTED_TO_PROJECT", {
    convertedProjectId: "existing-project",
  });
});

expectPass("threshold-met interest check can convert once", () => {
  assertInterestCheckStatusTransition("THRESHOLD_MET", "CONVERTED_TO_PROJECT", {
    convertedProjectId: null,
  });
});

console.log("Workflow state-machine checks passed.");
