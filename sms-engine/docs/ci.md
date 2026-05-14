# CI Guardrails

GitHub Actions runs `.github/workflows/ci.yml` on every pull request and every push to `main`.

## What CI Runs

The workflow uses Node.js 20 and npm. It does not require Railway, Twilio, OpenAI, a database URL, or an internal API key.

CI commands:

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm run build
npm run test:staging-baseline
npm run test:twilio-readiness
npm run test:ai-evals
```

`test:staging-baseline` includes:

- security/privacy hardening checks
- workflow state-machine checks
- producer agent deterministic fallback checks
- deterministic matching checks
- demo-flow checks that skip database-backed sections when `DATABASE_URL` is missing

`test:staging-baseline` is a composed npm command, not a standalone
`scripts/test-staging-baseline.ts` file.

`test:twilio-readiness` uses fake fixtures only. It does not configure Twilio and cannot send real SMS.

`test:ai-evals` runs deterministic fallback AI reliability evals without `OPENAI_API_KEY`.

## What CI Does Not Run

CI does not run DB-dependent staging checks that need direct access to Railway Postgres:

- `npm run prisma:seed`
- `npm run test:seed-idempotency`

CI also does not run remote deployed-app smoke checks:

- `npm run test:internal-api`
- `npm run test:mock-app-integration`

`test:internal-api` is API-only and can run from a local machine when `APP_BASE_URL` and `INTERNAL_API_KEY` are provided, but those values are intentionally not configured in general CI.
`test:mock-app-integration` follows the same pattern for a synthetic app
integration rehearsal.

## Railway Staging Checks

Run these after a Railway staging deploy:

```bash
npm run prisma:seed
npm run test:seed-idempotency
```

If Railway Postgres uses `postgres.railway.internal`, run DB-dependent commands from inside the Railway service container or through a staging-only public TCP proxy. Local `railway run` may inject private-network database URLs that are not reachable from a local machine.

For the remote internal API smoke test, run:

```bash
APP_BASE_URL="https://your-staging-url" INTERNAL_API_KEY="..." npm run test:internal-api
```

Do not paste or store secrets in logs, docs, or GitHub workflow files.

## Interpreting Failures

- `npm ci`: dependency or lockfile mismatch.
- `npx prisma generate`: Prisma schema/client generation issue.
- `npm run lint`: style or static analysis issue.
- `npm run typecheck`: TypeScript contract issue.
- `npm run build`: Next.js production build issue.
- `npm run test:staging-baseline`: regression in security, workflow state-machine, producer-agent fallback, matching, or demo-flow behavior.
- `npm run test:twilio-readiness`: webhook/provider safety regression. This still does not mean live SMS is approved or enabled.
- `npm run test:ai-evals`: AI/fallback safety regression that should be reviewed before live user testing.

CI passing means the repo is safe to build and the no-SMS guardrails still pass. It does not approve live Twilio, connect the real Saga app, or validate production database migrations against real user data.
