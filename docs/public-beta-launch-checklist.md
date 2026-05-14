# Public Beta Launch Checklist

This checklist is for a future capped public beta candidate. It does not enable
public beta or public launch.

## Required Preconditions

- Private beta passed and reviewed.
- Capped public beta capacity set.
- `PUBLIC_BETA_ENABLED=true` only after explicit approval.
- `PUBLIC_BETA_LANDING_ENABLED=true` only after landing copy and support links are approved.
- `PUBLIC_BETA_WAITLIST_ENABLED=true` only after waitlist and consent review.
- `PUBLIC_BETA_PUBLIC_NUMBER_VISIBLE=false` until an explicit public-number approval.
- `PUBLIC_BETA_REQUIRE_INVITE_CODE=true` unless intentionally changed by launch review.
- `PUBLIC_BETA_REQUIRE_CONSENT=true`.
- `PUBLIC_LAUNCH_ENABLED=false` until the final public-live step.
- Support contact ready.
- Privacy URL ready.
- Terms URL ready.
- Public opt-in language reviewed.
- STOP/START/HELP behavior tested.
- Rate caps and cost caps ready.
- Abuse and spam controls ready.
- Incident response process ready.
- Production observability green.
- Launch readiness drill complete or explicitly approved.
- `CAPPED_PUBLIC_BETA_100` and over-capacity simulations passed with no
  safety-critical failures or cap bypasses.

## Engineering Review

Review:

- Access control and participant caps.
- Messaging pipeline mode; `async_active` must not be enabled by accident.
- LLM mode; `active_live` must remain disabled unless separately approved.
- Data export/redaction/retention workflow.
- Rollback and incident runbooks.
- Public launch foundations.
- `/admin/public-beta` waitlist, consent, admission, and cap status.
- `docs/capped-public-beta-infrastructure.md` and
  `docs/public-beta-landing-copy.md`.

## Standalone Boundary

Production Saga app integration is not required for public beta candidate
status. Do not connect the main Saga app, production users, ticketing, RSVP, QR,
payment, event publishing, or production Saga permissions as part of this
checklist.
