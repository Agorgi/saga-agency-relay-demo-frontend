# Railway Staging Deploy Checklist

## 1. Railway Project Setup

1. Create a new Railway project for staging.
2. Add this GitHub repo as the app service.
3. Use the repo defaults:
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Health check path: `/api/health`

## 2. Railway Postgres Setup

1. Add a Railway Postgres database to the same project.
2. In the app service variables, add/reference Postgres `DATABASE_URL`.
3. Confirm the app service, not just the Postgres service, can see `DATABASE_URL`.

## 3. Env Vars To Add

Required for staging demo mode:

```text
DATABASE_URL=<Railway Postgres reference variable>
ADMIN_PASSWORD=<strong staging password>
APP_BASE_URL=https://<railway-app-url>
INTERNAL_API_KEY=<strong random key>
MESSAGING_PROVIDER=MOCK
```

Optional:

```text
TWILIO_VALIDATE_WEBHOOKS=false
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
```

Leave Twilio values blank for no-SMS staging demos:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_PHONE_NUMBER=
TWILIO_CONVERSATIONS_SERVICE_SID=
```

## 4. Pre-Deploy Command

Set Railway pre-deploy command:

```bash
npm run prisma:deploy
```

Do not run seed as a pre-deploy command. Seed manually after the app and database are healthy.

## 5. Deploy

Deploy the app service. Railway should run:

```bash
npm install
npm run build
npm run prisma:deploy
npm run start
```

`postinstall` runs `prisma generate`, and the build creates Next.js standalone output.
Do not configure Railway to delete `.next` during build; Railpack may mount `.next/cache` as a build cache.

## 6. Health Check

Open:

```text
[APP_BASE_URL]/api/health
```

For staging demo mode, expect:

- `ok: true`
- `database: "connected"`
- `app.adminConfigured: true`
- `app.appBaseUrlConfigured: true`
- `llm.mode: "fallback"` if `OPENAI_API_KEY` is blank
- Twilio config booleans may be `false`
- `twilio.webhookValidationEnabled: false` when `TWILIO_VALIDATE_WEBHOOKS=false`

Twilio is not required for demo mode.

## 7. Seed Demo Data

Railway Postgres usually gives the app a private `DATABASE_URL` such as
`postgres.railway.internal`. That host is reachable from inside Railway's
network, not from a local Mac. Local `railway run ...` will inject the private
URL locally and DB-dependent commands may fail with `P1001`.

Run DB-dependent seed checks inside the Railway service container:

```bash
railway ssh
npm run prisma:seed
npm run test:seed-idempotency
```

If a staging-only public TCP proxy/Postgres URL is explicitly configured, these
commands may also run locally against that public staging URL. Prefer
`railway ssh` for private DB verification.

Do not use local `railway run` for DB-dependent checks when `DATABASE_URL`
points at `postgres.railway.internal`:

```bash
railway run npm run prisma:seed # likely P1001 from local machines with private DB URL
```

The seed script uses upserts for demo contacts, people, creator profiles, projects, role openings, opportunities, and interest checks. It refreshes only seed-tagged sample messages/audit rows for the sample brief, so it is safe to rerun in staging.

## 8. Run Demo QA

1. Open `[APP_BASE_URL]/admin`.
2. Sign in with `ADMIN_PASSWORD`.
3. Open `/admin/dev`.
4. Confirm the page shows `MOCK MODE` and `NO LIVE SMS`.
5. Click `Create full demo scenario`.
6. Confirm the required QA checklist shows `10/10 required complete` for project, roles, opportunities, recommendations, outreach, consent, mock conversation, kickoff, and tasks.
7. Confirm `Fake replies received` appears under optional diagnostics. It can remain pending without failing the staging baseline.
8. Use `Copy demo summary` and save it in the staging test notes.
9. If `APP_BASE_URL` and `INTERNAL_API_KEY` are available locally, run `npm run test:internal-api` as a black-box HTTP smoke test against staging. It does not need direct DB access.

## 9. If Something Fails

Capture:

- Railway deployment logs around install/build/pre-deploy/start.
- Railway runtime logs for the failing request.
- `/api/health` JSON output.
- The exact env vars present, with secrets redacted.
- Screenshot of `/admin/dev` checklist if demo QA fails.
- Browser console errors if an admin page fails.
- Prisma migration output if pre-deploy fails.
- Internal API smoke test output, with secrets redacted.

Do not connect the real Saga app, real Twilio SMS, WhatsApp, Apple Messages, payments, ticketing, RSVPs, or QR workflows during this staging demo.
