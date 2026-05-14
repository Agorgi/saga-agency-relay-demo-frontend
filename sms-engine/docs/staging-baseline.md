# Saga Producer MVP Staging Baseline v0.1

Frozen on: May 7, 2026

Final freeze commit: `3477ddc509ba727f866db43db9488eba94526081`

Authoritative v0.1 freeze tag: `staging-v0.1-final`

The earlier `staging-v0.1` tag is superseded and should not be used as the
source of truth for the corrected v0.1 staging freeze.

Final QA-passed application commit before freeze documentation: `8acbd5a`

## Staging Status

- Railway staging is healthy.
- `/api/health` returns `200`.
- Database status: connected.
- Messaging mode: `MESSAGING_PROVIDER=MOCK`.
- Twilio: unconfigured for this baseline.
- OpenAI: optional; fallback mode is supported.
- Existing Saga mobile/web app: not connected.
- Production Saga data: not connected.

Expected `/api/health` shape for staging demo mode:

```json
{
  "ok": true,
  "database": "connected",
  "twilio": {
    "accountSidConfigured": false,
    "authTokenConfigured": false,
    "messagingConfigured": false,
    "conversationsConfigured": false,
    "webhookValidationEnabled": false,
    "forcedProvider": "MOCK"
  },
  "llm": {
    "configured": false,
    "mode": "fallback"
  },
  "app": {
    "adminConfigured": true,
    "appBaseUrlConfigured": true,
    "demoModeAvailable": true
  }
}
```

`ok` is based on database connectivity and core app configuration. Twilio and
OpenAI are not required for no-SMS staging demo mode.

## Verified Checks

Passed in Railway staging:

- `prisma:seed`
- `test:seed-idempotency`
- `test:internal-api`
- `/admin` loads.
- `/admin/dev` full mock demo QA reaches `10/10 required complete`.
- Optional diagnostics, such as `Fake replies received`, may remain pending
  without invalidating the staging baseline.

Verified admin surfaces:

- `/admin`
- `/admin/projects`
- `/admin/projects/[id]`
- `/admin/contacts`
- `/admin/outreach`
- `/admin/groupchats`
- `/admin/tasks`
- `/admin/dev`
- `/admin/people`
- `/admin/creator-profiles`
- `/admin/network-projects`
- `/admin/role-openings`
- `/admin/opportunities`
- `/admin/interest-checks`
- `/admin/recommendations`
- `/admin/relationships`
- `/admin/audit`

## Demo Lab Scope

The `/admin/dev` required checklist is scoped to the dedicated full demo scenario:
`evt_demo_full_scenario` / `Demo Anime Rave LA`. It should not evaluate the most
recently updated project globally. Internal API smoke tests may create separate
staging projects such as `evt_internal_*`; those records are expected and should
not change the demo QA checklist result.

`Fake replies received` is now an optional diagnostic, not a required baseline
check. It is useful when testing contact reply classification, but a pending
fake-reply diagnostic should not be reported as a failed staging baseline.

Known non-bug: Chrome DevTools may label some Server Action redirect POSTs as
`503`. If the user-facing state advances, the checklist updates, and no error
banner appears, this is treated as a redirect/devtools artifact rather than a
staging blocker.

## Railway Verification Notes

`npm run test:internal-api` is a black-box HTTP smoke test. It calls the
deployed app at `APP_BASE_URL` with `X-Saga-Internal-Key`, creates fake staging
records through API routes only, and does not need direct database access. It
skips safely if `APP_BASE_URL` or `INTERNAL_API_KEY` is missing.

DB-dependent staging checks need Railway private-network access. If
`DATABASE_URL` uses `postgres.railway.internal`, local `railway run ...` injects
the private URL into your Mac shell, but your Mac cannot reach that hostname.
Run DB-dependent checks inside the Railway service container instead:

```bash
railway ssh
npm run prisma:seed
npm run test:seed-idempotency
```

Alternatively, use a staging-only public TCP proxy/Postgres URL if one is
explicitly configured. Prefer `railway ssh` for private DB verification.

The seed command is intended for local/staging demo databases. It should not be
run against production data unless a professional engineer explicitly approves
that use.

## Scope Boundary

This baseline does not include live Twilio, real SMS, WhatsApp, Apple Messages,
the live Saga app integration, ticketing, RSVPs, QR codes, event publishing,
ticket sales, payments, bookings, or production Saga data.
