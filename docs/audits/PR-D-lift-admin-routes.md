# PR-D Audit — Lift Admin Routes To Top-Level

**Date:** 2026-05-14  
**Branch:** `feature/web-chat/pr-d-lift-admin-routes`  
**Result:** PASS

## Scope

PR-D lifts the remaining route code from `sms-engine/src/app/**` into the main app at `src/app/**`, lifts admin-only UI from `sms-engine/src/components/**` into `src/components/admin/**`, removes the old nested-app exclusions from root TypeScript and ESLint config, and leaves the engine library under `src/sms-engine/**` untouched. The public relay-demo routes remain the primary `/` app, while the lifted admin and beta routes now run as part of the same Next.js App Router tree.

## Step 0 Inventory (verbatim)

### 1. `find sms-engine/src -maxdepth 4 -type d | sort`

```text
sms-engine/src
sms-engine/src/app
sms-engine/src/app/admin
sms-engine/src/app/admin/(dashboard)
sms-engine/src/app/admin/(dashboard)/access
sms-engine/src/app/admin/(dashboard)/audit
sms-engine/src/app/admin/(dashboard)/beta-simulations
sms-engine/src/app/admin/(dashboard)/candidate-graph
sms-engine/src/app/admin/(dashboard)/command-center
sms-engine/src/app/admin/(dashboard)/contacts
sms-engine/src/app/admin/(dashboard)/creator-profiles
sms-engine/src/app/admin/(dashboard)/data-ops
sms-engine/src/app/admin/(dashboard)/dev
sms-engine/src/app/admin/(dashboard)/groupchats
sms-engine/src/app/admin/(dashboard)/interest-checks
sms-engine/src/app/admin/(dashboard)/launch-drill
sms-engine/src/app/admin/(dashboard)/llm-review
sms-engine/src/app/admin/(dashboard)/matching
sms-engine/src/app/admin/(dashboard)/matching-evaluation
sms-engine/src/app/admin/(dashboard)/needs-attention
sms-engine/src/app/admin/(dashboard)/network-projects
sms-engine/src/app/admin/(dashboard)/observability
sms-engine/src/app/admin/(dashboard)/opportunities
sms-engine/src/app/admin/(dashboard)/outbound-drafts
sms-engine/src/app/admin/(dashboard)/outreach
sms-engine/src/app/admin/(dashboard)/people
sms-engine/src/app/admin/(dashboard)/pilot
sms-engine/src/app/admin/(dashboard)/pilot-feedback
sms-engine/src/app/admin/(dashboard)/pilot-participants
sms-engine/src/app/admin/(dashboard)/pipeline
sms-engine/src/app/admin/(dashboard)/projects
sms-engine/src/app/admin/(dashboard)/public-beta
sms-engine/src/app/admin/(dashboard)/recommendations
sms-engine/src/app/admin/(dashboard)/relationships
sms-engine/src/app/admin/(dashboard)/role-openings
sms-engine/src/app/admin/(dashboard)/sourcing
sms-engine/src/app/admin/(dashboard)/sourcing-quality
sms-engine/src/app/admin/(dashboard)/tasks
sms-engine/src/app/admin/(dashboard)/transcript-dry-runs
sms-engine/src/app/api
sms-engine/src/app/api/health
sms-engine/src/app/api/internal
sms-engine/src/app/api/internal/saga
sms-engine/src/app/api/twilio
sms-engine/src/app/api/twilio/conversations-webhook
sms-engine/src/app/api/twilio/inbound
sms-engine/src/app/api/twilio/status
sms-engine/src/app/beta
sms-engine/src/components
sms-engine/src/components/admin
```

### 2. `find sms-engine/src/app -name 'page.tsx' -o -name 'route.ts' -o -name 'layout.tsx' -o -name 'loading.tsx' -o -name 'error.tsx' | sort`

