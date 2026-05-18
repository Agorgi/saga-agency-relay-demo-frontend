# Deploy runbook

How to take changes from `main` to demo.try-saga.com without breaking it.

This document captures the post-merge operational steps. CI (`.github/workflows/ci.yml`) verifies code quality on every PR; the steps here are what happens *after* a PR merges to `main`.

## Deploy targets

| Target | Where | Auto-deployed by |
|---|---|---|
| Web app | https://demo.try-saga.com | Vercel — auto-deploys every push to `main` |
| Database | Neon (Postgres) | **Manual** — `prisma migrate deploy` |
| Env vars (runtime config) | Vercel project settings | **Manual** — Vercel dashboard |

## Standard deploy (no schema changes)

```bash
# 1. PR merges to main on GitHub
# 2. Vercel auto-deploys
# 3. Verify
curl -s https://demo.try-saga.com/api/health | jq .
```

`/api/health` should report `ok: true`, `database: connected`, and the expected `pilotStage`, `sms.providerMode`, etc. If `database: connected` is false after a deploy, see "Database mismatch" below.

## When a PR includes a Prisma migration

Schema changes (new tables, new columns) require running `prisma migrate deploy` against Neon **separately** — Vercel doesn't auto-apply migrations. If you skip this, the new Prisma client will expect columns that don't exist, and queries will throw.

### Steps

```bash
# 1. Make sure DATABASE_URL points at your production Neon DB and that
#    POSTGRES_URL_NON_POOLING is also set (Prisma requires both — direct
#    URL for migrations, pooled URL for runtime queries).
export DATABASE_URL="postgresql://...neon-pooled-url..."
export POSTGRES_URL_NON_POOLING="postgresql://...neon-direct-url..."

# 2. Apply pending migrations.
npx prisma migrate deploy

# 3. Verify the schema is now in sync.
curl -s https://demo.try-saga.com/api/health | jq .database
# should report "connected"
```

### Migrations in this repo

The current migration list lives under `prisma/migrations/`. Recently added (post-2026-05-17):

- `20260517100000_add_project_journey` — adds `ProjectJourney` table + `ProjectJourneyStep` enum. Required by PR #17 and downstream pages.
- `20260517110000_link_web_session_to_project` — adds `WebSession.projectId` column. Required by PR #18 (chat persistence of host briefs).

If either of these isn't applied to Neon and the corresponding code is live on Vercel, you'll see:
- Journey API routes (`/api/projects/[id]/journey*`) returning 500
- Chat API logs containing `persistBriefAndAdvanceJourney` errors (but the chat reply itself still works — the upsert is wrapped in try/catch)

## Runtime env vars that matter

Set in Vercel project settings → Environment Variables. Restart deployment after changes.

| Var | Current state | Action |
|---|---|---|
| `OPENAI_API_KEY` | Set | Keep set when flipping to live LLM mode |
| `OPENAI_MODEL` | Was `gpt-5.4-mini` (invalid) — code now defends with fallback to `gpt-4o-mini` | **Update to `gpt-4o-mini` or unset** so the warning stops firing |
| `LLM_ACTIVE_LIVE_DISABLED` | `true` (LLM gated off) | Flip to `false` only after structured-output reliability is verified |
| `ACTIVE_LIVE_ALLOWED` | `false` | Flip to `true` only after end-to-end pilot validation |
| `CONVERSATION_ENGINE_ACTIVE` | not set / `shadow` | Don't enable without A2P approval |
| `TWILIO_API_CALLS_FORBIDDEN` | `true` (SMS kill switch) | Leave on until A2P approval + design-partner consent is in place |
| `PUBLIC_BETA_ENABLED`, `PUBLIC_LAUNCH_ENABLED` | `false` | Leave off; design-partner phase only |
| `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` | Set | Required for runtime + migrations |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | unset | Optional. Set both to flip Sentry live (server + browser). When unset, SDK is a no-op and errors still flow through structured logs |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | unset | Optional. Set together at build time to upload source maps. Skip if you don't need readable stack traces in Sentry |
| `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | unset | Optional. Environment defaults to `VERCEL_ENV`; traces sample rate defaults to `0.1` |

See `.env.example` for the full list.

### Sentry observability runbook

**Wiring (already shipped in PR #33):**
- `@sentry/nextjs` installed and wired via `instrumentation.ts` + `sentry.{client,server,edge}.config.ts`.
- All Sentry init paths are gated on `SENTRY_DSN` — when unset, init returns immediately.
- `beforeSend` and `beforeBreadcrumb` run every event through `redactForLog()` (the same redactor `logServerError` uses), so emails / phones / OpenAI keys / Twilio SIDs / DB URLs are stripped before send.
- `src/lib/observability.ts` exports `captureServerError(action, error, ctx)` — the canonical server-error helper. It always writes a structured log line; it forwards to Sentry only when DSN is configured.
- `/api/health` reports `sentry.dsn_configured` (boolean), `sentry.environment`, `sentry.traces_sample_rate`. The DSN value itself is never returned.

**To flip Sentry live:**
1. Create a Sentry project (https://sentry.io). Get the server DSN and the client/browser DSN — usually the same value.
2. Set in Vercel:
   - `SENTRY_DSN` (server) — Production, Preview, Development as appropriate
   - `NEXT_PUBLIC_SENTRY_DSN` (browser) — same value as `SENTRY_DSN`
   - `SENTRY_ENVIRONMENT` — `production` / `preview` / `development`
   - Optional: `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`)
3. Optional, for source maps: also set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. The auth token is build-time only; treat it as a secret.
4. Redeploy. Check `/api/health` — `sentry.dsn_configured` should be `true`.
5. **Smoke test via `/api/admin/test-error`:** PR #41 added a deliberate-throw endpoint gated by `INTERNAL_API_KEY`. From your terminal:

   ```bash
   curl -X POST https://demo.try-saga.com/api/admin/test-error \
     -H "x-saga-internal-key: $INTERNAL_API_KEY" \
     -i
   ```

   Expect HTTP 500 + body:
   ```json
   {
     "error": "test_error",
     "message": "Deliberate error fired for Sentry verification.",
     "sentry_dsn_configured": true
   }
   ```

   Then open the Sentry dashboard. Within ~30 seconds you should see an event:
   - **Title:** `Error: admin test error — Sentry verification`
   - **Tags:** `action=admin_test_error`, `route=/api/admin/test-error`, `operation=sentry_verification`
   - **Payload:** stack frames should be present (PR #33's depth-12 fix preserves them); no email, phone, or DSN strings anywhere in the body.

   If the event doesn't appear: check `/api/health` is still reporting `sentry.dsn_configured: true`, verify the DSN was added for the right environment, and confirm the Sentry project hasn't been rate-limited.

**To roll back Sentry:**
- Unset `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel and redeploy. SDK becomes a no-op; structured logs continue working unchanged.

