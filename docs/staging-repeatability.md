# Staging Repeatability Test

`npm run test:staging-repeatability` stresses the staging/mock workflow for
repeatability. It is not a scale test and it does not enable live providers.

## What It Tests

The suite verifies:

- full demo scenario creation can run multiple times
- the demo scenario reuses the same canonical `Project` and `ProjectBrief`
- `/admin/dev` checklist logic remains scoped to `evt_demo_full_scenario`
- required demo checks remain complete even if optional diagnostics, such as
  fake replies, are pending
- unrelated staging projects do not change the scoped demo checklist
- matching can run repeatedly without duplicating candidate recommendations
- interest check conversion is idempotent
- seed idempotency still passes when `DATABASE_URL` is available
- the remote internal API smoke flow can run more than once when
  `APP_BASE_URL` and `INTERNAL_API_KEY` are available

The suite allows bounded append-only growth for operator artifacts that are
expected to record each run, such as mock production conversations, tasks, and
audit logs.

## Local Usage

Without a database:

```bash
npm run test:staging-repeatability
```

The DB-backed checks skip safely when `DATABASE_URL` is missing. The local
non-DB checks still verify deterministic reply classification and safe fallback
behavior.

With local Postgres:

```bash
npm run db:up
cp .env.local.example .env
npm run prisma:deploy
npm run prisma:seed
npm run test:staging-repeatability
```

## Railway Staging Usage

Because Railway Postgres commonly uses the private
`postgres.railway.internal` host, DB-backed checks should run inside the Railway
service container or against an explicitly configured staging-only public TCP
proxy.

Preferred:

```bash
railway ssh
npm run test:staging-repeatability
```

Remote internal API repeatability can run from a local machine if these are set:

```bash
APP_BASE_URL=https://your-staging-url
INTERNAL_API_KEY=<paste manually>
npm run test:staging-repeatability
```

Do not paste or log the internal key in issue reports.

## Expected Runtime

Without DB or remote API credentials, the suite should finish in a few seconds.
With a database and seed idempotency enabled, expect roughly one to two minutes
depending on Railway and Prisma startup time.

## What Failures Mean

- Duplicate canonical demo `Project` or `ProjectBrief`: the demo scenario is no
  longer safely upserting its canonical records.
- Demo checklist failure after an unrelated project: `/admin/dev` is likely
  evaluating the wrong project.
- Recommendation count growth between matching runs: deterministic matching is
  creating duplicates instead of updating existing recommendations.
- Interest check conversion mismatch: conversion is no longer idempotent.
- Seed idempotency failure: staging seed data may duplicate records on rerun.

This suite must remain MOCK-only. It must not require Twilio, OpenAI, real Saga
app data, ticketing, RSVPs, QR codes, event publishing, sales, or payments.
