# Design Partner Launch Checklist

This checklist is for a future invite-only 10-person design-partner pilot. It
does not start the pilot and does not enable SMS.

## Required Before Invites

- A2P/provider compliance approved.
- `SMS_COMPLIANCE_APPROVED=true` only after approval is documented.
- One-number outbound self-test passed exactly once.
- Internal team test passed.
- Ten or fewer design partners selected.
- Opt-in copy ready and reviewed.
- `SMS_ALLOWED_NUMBERS` set only to approved participants for the test window.
- `SMS_REQUIRE_ALLOWLIST=true`.
- Access control configured for design-partner/private beta stage.
- Feedback capture ready in `/admin/pilot-feedback`.
- Pilot data operations ready in `/admin/data-ops`.
- Production observability green or yellow, not red.
- Rollback drill completed.
- Incident drill completed.
- No open safety-critical bugs.
- No unresolved transcript dry-run safety-critical failures.
- `DESIGN_PARTNER_10` beta cohort simulation passed and is reviewed.

## Operator Preflight

1. Capture `/api/health`.
2. Capture `/admin/observability`.
3. Capture `/admin/launch-drill`.
4. Confirm no outbound SMS anomalies.
5. Confirm public launch disabled.
6. Confirm this app remains standalone.

## Still Out Of Scope

- Public number distribution.
- Production Saga app integration.
- Event publishing.
- Ticketing or ticket sales.
- RSVP.
- QR codes.
- Payments.
- Candidate outreach sends.
- Organizer shortlist sends.
- Group chat automation.