## Rollback playbook

Vercel keeps every deploy. To roll back the web app:
1. Go to Vercel dashboard → Deployments → find last good one
2. Click "Promote to Production"

Database rollback is trickier — Prisma migrations don't have automatic down-migrations. If a migration breaks production, the recovery path is:
1. Identify the broken migration
2. Either fix-forward (write a new migration that undoes the breaking change) — preferred
3. Or restore the Neon database from a recent automated backup (Neon retains 7 days by default)

Don't roll back a migration manually with `prisma migrate resolve` unless you've also rolled back the deployed code that uses the new schema.

## Pre-deploy checklist for any PR touching schema or env

Before merging a PR with a Prisma migration, verify:
- [ ] PR's local tests pass (CI green)
- [ ] Migration is **additive** (new columns / tables, not renames or drops) — see CLAUDE.md "Portability constraints"
- [ ] After merge, run `prisma migrate deploy` against Neon **before** the Vercel deploy lands, or accept a brief degradation window
- [ ] If the PR also touches env vars, update Vercel before code lands

For env-only changes (no migration), no extra steps — just update Vercel and the next deploy picks it up.

## Post-deploy verification

After every deploy, regardless of changes:

```bash
curl -s https://demo.try-saga.com/api/health | jq '{ok, database, sms: .sms.providerMode, llm: .llm.provider, pilot: .pilot.pilotStage}'
```

Expected output (current state):
```json
{
  "ok": true,
  "database": "connected",
  "sms": "MOCK",
  "llm": "fallback",
  "pilot": "internal_test"
}
```

If `database` is anything other than `"connected"`, a migration is missing or `DATABASE_URL` is wrong. Look at the latest Vercel deploy logs for Prisma errors.

If you flipped LLM live and `llm` is still `"fallback"`, the model preflight failed — check that `OPENAI_MODEL` is a real model string (not `gpt-5.4-mini`).

## QA pass after major changes

For anything that touches Sagasan, the journey state machine, or the brief/crew/candidate pages:

1. Spin up Cowork (browser-based QA agent) and walk through the **5-step Step 6 verification script** in `qa-reports/` (Cowork session — currently not committed):
   - Fresh session
   - Send the host opener
   - Send the bare-token reply ("LA")
   - Send the trust prompt ("don't you need more info?")
   - Send the rich follow-up ("150 people, photographer friend, $15k…")
   - Verify persona stays host, brief survives, no `/me?prefill=` route, journey advances to `brief_ready`

2. After confirmation, the `docs/open-issues.md` register should be updated to reflect any indirect closures (P1-OI-5, P1-OI-6 are most likely candidates).

## Things to never do during a deploy

(See CLAUDE.md "Never do" — these are the operational subset.)

- Never run `prisma migrate dev` against Neon. Use `prisma migrate deploy` only.
- Never push directly to `main`. Every change goes through PR → CI → merge.
- Never amend or force-push a commit on `main`. Revert with a new commit instead.
- Never flip `TWILIO_API_CALLS_FORBIDDEN`, `PUBLIC_BETA_ENABLED`, or `PUBLIC_LAUNCH_ENABLED` to enable real sends / launch without explicit user direction.
