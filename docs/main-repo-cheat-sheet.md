# Try-Saga/saga Repository Cheat Sheet

A technical reference for the Saga monorepo architecture, designed to guide the coexist model migration where `saga-agency-relay-demo-frontend` (new web app) will merge into the main repo while sharing the backend.

---

## 1. Tech Stack at a Glance

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Bun | 1.3.11 |
| **Monorepo Tool** | Turborepo | 2.9.14 |
| **Linter/Formatter** | Biome | 2.4.15 |
| **Language** | TypeScript | 5.9.3 |
| **Frontend** | React 19 + React Router 7 + Vite | 19.2.4 / 7.13.1 / 8.0.1 |
| **Backend** | Express 5 + tsx (dev) | 5.2.1 |
| **Mobile** | React Native 0.81 + Expo 54 | 0.81.5 / 54.0.33 |
| **Database** | Prisma 7 ORM + PostgreSQL | 7.5.0 |
| **Cache** | Redis | 5.11.0 |
| **Feature Flags** | Flagsmith + OpenFeature | Via `@saga/config-*` |
| **Payment** | Stripe (Connect for creator payouts) | 20.4.1 |
| **Storage** | AWS S3 (via `@saga/s3-storage-node`) | bun native client |
| **Code Format** | Single quotes, 2-space indent, 100-char line width | Biome |

**Package Manager:** Bun workspaces + Turborepo. Config: `package.json` (root), `turbo.json` (tasks), `bunfig.toml` (Bun settings).

---

## 2. What Each App Does

### **`apps/app-web`** — Current React web frontend (to be replaced)

**Purpose:** Browser-based UI for posts, comments, communities, events, payments. Will be sunsetted and replaced by rebuild in `saga-agency-relay-demo-frontend`.

**Entry Point:** `src/App.tsx` → React Router v7 with domain-driven structure (`src/domains/{auth,posts,communities,…}`).

**Key Dependencies:**
- `@saga/axios-web` — Axios HTTP client wrapper
- `@saga/config-web` — Flagsmith feature flags
- `@saga/global-web` — Shared UI (ThemeProvider, ErrorBoundary, AvatarProvider, Toast)
- `@saga/*-middleware` packages — API contracts + shared types

**Domain Folders:** `auth`, `posts`, `post-creation`, `comments`, `communities`, `events`, `payments`, `notifications`, `profile`, `follow`, `admin`, `onboarding`, `crowd-commissions`, `tickets`.

**State Management:** React Context only (no Redux/Zustand). Providers: `AuthProvider`, `NotificationProvider`, `UserPermissionsProvider`, `ThemeProvider`, `ViewTypeProvider`.

**Content Format:** Posts stored as **Quill Delta JSON** — never write raw HTML.

**Build:** TypeScript → Vite (dev on port 3000 after proxy from backend at 3001).

**Deprecation Note:** This will be replaced during Phase 2 merge. Your new web app in `saga-agency-relay-demo-frontend` will take its place at `apps/app-web/src/` after Phase 1 stabilization.

### **`apps/app-server`** — Express backend (shared across web + mobile)

**Purpose:** Single backend serving both `app-web` and `app-mobile`, with all domain routers (auth, posts, communities, events, payments, notifications).

**Entry Point:** `src/server.ts` → Express initialization, graceful shutdown, database/Redis connection management.

**App Setup:** `src/app.ts` (line ~1) — Route registration and middleware stacking.

**Key Flows:**
1. **Startup:** `server.ts` calls `verifyDatabaseAndCacheConnections()`, initializes notification system, binds HTTP server to `env.PORT` (default 3001).
2. **Request Handling:** Every request flows through Helmet (security headers) → json parser → CORS → metrics → logger → domain routers.
3. **Shutdown:** Graceful 10s timeout for DB/Redis disconnection, force kill after timeout.

**Key Dependencies:**
- `@saga/database-node` — Prisma client + schema
- `@saga/user-node` — Auth routers
- `@saga/records-node` — Posts, comments, likes, saves
- `@saga/community-node` — Communities
- `@saga/events-node` — Events
- `@saga/payments-node` — Stripe integration
- `@saga/notification-node` — SSE stream + notification delivery
- `@saga/worker-node` — Scheduled tasks via worker-server
- `@saga/precedent-node` — Error handling, metrics (Prometheus), request logging

**API Routes** (all under `/api/{domain}`):
- `/api/auth` — signup, login, password reset, email verify
- `/api/users` — profile, preferences
- `/api/posts` — CRUD posts
- `/api/comments` → children of records via `/api/records` (Records table is post+comment hybrid)
- `/api/communities` — CRUD communities, membership
- `/api/events` — CRUD events, RSVPs, tickets
- `/api/payments` — Stripe checkout, transaction history
- `/api/notifications` — SSE `/stream` endpoint
- `/api/admin` — User role management, feature permissions

