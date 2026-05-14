# Internal Saga API Contract

The internal API is for the existing Saga mobile and desktop apps to integrate later. It is not connected to production Saga yet.

All routes require:

```http
X-Saga-Internal-Key: <INTERNAL_API_KEY>
Content-Type: application/json
```

Missing or invalid keys return `401`. Request bodies are validated with Zod. Responses intentionally avoid private notes, admin notes, raw private contact data, ticketing state mutation, payment state mutation, and booking promises.

## Endpoints

### POST `/api/internal/saga/users/upsert`

Creates or updates a `Person` by `sagaUserId`. Optionally creates or updates `CreatorProfile`.

Example: `docs/examples/internal-api/upsert-user.json`

### POST `/api/internal/saga/events/import`

Imports or upserts an existing Saga event into canonical `Project` by `existingSagaEventId`.

This does not modify tickets, RSVPs, QR codes, event sales, or payments.

Example: `docs/examples/internal-api/import-event.json`

### POST `/api/internal/saga/projects/:projectId/role-openings`

Creates or updates role openings for an imported project. If `publish=true`, each role opening gets an active `Opportunity`.

Example: `docs/examples/internal-api/create-role-openings.json`

### GET `/api/internal/saga/projects/:projectId/recommendations`

Runs deterministic proximity-first matching for each role opening in a project and returns recommendations grouped by role opening.

Returned candidate data includes:

- total score
- score breakdown
- proximity tier
- matching reasons
- risks
- safe public profile fields

It does not expose `CreatorProfile.internalNotes`.

### GET `/api/internal/saga/opportunities`

Lists active opportunities safe to show in the existing Saga app.

Query params:

- `city`
- `fandom`
- `role`
- `personId`
- `sagaUserId`

### POST `/api/internal/saga/opportunities/:opportunityId/interest`

Records interest from an app user or person. It creates or updates a `CandidateRecommendation` to `INTERESTED`.

It does not auto-add anyone to a team.

Example: `docs/examples/internal-api/opportunity-interest.json`

### POST `/api/internal/saga/relationships/import`

Imports relationship edges by Saga app user IDs.

Supported types:

- `FRIEND`
- `MUTUAL`
- `SAME_COMMUNITY`
- `ATTENDED_SAME_EVENT`
- `COLLABORATED`
- `FOLLOWING`
- `IMPORTED_CONNECTION`

Example: `docs/examples/internal-api/import-relationships.json`

### POST `/api/internal/saga/interest-checks`

Creates an `InterestCheck` from the app or a later messaging flow.

Example: `docs/examples/internal-api/create-interest-check.json`

### POST `/api/internal/saga/interest-checks/:id/interest`

Records interest in an interest check. The route attempts idempotency by audit log for a repeated `personId` or `sagaUserId`.

If the threshold is met, status becomes `THRESHOLD_MET`. The route does not convert automatically unless `autoConvert=true` is provided.

### POST `/api/internal/saga/interest-checks/:id/convert`

Converts an interest check into a canonical `Project`, generates suggested role openings, links `convertedProjectId`, and returns a safe project summary.

## Testing

Run:

```bash
npm run test:internal-api
```

The script is a black-box HTTP smoke test. It calls the deployed app using
`APP_BASE_URL` and the `X-Saga-Internal-Key` header from `INTERNAL_API_KEY`.
It creates fake staging records through API routes only and does not open Prisma
or require direct database access. If `APP_BASE_URL` or `INTERNAL_API_KEY` is
missing, it exits successfully with a skip message.