```text
sms-engine/src/app/admin/(dashboard)/access/page.tsx
sms-engine/src/app/admin/(dashboard)/audit/page.tsx
sms-engine/src/app/admin/(dashboard)/beta-simulations/page.tsx
sms-engine/src/app/admin/(dashboard)/candidate-graph/page.tsx
sms-engine/src/app/admin/(dashboard)/command-center/page.tsx
sms-engine/src/app/admin/(dashboard)/contacts/page.tsx
sms-engine/src/app/admin/(dashboard)/creator-profiles/page.tsx
sms-engine/src/app/admin/(dashboard)/data-ops/page.tsx
sms-engine/src/app/admin/(dashboard)/dev/page.tsx
sms-engine/src/app/admin/(dashboard)/groupchats/page.tsx
sms-engine/src/app/admin/(dashboard)/interest-checks/page.tsx
sms-engine/src/app/admin/(dashboard)/launch-drill/page.tsx
sms-engine/src/app/admin/(dashboard)/layout.tsx
sms-engine/src/app/admin/(dashboard)/llm-review/page.tsx
sms-engine/src/app/admin/(dashboard)/matching-evaluation/page.tsx
sms-engine/src/app/admin/(dashboard)/matching/page.tsx
sms-engine/src/app/admin/(dashboard)/needs-attention/page.tsx
sms-engine/src/app/admin/(dashboard)/network-projects/[id]/page.tsx
sms-engine/src/app/admin/(dashboard)/network-projects/page.tsx
sms-engine/src/app/admin/(dashboard)/observability/page.tsx
sms-engine/src/app/admin/(dashboard)/opportunities/page.tsx
sms-engine/src/app/admin/(dashboard)/outbound-drafts/page.tsx
sms-engine/src/app/admin/(dashboard)/outreach/page.tsx
sms-engine/src/app/admin/(dashboard)/people/page.tsx
sms-engine/src/app/admin/(dashboard)/pilot-feedback/page.tsx
sms-engine/src/app/admin/(dashboard)/pilot-participants/page.tsx
sms-engine/src/app/admin/(dashboard)/pilot/page.tsx
sms-engine/src/app/admin/(dashboard)/pipeline/page.tsx
sms-engine/src/app/admin/(dashboard)/projects/[id]/page.tsx
sms-engine/src/app/admin/(dashboard)/projects/page.tsx
sms-engine/src/app/admin/(dashboard)/public-beta/page.tsx
sms-engine/src/app/admin/(dashboard)/recommendations/page.tsx
sms-engine/src/app/admin/(dashboard)/relationships/page.tsx
sms-engine/src/app/admin/(dashboard)/role-openings/page.tsx
sms-engine/src/app/admin/(dashboard)/sourcing-quality/page.tsx
sms-engine/src/app/admin/(dashboard)/sourcing/page.tsx
sms-engine/src/app/admin/(dashboard)/sourcing/public-web-review/page.tsx
sms-engine/src/app/admin/(dashboard)/sourcing/public-web/page.tsx
sms-engine/src/app/admin/(dashboard)/tasks/page.tsx
sms-engine/src/app/admin/(dashboard)/transcript-dry-runs/page.tsx
sms-engine/src/app/admin/page.tsx
sms-engine/src/app/api/health/route.ts
sms-engine/src/app/api/internal/saga/events/import/route.ts
sms-engine/src/app/api/internal/saga/interest-checks/[id]/convert/route.ts
sms-engine/src/app/api/internal/saga/interest-checks/[id]/interest/route.ts
sms-engine/src/app/api/internal/saga/interest-checks/route.ts
sms-engine/src/app/api/internal/saga/opportunities/[opportunityId]/interest/route.ts
sms-engine/src/app/api/internal/saga/opportunities/route.ts
sms-engine/src/app/api/internal/saga/projects/[projectId]/recommendations/route.ts
sms-engine/src/app/api/internal/saga/projects/[projectId]/role-openings/route.ts
sms-engine/src/app/api/internal/saga/relationships/import/route.ts
sms-engine/src/app/api/internal/saga/users/upsert/route.ts
sms-engine/src/app/api/twilio/conversations-webhook/route.ts
sms-engine/src/app/api/twilio/inbound/route.ts
sms-engine/src/app/api/twilio/status/route.ts
sms-engine/src/app/beta/page.tsx
sms-engine/src/app/layout.tsx
sms-engine/src/app/page.tsx
```

