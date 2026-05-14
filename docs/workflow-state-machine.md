# Workflow State Machine

Saga uses explicit backend-owned workflow transitions. The LLM may help extract fields, draft copy, suggest roles, summarize shortlists, or suggest tasks, but it does not decide durable state.

The central transition guard lives in `src/lib/workflowStateMachine.ts`. It provides small assertion functions for each status family and a shared `WorkflowTransitionError` for safe failures.

## Key States

Legacy SMS intake:

- `ProjectBrief`: `NEW_INBOUND`, `INTAKE_IN_PROGRESS`, `BRIEF_READY_FOR_REVIEW`, `ROLE_MAPPING_READY`, `OUTREACH_DRAFTED`, `OUTREACH_IN_PROGRESS`, `SHORTLIST_READY`, `SHORTLIST_SENT`, `GROUPCHAT_PENDING`, `GROUPCHAT_ACTIVE`, `PRODUCTION_IN_PROGRESS`, `NEEDS_ADMIN`, `ARCHIVED`.
- `Outreach`: `DRAFTED`, `SENT`, `INTERESTED`, `NOT_INTERESTED`, `MAYBE`, `NO_RESPONSE`, `APPROVED_FOR_GROUPCHAT`.
- `GroupChat`: `DRAFT`, `ACTIVE`, `ARCHIVED`.

Production-network core:

- `Project`: `INTAKE`, `BRIEF_READY`, `ROLE_MAPPING`, `RECRUITING`, `SHORTLIST_READY`, `TEAM_FORMING`, `IN_PRODUCTION`, `NEEDS_ADMIN`, `ARCHIVED`.
- `RoleOpening`: `DRAFT`, `OPEN`, `RECOMMENDING`, `OUTREACHING`, `FILLED`, `ARCHIVED`.
- `Opportunity`: `DRAFT`, `ACTIVE`, `PAUSED`, `FILLED`, `ARCHIVED`.
- `CandidateRecommendation`: `SUGGESTED`, `APPROVED`,
  `APPROVED_FOR_SHORTLIST`, `NEEDS_MORE_INFO`, `CONTACT_LATER`,
  `DO_NOT_CONTACT`, `CONTACTED`, `INTERESTED`, `DECLINED`, `SHORTLISTED`,
  `ADDED_TO_TEAM`, `REJECTED`.
- `Team`: `FORMING`, `ACTIVE`, `COMPLETED`, `ARCHIVED`.
- `TeamMember`: `INVITED`, `INTERESTED`, `CONFIRMED`, `REMOVED`.
- `ProductionConversation`: `DRAFT`, `ACTIVE`, `ARCHIVED`.
- `InterestCheck`: `DRAFT`, `ACTIVE`, `THRESHOLD_MET`, `CONVERTED_TO_PROJECT`, `ARCHIVED`.
- `Task`: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`.

## Safety Rules

Important guarded rules:

- Outreach cannot become `SENT` unless an admin-approved send path supplies a message body.
- Outreach cannot become `APPROVED_FOR_GROUPCHAT` without explicit group-chat consent.
- A candidate cannot become `CONTACTED` without human approval.
- `APPROVED_FOR_SHORTLIST` means internal shortlist-packet eligibility only; it
  does not authorize outreach, SMS, or group-chat creation.
- `DO_NOT_CONTACT` candidates should not be surfaced for outreach.
- A candidate cannot become `SHORTLISTED` without consent.
- A candidate cannot become `ADDED_TO_TEAM` without human approval, explicit consent, and a confirmed team member.
- A `GroupChat` or `ProductionConversation` cannot become `ACTIVE` without at least two participants.
- A `Team` cannot become `ACTIVE` without at least one confirmed member.
- A `TeamMember` cannot become `CONFIRMED` without human approval and explicit consent.
- A `RoleOpening` or `Opportunity` cannot become `FILLED` without a confirmed team member.
- An `InterestCheck` cannot be converted twice. Existing conversion calls return the existing project id rather than creating another project.

## Human Approval Points

Human approval is required for:

- Sending outreach.
- Sending organizer shortlists.
- Creating live or mock group conversations.
- Confirming team placement.
- Resolving `NEEDS_ADMIN`.
- Any risky, unclear, money/legal/safety-related case.

## What AI Cannot Decide

The AI cannot:

- Override workflow transitions.
- Approve or send outreach.
- Confirm group-chat consent.
- Add people to teams.
- Mark an opportunity or role as filled.
- Resolve escalations.
- Promise booking, payment, rates, venue access, ticket sales, revenue, celebrity/influencer participation, or attendance.

## Tests

`npm run test:workflow` verifies valid and invalid transition behavior. It is included in `npm run test:staging-baseline` and does not require a database, Railway, Twilio, OpenAI, or the internal Saga app.