**Special Routes:**
- `POST /api/payments/webhooks/stripe` — **Must be before `express.json()`** to preserve raw body for signature verification.
- `GET /metrics` — Bearer token auth'd Prometheus metrics.
- Health endpoints: `/health/liveness`, `/health/readiness`.

**Deployable:** Yes, containerized via `Dockerfile`.

### **`apps/worker-server`** — Background job processor

**Purpose:** Separate process for async work: payments (Stripe Connect disbursements), notifications (batching), scheduled tasks, event cleanups.

**Entry Point:** `src/index.ts` (Bun native).

**Key Dependencies:**
- `@saga/scheduler-node` — Cron + immediate job queue
- `@saga/worker-node` — Job definitions
- `@saga/payments-node` — Stripe transfer handling
- `@saga/notification-node` — Real-time SSE event batching

**Execution:** In non-local environments, jobs run embedded inside `app-server`; locally they run as separate `bun --filter @saga/worker-server start` process.

**Deployable:** Yes (separate Docker image or sidecar).

### **`apps/app-mobile`** — React Native iOS + Android (Expo)

**Purpose:** Native mobile app (focus: iOS) using Expo + Expo Router.

**Entry Point:** `main` points to Expo Router entry (native navigation).

**Key Dependencies:**
- `@saga/axios-web` — Same HTTP client as web
- `@saga/*-middleware` — Shared types
- `@stripe/stripe-react-native` — Stripe payment sheet
- `expo-router` — File-based routing
- `@react-native-async-storage/async-storage` — Local persistence
- `expo-notifications` — Push notifications
- `expo-camera`, `expo-image-picker` — Media upload

**Auth:** Platform-aware signup/login (platform param distinguishes `mobile` vs `web` in backend).

**Deployable:** No direct backend deployment; distributes via Expo / Apple TestFlight / Google Play.

---

## 3. What Each Package Provides

### **Middleware Packages** (`packages/middleware/*`)

These export **shared TypeScript types and constants** used by both frontend and backend. No runtime logic.

| Package | Exports | Consumed By |
|---------|---------|-------------|
| `@saga/user-middleware` | `UserFeature` enum, `UserRole` enum, anonymization helpers | web, mobile, user-node |
| `@saga/records-middleware` | `RecordType` enum (post\|comment), record contracts | web, mobile, records-node |
| `@saga/notification-middleware` | `SSEEventType` union, `SSEPayload` types, event shape | web, mobile, notification-node |
| `@saga/community-middleware` | `CommunityRole` enum, visibility types | web, communities-node |
| `@saga/events-middleware` | Event types, RSVP status | web, events-node |
| `@saga/payments-middleware` | Payment status enum, transaction types | web, payments-node |
| `@saga/precedent-middleware` | HTTP error shapes (404, 500, etc.) | web, mobile, all *-node |
| `@saga/tickets-middleware` | Ticket validation enums | web, tickets-node |
| `@saga/account-deletion-middleware` | Deletion state types | web, user-node |
| `@saga/crowd-commission-middleware` | Poll and vote types | web, crowd-commission-node |
| `@saga/logger-middleware` | Structured logger interface | all packages |

**Location:** `packages/middleware/{name}/src/index.ts` — each re-exports from subdirectories (types/, constants/, utils/).

**Pattern:** `@saga/{domain}-middleware` is imported by both web and corresponding `{domain}-node` package.

### **Node (Backend) Packages** (`packages/node/*`)

These implement domain logic or shared backend utilities.

#### Core Infrastructure:

- **`@saga/database-node`** — Prisma v7 client, schema (in `prisma/models/*.prisma`), migrations, seed. Exports `prisma` singleton and database types. Schema models live in 9 files: users.prisma, posts.prisma, communities.prisma, events.prisma, payments.prisma, notifications.prisma, scheduled-tasks.prisma, tickets.prisma, crowd-commissions.prisma. See [Prisma ORM v7](#prisma-orm-v7) for details.

- **`@saga/config-node`** — Environment config via Zod. Walks directory tree to find `.env`. Validates `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, Stripe keys, Mailgun, AWS, Flagsmith, etc. Exports validated `env` object and `constants` (feed page size 10, max image 30MB/post, max video 150MB, platform fee 500 bps).

- **`@saga/s3-storage-node`** — AWS S3 wrapper using Bun native S3 client. Per-BucketType client map (records, users, communities, events). Streaming multipart uploads.

- **`@saga/logger-middleware`** — Structured JSON logger shared across backend.

#### Domain Packages (Store → Service → Router):

Every `@saga/{domain}-node` follows the pattern:
- **`stores/`** — Direct Prisma queries, no business logic.
- **`services/`** — Business logic, orchestration, cross-domain calls.
- **`routes/`** — Express route handlers, validation, response shaping.

| Package | Domains | Key Models |
|---------|---------|-----------|
| `@saga/user-node` | Auth, user profile, roles | User, UserLocation, UserFeaturePermission, PushToken, UserBlock, UserReport |
| `@saga/records-node` | Posts, comments, likes, saves, collabs | Record, Like, SavedPosts, PostStats, CollabAnchor |
| `@saga/community-node` | Communities, membership, moderation | Community, CommunityMembership, CommunityVersion |
| `@saga/events-node` | Events, RSVPs, applications | Event, EventRsvp, EventApplication, EventPersonnel |
| `@saga/payments-node` | Stripe Connect, transactions, payouts | ConnectedAccount, PostPaymentConfig, PaymentTransaction, StripeTransfer |
| `@saga/notification-node` | SSE real-time events, delivery tracking | Notification, NotificationDeliveries (Redis-backed) |
| `@saga/follow-node` | Follower graph | Follow (composite key userId, followingId) |
| `@saga/crowd-commission-node` | Polls with fund allocation | CrowdCommission, CrowdCommissionPollVote |
| `@saga/tickets-node` | Event ticket sales, validation | Ticket, TicketValidation |
| `@saga/scheduler-node` | Scheduled tasks | ScheduledTask (with `lockedAt` + `idempotencyKey` for distributed lock) |
| `@saga/worker-node` | Job execution | Job queue definitions |
| `@saga/moderation-node` | Post/event bans, reports | PostCommunityBan, PostEventBan, ModeratorInvite |
| `@saga/account-deletion-node` | User deletion orchestration | AccountDeletionLog (snapshot of blockers, actions summary) |
| `@saga/precedent-node` | Express middleware: error handler, metrics, logger | Prometheus `prom-client`, error shaping |

---

### **Web (Frontend) Packages** (`packages/web/*`)

- **`@saga/axios-web`** — Axios HTTP client wrapper with retry logic, interceptors for JWT token injection. Exports configured `axiosInstance`.

- **`@saga/config-web`** — Flagsmith feature flag client (OpenFeature SDK). Validates `VITE_FLAGSMITH_KEY` and `VITE_FLAGSMITH_API_URL`. Exports `FlagsmithClient` singleton.

- **`@saga/global-web`** — Shared UI components: `ThemeProvider` (light/dark), `ErrorBoundary`, `AvatarProvider`, `Toast` (via react-toastify).

- **`@saga/api-web`** — API contract types inferred from backend (or manually typed). Likely re-exports middleware types.

---

## 4. How Apps Talk to Each Other

### **API Pattern: REST + JWT**

- **Mobile + Web → Backend:** Both use HTTP/REST over `@saga/axios-web`. Requests hit `app-server` at `/api/{domain}/{endpoint}`.

- **Authentication:** JWT token issued at signup/login (`POST /api/auth/signup`, `POST /api/auth/login`). Token includes user ID, issued/expiry times. Stored in localStorage (web) or AsyncStorage (mobile). Injected by axios interceptor in every request (`Authorization: Bearer <token>`).

- **Token Refresh:** `refreshToken` returned on login; rotate on expiry via backend endpoint (not yet visible in excerpt, but standard pattern).

- **Session ID** (optional, platform-dependent): Returned if `platform === 'mobile'` in auth response; used for session tracking.

### **API Contract Enforcement**

Routes are **REST** (no GraphQL, no tRPC). Request/response shapes defined in `*-middleware` packages (`types/` directories). Frontend types from Zod schemas or hand-written interfaces in middleware.

Example: `POST /api/auth/login`
```
Request: { email, userName, password, platform? }
Response: { userId, userName, accessToken, refreshToken, sessionId?, verified, role }
```

### **Real-Time Events: SSE (Server-Sent Events)**

One persistent connection per authenticated user at `GET /api/notifications/stream`. All events (notifications, payments, permission changes) share this stream.

**SSE Wire Format:** Unnamed data frames (required for `EventSource.onmessage`):
```
data: {"type":"notification:new","payload":{...}}\n\n
```

**Adding a New Event Type** requires changes to 4 layers (order matters):
1. Add to `SSEEventType` union + payload type in `notification-middleware/src/types/SSEEventTypes.ts`
2. Emit from backend service via `sseConnectionManager.sendToUser(userId, 'event:type', payload)`
3. Handle in `app-web/src/domains/notifications/hooks/useNotificationSSE.ts` (add callback option + switch case)
4. Wire in `NotificationContext.tsx` provider (call the callback)

**Payment-specific events** additionally register in `usePaymentSSE.ts` and `PaymentSSEEvent` union.

### **Worker Server Consumption**

`app-server` is the single source of truth for user-facing requests. `worker-server` consumes:
- Scheduled `ScheduledTask` rows (locked via `lockedAt + idempotencyKey`)
- Job queues from domain services (e.g., `payments-node` pushes jobs for Stripe disbursement)
- Redis Pub/Sub for event dispatch

---

## 5. Data Layer

### **Prisma ORM v7 + PostgreSQL**

**Schema Location:** `packages/node/database-node/prisma/`

- **Main file:** `schema.prisma` (minimal; just defines generator and datasource)
- **Models:** Split into 9 domain-organized files under `prisma/models/`:
  - `users.prisma` — User, Account, UserLocation, UserFeaturePermission, PushToken, Follow, UserBlock, UserReport, UserVersion
  - `posts.prisma` — Record (unified post+comment), SavedPosts, Like, PostStats, RecordVersion, CollabAnchor
  - `communities.prisma` — Community, CommunityMembership, CommunityVersion, PostCommunity
  - `events.prisma` — Event, EventRsvp, EventApplication, EventPersonnel, PostEvent
  - `payments.prisma` — ConnectedAccount, PostPaymentConfig, PaymentTransaction, StripeTransfer
  - `notifications.prisma` — Notification, NotificationDeliveries (with retry + delivery status per channel)
  - `scheduled-tasks.prisma` — ScheduledTask (distributed lock pattern)
  - `tickets.prisma` — Ticket, TicketValidation
  - `crowd-commissions.prisma` — CrowdCommission, CrowdCommissionPollVote

**Database Driver:** Prisma 7 requires a driver adapter. For standard Postgres TCP (Cloud SQL, RDS), uses `@prisma/adapter-pg` + `pg` package. Instantiated in `database-node/src/prisma.ts`:
```typescript
new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
```

**CLI Config:** `prisma.config.ts` centralizes schema path, migrations dir, seed script, and datasource URL (loaded from `@saga/config-node`'s validated `env`).

**Generated Client:** Output to `database-node/src/generated/prisma/` (not `node_modules`), gitignored. Imported via `@saga/database-node` re-export, never directly from `@prisma/client`.

**Shared Schema:** Both `app-web` and `app-mobile` read the same database via `app-server`. No separate data models per client. Single source of truth.

**Middleware Note:** Prisma v7 removed `$use()` middleware. `setupVersionTracking` is commented out pending rewrite with `$extends`. `UserVersion`, `CommunityVersion`, `RecordVersion` tables remain for audit history.

### **Redis**

Used for:
- SSE connection management (store per-user event subscriptions)
- Notification batching (queue events before SSE push)
- General caching (session tokens, feature flag cache)
- Pub/Sub for inter-process events (worker-server coordination)

Imported from `@saga/database-node` as `redis` singleton. Config via `REDIS_URL` in `.env`.

---

## 6. Auth + Identity Model

### **Existing iOS Auth Flow**

1. **Signup:** `POST /api/auth/signup` with email, userName, password, displayName.
   - Backend hashes password (bcryptjs in `user-node`)
   - Sends verification email via Mailgun
   - Returns JWT + refreshToken
   
2. **Login:** `POST /api/auth/login` with email OR userName + password.
   - Validates credentials
   - Returns JWT + refreshToken
   
3. **Password Reset:** `POST /api/auth/forgot-password`, then `POST /api/auth/reset-password` with token.

4. **Email Verification:** `POST /api/auth/verify-email` with userId + token from email link.

5. **Token Lifecycle:** JWT expires (claim in token); refresh via `/api/auth/refresh` (inferred but not visible in excerpt). Refresh token stored in `PushToken` table or secure storage (mobile AsyncStorage).

**No OAuth/Social Login visible today** — pure email + password. If Apple Sign-In is implemented for iOS, it would be a new endpoint wrapping the same JWT flow.

### **New Web App Integration**

Your rebuild in `saga-agency-relay-demo-frontend` will:
1. Use the same `/api/auth/*` endpoints
2. Inject JWT via axios interceptor (same as mobile)
3. Store tokens in localStorage (or sessionStorage)
4. Handle SSE connection to `/api/notifications/stream`

No changes needed to auth backend for coexist. Auth is **transport-agnostic**.

### **Feature Permissions + User Roles**

- **User Roles:** Admin (role = 1), regular user (role = 0). Set at signup, updated by `/api/admin/`.
- **Feature Permissions:** Per-user grants (`UserFeaturePermission` table) for `CREATE_EVENT`, `CREATE_COMMUNITY`, `ACCEPT_PAYMENTS`, etc. Managed via admin tool.
- **Frontend Gating:** `useFeatures()` hook combines global Flagsmith flags + per-user permissions. **Never gate route registration on async permissions** — use `PermissionRoute` component that waits for load.

---

## 7. Deployment + Infrastructure

### **Containerization**

**Dockerfile** (root):
- Base: `node:25-slim`
- Install: Bun, dependencies (`bun install --frozen-lockfile`)
- Build: Runs `./startup-scripts/build.sh` (Turborepo build)
- Startup: `ENTRYPOINT` runs `./startup-scripts/startup.sh`
- Exposes ports: 3000 (frontend preview), 3001 (backend API)
- AWS secrets: Mounted via BuildKit secret (credentials never in image layer)

**Build Matrix:** Docker build args set `NODE_ENV`, `DATABASE_URL`, `SERVER_TYPE` (web | worker).

### **Startup Scripts**

- **`build.sh`** — Runs Turborepo build, generates Prisma client, builds all packages.
- **`startup.sh`** — Conditionally starts `app-server`, `worker-server`, or both based on `SERVER_TYPE`.
- **`kill-ports.ts`** — Utility to free ports 3000, 3001 (used in dev).
- **`dev-mobile.sh`** — Bash wrapper for `bun run mobile` flow.

### **Infrastructure Submodule**

`infrastructure/` is a git submodule pointing to `Try-Saga/infrastructure` (private repo). Contains:
- Terraform / CloudFormation definitions
- GCP Cloud Run / GKE configs
- Database provisioning (Cloud SQL)
- Redis provisioning
- CI/CD workflows

**Not detailed here** — coordinated with ops team.

### **Environment Variables**

All required vars validated by `@saga/config-node` on startup (exits 1 if missing):
- `NODE_ENV` (develop | production | local | test)
- `PORT`, `NODE_SERVER_URL`, `WEB_URL`
- `JWT_SECRET` (64+ chars in prod)
- `DATABASE_URL`, `REDIS_URL`
- `STRIPE_*` keys (sk_, pk_, whsec_)
- `AWS_REGION`, `AWS_*_BUCKET_NAME` (S3)
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`
- `FLAGSMITH_SERVER_ENV_KEY`, `FLAGSMITH_API_URL`
- `CROWD_COMMISSION_MAX_DEADLINE_DAYS` (feature config)

**Web vars** (Vite, prefixed `VITE_`):
- `VITE_FLAGSMITH_KEY`, `VITE_FLAGSMITH_API_URL`
- `VITE_API_URL` (backend base, e.g., `http://localhost:3001`)

### **Service Account**

`service-account.json` (gitignored) — Likely GCP service account for:
- Cloud SQL proxy authentication
- Cloud Run deployments
- Secret Manager access

---

## 8. Conventions Inherited from CLAUDE.md & Architecture.md

### **Planning & Workflow**

- **Plan First:** Any non-trivial task (3+ steps or architectural decision) enters plan mode first.
- **Subagents:** Use liberally for research, exploration, parallel analysis.
- **Self-Improvement:** After corrections, update `tasks/lessons.md` with rules to prevent recurrence.
- **Verification Before Done:** Always prove correctness — run tests, diff behavior, ask "would a staff engineer approve this?"
- **Demand Elegance:** Pause and ask "is there a more elegant way?" for non-trivial changes.

### **Code Style & Hygiene**

- **Biome:** Single source of truth. Single quotes, 2-space indent, 100-char line width. Run `bun run check:fix`.
- **Discriminated Unions:** Prefer over type assertions (`as`). Use type guards.
- **Avoid `any` and `unknown`:** Explicit types in app and domain packages.
- **No Hand-Editing Generated Code:** Prisma output in `src/generated/prisma/` is auto-generated; don't modify.
- **Module System:** ESM (`"type": "module"` in package.json, Node 20+ style imports).

### **Architecture Rules**

- **Monorepo Structure:** Three tiers:
  - **Apps** — entry points (web, server, worker, mobile).
  - **Packages/Node** — backend domain logic (Store → Service → Router pattern).
  - **Packages/Middleware** — shared types (no logic).
  - **Packages/Web** — frontend utilities (client wrapper, config, UI primitives).

- **Package Naming Convention:**
  - `@saga/*-node` — backend-only
  - `@saga/*-web` — frontend-only
  - `@saga/*-middleware` — shared types/constants

- **Domain Packages Cannot Reach Up:** A domain package in `user-node` can depend on `database-node`, `config-node`, `logger-middleware`, but NOT on `app-server` or `app-web`. Dependency direction is always downward (app → package).

- **No Prisma in Routers:** Business logic lives in services; stores contain only queries; routers validate and shape responses.

- **Holistic Changes:** When modifying a contract (type, hook, event), find and update every layer that consumes it. No orphaned union types or inconsistent switch cases.

### **Task Management Pattern**

1. Write plan to `tasks/todo.md` with checkable items.
2. Check plan before implementation.
3. Mark items complete as you go.
4. Add review section to `tasks/todo.md` explaining changes.
5. Update `tasks/lessons.md` after corrections.

**Location:** `tasks/` directory is git-tracked. Lessons are cumulative; periodically review.

---

## 9. What's Reusable for the Coexist Model (Phase 2 Backend Convergence)

This section maps your `saga-agency-relay-demo-frontend` code to likely destinations in the main repo after merge.

### **Your `src/lib/sagasanAgent.ts`**

**Maps to:** `apps/app-server/src/agents/sagasan/` (or `packages/node/agents-node/` if shared across multiple jobs)

**Survey:** Does `apps/app-server/src/` have an `agents/` folder? Check `gh api repos/Try-Saga/saga/contents/apps/app-server/src`.

**Merge Strategy:** Extract agent orchestration logic into a domain package (`@saga/agents-node`) following Store → Service → Router pattern, even if no routes expose it. Services in other domains can then depend on it. Avoid putting agent code directly in server startup or routers.

### **Your `src/sms-engine/producer/*`**

**Maps to:** `apps/app-server/src/producer/` or `packages/node/producer-node/`

**Survey:** Check for existing producer code in app-server.

**Merge Strategy:** If producing SMS is a one-way job (send and forget), it belongs in `worker-server` not `app-server`. Create a `@saga/sms-node` package with a service that reads queue rows (or Redis events) and dispatches Twilio/Sendgrid calls. Wire it into worker startup.

### **Your `src/sms-engine/matchingEval/*` + `networkMatching.ts`**

**Maps to:** `packages/node/matching-node/` (new domain package)

**Survey:** Does the main repo have matching logic today? Likely not (feature is new).

**Merge Strategy:** Extract matching logic into `@saga/matching-node` with services for evaluation. If triggered by user actions (e.g., user creates a post), wire the service into `records-node/services/` to call after post creation. If batch-evaluated on schedule, add a job to `scheduler-node` that runs at intervals.

### **Your `prisma/schema.prisma`**

**Maps to:** `packages/node/database-node/prisma/models/*.prisma` (new domain files)

**Survey:** Check what tables already exist. Main repo has: users, posts, communities, events, payments, notifications, scheduled-tasks, tickets, crowd-commissions.

**Merge Strategy:**
1. Identify which new tables your schema adds (e.g., `Message`, `MatchingResult`, `SMSTemplate`).
2. Create new domain files: `messages.prisma`, `matching.prisma`, `sms.prisma`.
3. Reference existing models (e.g., `User`, `Record`) from other domain files.
4. Run Prisma migration (CLI will auto-detect new models).
5. Generate client and re-export from `@saga/database-node`.

**Caution:** If your schema redefines existing tables (User, Record, etc.), you'll need to merge manually or backport your schema to the main repo's split model files.

### **Your `src/lib/journey/` (when written)**

**Maps to:** `packages/node/journey-node/` (new domain package)

**Survey:** Not visible today; likely greenfield.

**Merge Strategy:** Create a domain package following Store → Service → Router. If journey is a state machine persisted to a table, add `journey.prisma` to database-node. Wire journey services into post-creation or other event handlers in `records-node`.

### **Your Web UI (`src/app/`, `src/components/`)**

**Maps to:** Replace `apps/app-web/src/` after Phase 1 rebuild completion

**Survey:** Current structure is domain-driven (`src/domains/{auth,posts,…}`). Your rebuild should follow the same pattern for consistency.

**Merge Strategy:** During Phase 2 final merge, your build output replaces app-web entirely. Coordinate with app-server via the stable `/api/{domain}` contracts (no changes needed). Ensure all path aliases (`@`, `@domains`, `@components`, etc.) match the template in `apps/app-web/src/vite.config.ts` and `tsconfig.json`.

### **Your Prisma Types + Middleware**

**Maps to:** `packages/middleware/{domain}-middleware/src/types/`

**Survey:** Main repo pattern: every domain has a `*-middleware` package exporting types for that domain.

**Merge Strategy:** Extract any types unique to your new features (matching result shapes, SMS template, journey state) into new middleware packages. Re-export from the corresponding domain packages so web can import them.

---

## 10. Mergeability Red Flags

### **Red Flag 1: ORM Mismatch**

**Status:** ✅ Safe. Main repo uses Prisma 7 + PostgreSQL. If your rebuild also uses Prisma + PostgreSQL, no issue.

**Risk:** If you used a different ORM (Drizzle, TypeORM) or database (MongoDB, Firebase), you'll need to either:
- Rewrite your schema in Prisma before merge, or
- Maintain two ORMs side-by-side (discouraged; creates maintenance burden).

**Recommendation:** Align on Prisma v7 from the start.

---

### **Red Flag 2: Auth Layer Divergence**

**Status:** ✅ Safe. Main repo uses JWT + email/password (via `@saga/user-node`). `app-web` and `app-mobile` both consume the same backend.

**Risk:** If your rebuild implemented OAuth, social login, or a different token scheme, you'll need to backport or rewrite auth.

**Recommendation:** Use the existing `@saga/user-node` auth directly. Add new auth methods (Apple Sign-In, Google OAuth) as **additions** to the existing JWT flow, not replacements.

---

### **Red Flag 3: API Contract Divergence**

**Status:** ✅ Safe. Main repo uses REST `/api/{domain}/{endpoint}` with clear type contracts in middleware.

**Risk:** If your rebuild designed different endpoints, response shapes, or error codes, you'll need to align or run two parallel APIs during migration.

**Recommendation:** Use the existing `/api/*` contracts. If you need new endpoints, add them as new routes under the same domain (e.g., `/api/posts/timeline` vs `/api/posts/feed`).

---

### **Red Flag 4: Package Manager / Lock File Mismatch**

**Status:** ✅ Safe. Main repo uses Bun 1.3.11 + `bun.lock`.

**Risk:** If your rebuild used npm/yarn/pnpm, the lock files won't merge. You'll have duplicate `node_modules` logic, version conflicts, and ci flakiness.

**Recommendation:** Use Bun from day one. If you're on npm locally, switch to Bun via `bun install` (auto-converts your package.json).

---

### **Red Flag 5: TypeScript Config Divergence**

**Status:** ✅ Safe. Main repo has `tsconfig.json` (root) + workspace-specific `tsconfig.json` in each app/package.

**Risk:** If your rebuild has conflicting `tsconfig.json` (e.g., different `target`, `module`, `paths`), TypeScript compilation will fail or behave unexpectedly.

**Recommendation:** Align your `tsconfig.json` on the root template before merging. Test builds with `bun run build` to catch conflicts early.

---

### **Red Flag 6: Biome Config Divergence**

**Status:** ✅ Safe. Main repo uses `biome.json` (root) with single quotes, 2-space indent, 100-char width.

**Risk:** If your rebuild used ESLint/Prettier with different rules, `bun run check:fix` will reformat your code. Commits become noise; diffs hard to review.

**Recommendation:** Use `biome.json` from main repo immediately. If you're on ESLint/Prettier, port your rules to Biome before merge.

---

### **Red Flag 7: Feature Flag Integration**

**Status:** ✅ Safe. Main repo uses Flagsmith + OpenFeature. Both `app-web` and `app-mobile` are wired up.

**Risk:** If your rebuild didn't integrate Flagsmith, or used a different feature flag service, you'll need to backport.

**Recommendation:** Integrate Flagsmith via `@saga/config-web` and `@saga/config-node` from the start. Wrap all new boolean gates in `useFeatures()` hook (web) or service calls (backend).

---

### **Red Flag 8: SSE Event Types Missing**

**Status:** ⚠️ Moderate. Main repo has established SSE event pipeline (notification, payment, permission changes).

**Risk:** If your features emit new real-time events (e.g., matching result, SMS delivery), you'll need to add them to the 4-layer SSE flow. Missing one layer breaks type safety and causes runtime errors.

**Recommendation:** When adding new SSE events, follow the 4-layer pattern strictly:
1. `notification-middleware/src/types/SSEEventTypes.ts`
2. Backend emitter (`{domain}-node/services/`)
3. `useNotificationSSE.ts` callback
4. `NotificationContext.tsx` wiring

See [How Apps Talk to Each Other → Real-Time Events](#real-time-events-server-sent-events) for the full checklist.

---

### **Red Flag 9: Database Migration History**

**Status:** ✅ Safe if starting fresh. Main repo has migrations in `packages/node/database-node/prisma/migrations/`.

**Risk:** If your rebuild created a separate Prisma schema and already has migration history, merging requires:
- Squashing your migrations into a single "add XYZ tables" migration, or
- Replaying migrations in the main repo's migration folder in the right order.

**Recommendation:** Before Phase 2 merge, coordinate with the database admin:
1. Dump the schema from your demo app.
2. Create a squashed migration in main repo: `bun --filter @saga/database-node db:migrate:create` (add all new tables).
3. Verify both schema and migration history are clean.

---

### **Red Flag 10: Shared Context Leakage into Backend**

**Status:** ⚠️ Risk in frontend-only code. Main repo strictly separates `@saga/*-web` (frontend) from `@saga/*-node` (backend). React Hooks, Context, Browser APIs must NOT appear in packages or backend.

**Risk:** If you accidentally import a web package into a node package, or use `React.useContext()` in backend code, TypeScript will catch it, but it indicates architectural confusion.

**Recommendation:** When extracting shared logic from your rebuild into a package, ask: "Is this code reusable for both web *and* mobile *and* backend?" If no, it should be `*-web` or `*-node`, not `*-middleware`. Never import `*-web` packages into `*-node` packages.

---

## 11. Quick Reference: Key File Locations

### **Backend Startup & Config**

- `apps/app-server/src/server.ts` — Entry point, graceful shutdown
- `apps/app-server/src/app.ts` — Route registration (line 1+)
- `apps/app-server/src/corsConfig.ts` — CORS policy
- `packages/node/config-node/src/env.ts` — Environment schema + validation
- `packages/node/config-node/src/constants.ts` — Business logic constants (feed page size, upload limits, fees)

### **Database & ORM**

- `packages/node/database-node/prisma/schema.prisma` — Generator + datasource config
- `packages/node/database-node/prisma/models/*.prisma` — Domain schemas (users, posts, communities, etc.)
- `packages/node/database-node/prisma.config.ts` — Prisma CLI config (schema path, datasource URL)
- `packages/node/database-node/src/prisma.ts` — PrismaClient instantiation + driver adapter
- `packages/node/database-node/src/index.ts` — Export point for app-server + domain packages

### **Auth**

- `packages/node/user-node/src/routes/authRouter.ts` — POST /api/auth/{signup,login,forgot-password,reset-password,verify-email}
- `packages/node/user-node/src/services/AuthService.ts` — Auth business logic (password hash, token creation)
- `packages/node/user-node/src/stores/UserStore.ts` — Database queries for users

### **Frontend Routes & State**

- `apps/app-web/src/App.tsx` — React Router setup, domain route registration
- `apps/app-web/src/domains/` — Feature folders (auth, posts, communities, …)
- `apps/app-web/src/contexts/` — React Context providers (ViewType, Modal state, etc.)
- `apps/app-web/src/hooks/useFeatures.ts` — Feature flag + permission gating
- `apps/app-web/vite.config.ts` — Path aliases, build config

### **Notifications & Real-Time**

- `packages/middleware/notification-middleware/src/types/SSEEventTypes.ts` — SSE event type union + payload map
- `packages/node/notification-node/src/services/SSEConnectionManager.ts` — Event emission
- `apps/app-web/src/domains/notifications/hooks/useNotificationSSE.ts` — Frontend SSE listener
- `apps/app-web/src/domains/notifications/context/NotificationContext.tsx` — Event consumer

### **Deployment**

- `Dockerfile` — Containerization
- `startup-scripts/build.sh` — Build orchestration
- `startup-scripts/startup.sh` — Runtime startup decision
- `turbo.json` — Turborepo task definitions + caching
- `.github/workflows/` — CI/CD (if present; managed by infrastructure submodule)

---

## 12. Common Commands

### **Local Development**

```bash
# Full stack (web + server + workers)
bun run dev

# Without workers
bun run dev:no-workers

# Frontend only (assumes server already running on :3001)
bun start:frontend

# Backend only
bun start:backend

# Worker only
bun start:worker
```

### **Building & Linting**

```bash
# TypeScript check + Vite build for web; tsc for backend packages
bun run build

# Biome lint + format (all files)
bun run check:fix

# Database operations
bun --filter @saga/database-node db:migrate
bun --filter @saga/database-node db:migrate:create
bun --filter @saga/database-node db:generate
bun --filter @saga/database-node db:studio   # Prisma Studio UI
bun --filter @saga/database-node db:seed
```

### **Testing**

```bash
# All tests
bun run test

# Watch mode
bun run test:watch

# Single test file
bun --filter @saga/app-web test:run src/path/to/file.test.ts
```

### **Cleanup**

```bash
# Remove build artifacts, .turbo, tsbuildinfo
bun run clean

# Kill ports 3000, 3001 (useful if old process hung)
bun run kill-ports
```

---

## Summary for Leadership / Non-Technical Readers

**Saga's current monorepo is a fully integrated, production-ready system with:**

- **Single backend (`app-server`)** serving both web and iOS via REST API + JWT auth
- **Structured domain packages** (users, posts, communities, events, payments, notifications) that isolate logic but share a database
- **Shared type contracts** in middleware packages so web and iOS both speak the same language
- **Real-time features** via SSE (one persistent connection per user streams all events)
- **Scalable job processing** with a separate worker server for background tasks

**For the rebuild:**

1. **Phase 1** builds a new web app in `saga-agency-relay-demo-frontend` using the existing backend — no changes to `app-server` needed, just consume `/api/*` REST endpoints.

2. **Phase 2 merge** replaces `apps/app-web` with your rebuilt code, merges any new features (matching, SMS, journeys) into their own domain packages, and verifies both platforms still share the same backend.

3. **No architectural changes** to the monorepo structure or auth model — you're adding features and replacing the UI, not redesigning the foundation.

**Key risk:** Divergence on tooling (ORM, package manager, linter, auth method). Staying aligned with the main repo's choices from day one eliminates merge friction.

---

**Last Updated:** 2026-05-17  
**For:** Saga founders + engineering team  
**Audience:** Non-technical decision-makers, architects, engineers planning Phase 2 integration