### 3. `find sms-engine/src -maxdepth 3 -type f -name '*.tsx' -not -path '*/app/*' -not -path '*/lib/*' | head -50`

```text
sms-engine/src/components/admin/AdminShell.tsx
sms-engine/src/components/admin/DemoSummaryButton.tsx
sms-engine/src/components/admin/MessageThread.tsx
sms-engine/src/components/admin/AdminSidebar.tsx
sms-engine/src/components/admin/AdminPageHeader.tsx
sms-engine/src/components/admin/StatusBadge.tsx
sms-engine/src/components/admin/ContactsImportForm.tsx
sms-engine/src/components/admin/AdminBreadcrumbs.tsx
```

### 4. `ls sms-engine/src/`

```text
app
components
```

### 5. `grep -rln "from '@/components/admin'" sms-engine/src | head -20`

```text
(plain grep returned no matches; later `rg -n "@/components/admin/" sms-engine/src` confirmed multiple admin-route imports using that alias form)
```

### 6. `cat src/app/layout.tsx | head -40`

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Saga — The AI Talent Agency for Creative Production",
  description: "Describe the project. Saga finds the team, relays outreach privately by text, turns replies into terms, and manages the booking workflow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

### 7. `find src/app -maxdepth 2 -type d | sort`

```text
src/app
src/app/create
src/app/events
src/app/events/[slug]
src/app/explore
src/app/feed
src/app/my-events
src/app/post-project
src/app/profile
src/app/projects
src/app/projects/[slug]
src/app/relay
src/app/talent
src/app/talent/[id]
```

### 8. `sms-engine/src/app/layout.tsx` existence / role

```text
sms-engine/src/app/layout.tsx exists
sms-engine/src/app/globals.css exists
sms-engine/src/app/page.tsx redirects "/" to "/admin"
sms-engine/src/app/admin/page.tsx is the login page
sms-engine/src/app/admin/(dashboard)/layout.tsx wraps dashboard routes in AdminShell and requireAdmin()
sms-engine/src/app/beta/page.tsx is the public beta waitlist page
sms-engine/src/app/beta/actions.ts exists
sms-engine/src/app/favicon.ico exists
```

## Move Summary

### Route tree

- `sms-engine/src/app/admin/**` → `src/app/(admin)/admin/**`
- `sms-engine/src/app/beta/**` → `src/app/(admin)/beta/**`
- `sms-engine/src/app/api/health/**` → `src/app/api/health/**`
- `sms-engine/src/app/api/internal/**` → `src/app/api/internal/**`
- `sms-engine/src/app/api/twilio/**` → `src/app/api/twilio/**`
- `sms-engine/src/app/layout.tsx` → `src/app/(admin)/layout.tsx`
- `sms-engine/src/app/globals.css` → `src/app/(admin)/globals.css`
- `sms-engine/src/app/favicon.ico` → `src/app/(admin)/favicon.ico`

### Admin components

- `sms-engine/src/components/admin/**` → `src/components/admin/**`

### Removed instead of moved

- `sms-engine/src/app/page.tsx` was deleted rather than moved because it would have overwritten the existing public homepage. Its prior behavior was just a redirect to `/admin`; the real public app already owns `/`.
- `sms-engine/tsconfig.json` was removed because after the lift it pointed at the now-empty `sms-engine/src/**` tree and no longer provided useful resolution for the main app.

## Counts

- Route files moved: `57`
  - `43` route files moved into `src/app/(admin)/**`
  - `14` route files moved into `src/app/api/**`
- Conflicting route files removed instead of moved: `1`
  - `sms-engine/src/app/page.tsx`
- Admin components moved: `9`

## Layout Decisions

