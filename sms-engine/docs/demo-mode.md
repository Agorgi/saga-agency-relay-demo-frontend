# Demo Mode

Demo mode proves the production-network loop without live SMS, WhatsApp, Apple Messages, or provider approval.

Open:

```text
/admin/dev
```

The page is labeled `MOCK MODE` and `NO LIVE SMS`. It uses `MockMessagingProvider`, stores mock outbound messages in the database, and never sends real provider traffic.

## Demo Flows

### Organizer Intake

Enter a fake organizer phone and text idea. Saga runs the same intake logic used by SMS, stores inbound/outbound messages, updates `ProjectBrief`, and bridges to canonical `Project` when the brief is ready.

### Creator Onboarding

Enter a fake creator phone and a message such as:

```text
I'm a photographer in LA looking for paid anime and cosplay gigs. https://example.com/me
```

Saga creates or updates `Person` and `CreatorProfile`, then marks the profile `PENDING_REVIEW`.

### Existing Saga Event Import Mock

Create/import a mock event into `Project`, then generate role openings and opportunities.

### Interest Check

Create an `InterestCheck`, increment interest, and convert it into a `Project` once the threshold is met.

### Matching

Run deterministic matching for an opportunity. Candidate recommendations show score, score breakdown, proximity tier, matching reasons, and risks.

### Mock Outreach and Replies

Admin-selected recommendations can receive mock outreach. Fake contacts can reply `YES`, `NO`, `MAYBE`, or explicit consent. Consent is required before mock group formation.

### Mock Group Conversation

Select interested/consented candidates and create a mock production conversation. Saga creates a kickoff audit entry and starter tasks.

## Repeatable QA Tools

The top of `/admin/dev` includes:

- `Create full demo scenario`: seeds a full local mock scenario with organizer intake, creator profiles, role openings, opportunities, recommendations, consented candidates, mock conversation, kickoff, and tasks.
- `Reset demo data`: development-only cleanup for fake demo records.
- `Copy demo summary`: copies a plain-English run summary.
- Required QA checklist: shows whether the required staging baseline stages are
  complete. The baseline passes when all required checks are complete.
- Optional diagnostics: shows useful deeper checks, such as fake reply
  simulation. A pending optional diagnostic does not invalidate the staging
  baseline.

`Fake replies received` is diagnostic-only. It is useful for testing contact
reply classification and consent flows separately, but it is not required for a
healthy no-SMS staging baseline.

## What Remains Mocked

- Provider delivery and provider failure behavior.
- Real app user graph imports.
- Real event/ticket/RSVP state.
- Real app chat.
- Real outcome/reliability feedback after production.

## What Is Real

- Prisma schema and relationships.
- Database writes.
- Intake workflow.
- Bridge creation from legacy SMS to canonical network objects.
- Deterministic matching and score breakdown.
- Human-approved workflow structure.
- Audit logging.
- Internal API contract shape.
