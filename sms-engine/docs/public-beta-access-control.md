# Public Beta Access Control v0.1

Public Beta Access Control v0.1 adds internal access gates for moving the standalone Saga SMS Producer app from internal testing toward design partners, private beta, capped public beta, and eventual public launch.

It does not enable public beta, public launch, live SMS, `LLM_MODE=active_live`, design-partner invites, candidate outreach, shortlist sends, group chats, public web sourcing, or production Saga app integration.

## Access Stages

`PILOT_STAGE` supports:

- `internal_test`: safest default; internal allowlist only.
- `design_partner`: invite-only, allowlist/invite controlled.
- `private_beta`: invite-code or operator-approved participants only.
- `public_candidate`: launch rehearsal; public access closed.
- `capped_public_beta`: future capped public beta; requires explicit gates.
- `public_live`: future only; fail-closed unless all public launch gates pass.

Default: `internal_test`.

## Access Modes

`SMS_ACCESS_MODE` supports:

- `allowlist_only`: current safe default. Only `SMS_ALLOWED_NUMBERS` receives normal handling.
- `invite_code`: hard allowlist or valid active invite code can allow access.
- `operator_approval`: unknown inbound can be captured/waitlisted for review, but not normal conversation handling.
- `capped_public_beta`: future mode requiring `PUBLIC_BETA_ENABLED=true`, compliance approval, caps, and participant controls.
- `public_closed`: unknown public access is blocked.

Default: `allowlist_only`.

## Participant Statuses

`PilotParticipant` now carries beta metadata:

- `cohort`: `internal`, `design_partner`, `private_beta`, `public_beta`, or `public_waitlist`.
- `status`: `INVITED`, `ACTIVE`, `PAUSED`, `WAITLISTED`, `REJECTED`, `OPTED_OUT`, or `COMPLETED`.
- `inviteCodeId`, `joinedAt`, `lastActiveAt`, optional admin-only `email`, and notes.

Rules:

- `ACTIVE` can receive normal access if other SMS gates allow.
- `PAUSED`, `WAITLISTED`, `REJECTED`, and `OPTED_OUT` do not receive normal conversation handling.
- `OPTED_OUT` blocks messaging.
- No participant is connected to production Saga users.
- Raw phone numbers are not exposed by default; use hashes and redacted display.

## Invite Code Lifecycle

`BetaInviteCode` stores hashed codes only:

- `codeHash`
- `label`
- `cohort`
- `maxUses`
- `uses`
- `expiresAt`
- `status`: `ACTIVE`, `PAUSED`, `EXPIRED`, or `EXHAUSTED`

Admin creates a plaintext code in `/admin/access`; the app hashes it and does not display the plaintext again.

Invite codes do not bypass:

- `SMS_SENDS_DISABLED`
- `SMS_REQUIRE_ALLOWLIST`
- opt-out state
- compliance gates
- participant caps
- public launch gates

Invite-code acceptance only controls access to normal processing. It does not send SMS.

## Access Decision Flow

`src/lib/access/accessControl.ts` evaluates inbound access before ordinary conversation handling.

Precedence:

1. STOP/START/HELP and opt-out handling.
2. Hard allowlist.
3. Existing active participant.
4. Paused/opted-out/waitlisted/rejected participant blockers.
5. Access mode behavior.
6. Invite-code validation.
7. Participant caps.
8. Public-beta/public-launch gates.

Output includes:

- `allowed`
- `accessStatus`
- participant/code IDs when applicable
- blockers/warnings
- redacted phone
- cap snapshot
- audit explanation

## Cap Behavior

Defaults:

- `PILOT_MAX_ACTIVE_PARTICIPANTS=10`
- `PRIVATE_BETA_MAX_ACTIVE_PARTICIPANTS=50`
- `PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS=100`
- `PUBLIC_BETA_NEW_USER_DAILY_CAP=10`
- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_LAUNCH_ENABLED=false`

If caps are reached, new unknown users are blocked or waitlisted according to access mode. Caps do not enable sends.

## Waitlist and Public Closed Behavior

When public access is closed, unknown inbound is recorded and audited, but normal conversation handling does not run.

Future draft copy, not sent while sends are disabled:

> Saga SMS is currently in private beta. We’ll save your interest, but the live pilot is invite-only right now.

## Admin UI

`/admin/access` shows:

- pilot stage
- access mode
- public beta/public launch enabled state
- active and waitlisted participant counts
- participant cap
- invite codes
- recent access decisions

Admins can:

- create hashed invite codes
- pause invite codes
- mark participants active, paused, waitlisted, rejected, or completed

The page has no SMS send button and no public-launch button.

`/admin/command-center` summarizes the same access posture in the broader
launch context. It shows whether public beta and public launch are blocked,
which caps are configured, and which runbooks/checklists must be reviewed. It
does not expose invite-code plaintext, raw phone numbers, or any public-launch
enable button.

Participant lifecycle and redaction are handled in `/admin/data-ops` when an
operator needs to pause, complete, opt out, or redact a pilot participant.
Those actions are admin-only, preserve audit history, and do not connect to the
main Saga production app.

## Audit Events

- `access.inbound_evaluated`
- `access.invite_code_created`
- `access.invite_code_used`
- `access.invite_code_paused`
- `access.participant_created`
- `access.participant_activated`
- `access.participant_paused`
- `access.participant_waitlisted`
- `access.participant_rejected`
- `access.participant_completed`
- `access.unknown_inbound_blocked`
- `access.cap_reached`

Metadata must not include raw phone numbers, plaintext invite codes, secrets, prompts, or raw LLM outputs.

## What Remains Disabled

- Live SMS.
- Public beta.
- Public launch.
- `LLM_MODE=active_live`.
- Candidate outreach sends.
- Organizer shortlist sends.
- Group chats.
- Main Saga app integration.
- Event publishing, ticketing, RSVP, QR, and payments.

## Relationship to Pilot and Public Beta

This layer lets operators rehearse the access logic before any external users are invited. Design partners and private beta can be modeled as cohorts now. Capped public beta remains disabled until compliance, safety, observability, and launch gates are explicitly reviewed.

Pilot data operations must be reviewed before moving beyond invite-only access:
exports are redacted by default, participant caps stay local to the standalone
database, and pilot/demo/test data must not be mixed with production Saga data.

Launch Readiness Drill v0.1 adds the rehearsal layer above access control. It
can report whether design-partner or public-beta candidate stages are blocked,
but it does not enable public beta, public launch, SMS sends, or invites.

Beta Cohort Simulation v0.1 exercises this access layer with synthetic cohorts:
10 design partners, 25 private-beta users, 100 capped-public-beta users, and
over-capacity pressure. It verifies allow/block/waitlist, opt-out, duplicate,
invite, consent, and cap behavior without sending SMS or creating real users.

## Capped Public Beta Infrastructure

Capped Public Beta Infrastructure v0.1 builds on this access layer with:

- `/beta` landing/waitlist route, disabled by default.
- `/admin/public-beta` waitlist, consent, capacity, and admission review.
- `PublicBetaWaitlistEntry` records with phone hashes/redacted phone display.
- `ConsentEvent` records for auditable beta consent.
- `evaluatePublicBetaAdmission` for staged admission decisions.
- `evaluateCappedPublicBetaReadiness` for public-beta go/no-go blockers.

Additional fail-closed flags:

- `PUBLIC_BETA_LANDING_ENABLED=false`
- `PUBLIC_BETA_WAITLIST_ENABLED=false`
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false`
- `PUBLIC_BETA_REQUIRE_INVITE_CODE=true`
- `PUBLIC_BETA_REQUIRE_CONSENT=true`

Invite codes, waitlist signup, and consent capture never bypass SMS safety,
STOP/opt-out, compliance, caps, or public-launch gates. They also do not send
SMS or admit anyone automatically by default.