- The public root layout at `src/app/layout.tsx` remained the sole `<html>/<body>` layout for the app.
- The lifted engine root layout became a nested route-group layout at `src/app/(admin)/layout.tsx`.
- To preserve the prior admin styling without creating a second root layout, the admin CSS stayed in `src/app/(admin)/globals.css`, and the nested admin layout now wraps children in an `.admin-root` container instead of returning its own `<html>`/`<body>`.
- The existing dashboard auth shell remained intact at `src/app/(admin)/admin/(dashboard)/layout.tsx`; no auth or business-logic changes were made there.

## Config Changes

### `tsconfig.json`

- Removed:

```json
"sms-engine",
"sms-engine/**"
```

- Result: the root app no longer excludes the old nested app path, because the routable code now lives under `src/app/**`.

### `eslint.config.mjs`

- Removed:

```js
"sms-engine/**"
```

- Result: lifted admin/app code is now linted as first-class app code. The leftover archival material under `sms-engine/` remains present, but no special whole-tree ignore remains.

### `next.config.js`

- No change
- No sms-engine-specific exclusion logic remained after PR-B/PR-C.

## Final State Of `sms-engine/`

```text
sms-engine
sms-engine/.github/
sms-engine/AGENTS.md
sms-engine/CHANGES-AFFECTING-WEB-CHAT.md
sms-engine/CLAUDE.md
sms-engine/README.md
sms-engine/docker-compose.yml
sms-engine/docs/
sms-engine/eslint.config.mjs
sms-engine/next-env.d.ts
sms-engine/next.config.ts
sms-engine/package-lock.json.original
sms-engine/package.json.original
sms-engine/postcss.config.mjs
sms-engine/prisma.config.ts
sms-engine/public/
sms-engine/railway.json
sms-engine/reports/
sms-engine/scripts/
```

`sms-engine/src/` is gone.

## Verification

### Clean state

- `rm -rf node_modules .next`
- `npm install`: PASS
  - warnings:
    - engine warnings under Node `v23.6.1`
    - deprecated `scmp@2.1.0`
    - deprecated `tar@7.5.7`
    - Prisma warns that `package.json#prisma` is deprecated in favor of `prisma.config.ts`
- `npm run lint`: PASS
- `npm run build`: PASS
  - non-blocking warning:
    - Turbopack reported an NFT tracing warning involving `./next.config.js` via `src/sms-engine/launchDrill/launchReadinessDrill.ts` imported from `src/app/api/health/route.ts`

### Dev server smoke test

Homepage content check:

```text
Saga
```

Public routes:

```text
/ 200
/explore 200
/feed 200
/my-events 200
/post-project 200
/profile 200
/projects 200
/relay 200
/talent 200
```

Lifted admin and beta routes:

```text
/admin 200
/admin/command-center 307
/admin/contacts 307
/admin/projects 307
/beta 200
```

Lifted API routes:

```text
/api/health 200
/api/twilio/inbound 403
```

The `403` on `/api/twilio/inbound` was expected for an unsigned form post. The route was reachable and did not 500.

### Secret sweeps

```text
OK_AC
OK_SK
```

## Follow-Up TODOs

- Admin auth/data-loading sequencing: during the unauthenticated smoke test, `/admin/contacts` and `/admin/projects` returned `307` as expected, but server logs showed those pages touching `getDb()` before the redirect finished when `DATABASE_URL` was unset. This did not produce an HTTP 500, but it indicates the lifted admin route behavior still allows some page evaluation before auth short-circuiting. That is a follow-up hardening item, not a PR-D behavior change.
- Route-path clarification: the original source tree used a route group `(dashboard)`, so the real URLs are `/admin/*`, not `/admin/dashboard/*`. Verification used the actual lifted URLs.
- API-path clarification: the moved inbound SMS/Twilio webhook route is `/api/twilio/inbound`; there was no pre-existing `/api/sms` route in the source tree to lift.

## Deviations

- Removed `sms-engine/tsconfig.json` instead of keeping it, because after the route and component lift it referenced the now-empty `sms-engine/src/**` tree and no longer served the live app.
- Deleted `sms-engine/src/app/page.tsx` rather than moving it, because preserving it would have overwritten the existing public homepage route.

