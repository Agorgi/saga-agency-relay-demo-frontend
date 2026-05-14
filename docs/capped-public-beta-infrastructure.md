# Capped Public Beta Infrastructure v0.1

## Purpose

This package prepares the standalone Saga SMS Producer app for a future capped public beta without enabling public beta, public launch, live SMS, or production Saga app integration.

It adds disabled-by-default infrastructure for:
- public-beta landing and waitlist intake
- consent capture
- staged admission review
- public-beta capacity controls
- waitlist and cohort operations
- command-center and observability visibility

## What Is Built

- `/beta`: public beta landing/waitlist route.
- `/admin/public-beta`: admin waitlist, consent, capacity, and admission review page.
- `PublicBetaWaitlistEntry`: redacted waitlist records.
- `ConsentEvent`: auditable consent capture records.
- `evaluatePublicBetaAdmission`: admission gate evaluator.
- `evaluateCappedPublicBetaReadiness`: public-beta readiness evaluator.

## What Is Disabled

By default:
- `PUBLIC_BETA_ENABLED=false`
- `PUBLIC_BETA_LANDING_ENABLED=false`
- `PUBLIC_BETA_WAITLIST_ENABLED=false`
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false`
- `SMS_SENDS_DISABLED=true`
- `PUBLIC_LAUNCH_ENABLED=false`

No SMS is sent from this infrastructure.

## Stage Gates

Public beta is not ready unless:
- A2P/compliance is approved.
- `SMS_SENDS_DISABLED=false` is intentional and reviewed.
- public beta is explicitly enabled.
- landing and waitlist are intentionally enabled.
- support email, privacy URL, and terms URL are configured.
- launch drill and observability are not red.
- data ops, incident, rollback, and abuse/rate-limit runbooks exist.
- caps are configured and enforced.

## Waitlist Behavior

The waitlist records minimal interest information. Phone numbers are hashed/redacted. Email is redacted in admin summaries.

Waitlist signup does not:
- admit the user
- send SMS
- show the SMS number
- connect to main Saga users
- guarantee access, bookings, payments, or production support

## Consent Behavior

Consent is recorded as an auditable `ConsentEvent`. Consent does not bypass STOP/opt-out, allowlist, compliance, send-disabled, or public launch gates.

## Public Number Visibility

The public SMS number must remain hidden unless `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=true` is explicitly set after launch review. The current implementation does not publish the Twilio number by default.

## Admission Process

Admission is manual and staged:
1. Waitlist entry is captured.
2. Consent is verified.
3. Admission evaluator checks compliance, caps, policy links, duplicate/paused/opted-out state, and stage/access mode.
4. Admin may admit only if the evaluator returns `ADMISSIBLE_FOR_REVIEW`.

No admission path sends SMS.

## Capacity Controls

Public beta uses:
- `PUBLIC_BETA_MAX_ACTIVE_PARTICIPANTS`
- `PUBLIC_BETA_NEW_USER_DAILY_CAP`
- participant counts from the standalone pilot database

Cap reached entries remain waitlisted or blocked for review.

Beta Cohort Simulation v0.1 models 100 synthetic capped-public-beta users and an
over-capacity cohort before any public beta flag is enabled. Passing simulation
shows that caps, waitlist behavior, duplicate detection, opt-out precedence, and
support/safety escalations behave as expected, but it does not make public beta
ready while A2P, SMS, public-beta, or launch gates are closed.

## Rollback

Rollback remains runbook-driven:
- keep or restore `SMS_SENDS_DISABLED=true`
- keep `PUBLIC_BETA_ENABLED=false`
- keep `PUBLIC_LAUNCH_ENABLED=false`
- pause waitlist/admissions
- preserve audit logs

## Incident Handling

Use the incident and data incident runbooks for unexpected outbound SMS, data exposure, duplicate replies, unsafe LLM output, or public flags being enabled accidentally.

## Out Of Scope

This does not add:
- live SMS sending
- public launch
- design partner invites
- production Saga app integration
- ticketing, RSVP, QR, payments, event publishing, or production Saga permissions
