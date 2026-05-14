# Mock Saga App Integration Rehearsal

`npm run test:mock-app-integration` is a black-box rehearsal for the internal
Saga app API contract. It uses synthetic staging data only and calls HTTP routes
through `APP_BASE_URL` with `X-Saga-Internal-Key`.

## What This Proves

The rehearsal simulates the existing Saga app sending:

- fake app users
- fake community references
- fake relationship graph edges
- fake existing event references
- fake role openings
- fake opportunity interest

It verifies that:

- app user upsert returns safe `Person`/`CreatorProfile` data
- event import creates or updates a production-network `Project`
- relationship import creates graph edges for matching
- role openings can be created and published as opportunities
- deterministic recommendations are returned by project
- active opportunities can be listed
- app-user interest can be submitted for an opportunity
- ticketing, RSVP, QR, payment, ticket-sales, and event-publishing fields are not
  required by the rehearsal
- internal API responses do not expose those integration-owned fields

## What This Does Not Prove

This is not real Saga app integration. It does not:

- connect to the real Saga mobile app
- connect to `app.try-saga.com`
- read or write production Saga app data
- modify event publishing
- modify ticketing or ticket sales
- modify QR codes
- modify RSVP flows
- modify payment processing
- validate production Saga user permissions
- test Twilio or send SMS

## How To Run

Without env vars, the script skips safely:

```bash
npm run test:mock-app-integration
```

Against Railway staging:

```bash
APP_BASE_URL=https://your-staging-url \
INTERNAL_API_KEY=<paste manually> \
npm run test:mock-app-integration
```

Do not paste or log the internal key in reports.

## Engineering Review Before Real Integration

Before connecting the real Saga app, engineers should review:

- shared-key auth and whether it should be replaced with service-to-service auth
- route-level authorization for organizer/community ownership
- schema compatibility with real Saga user, event, community, and relationship ids
- migration safety against production-like data
- rate limits and abuse controls for internal routes
- safe response serializers and privacy boundaries
- whether ticketing, RSVP, QR, sales, payments, and permissions remain owned by
  the main Saga app

The rehearsal is intentionally limited to the production-network staffing loop:
users, creator profiles, projects, role openings, opportunities,
recommendations, relationships, and opportunity interest.
