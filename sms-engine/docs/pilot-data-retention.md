# Pilot Data Retention

This policy is for the standalone Saga SMS Producer design-partner/private-beta
database. It is not a production privacy policy and does not connect to the main
Saga production app.

## Default Retention

- Keep pilot data through the pilot, synthesis, and engineering review window.
- Review retention after each design-partner test batch.
- Keep sensitive admin notes only as long as they are needed.
- Keep audit logs long enough to investigate incidents and prove opt-out/send
  safety.

Recommended starting window: 90 days after a pilot batch ends, followed by an
operator review for export, redaction, or extended retention.

## Participant Opt-Out

When a participant opts out:

1. Mark `PilotParticipant.status=OPTED_OUT`.
2. Remove the number from `SMS_ALLOWED_NUMBERS` if present.
3. Preserve minimal opt-out evidence needed for compliance.
4. Do not send SMS.
5. Redact notes that are not needed for audit.

## Deletion or Redaction Requests

Prefer soft deletion and redaction:

- Pause or complete the participant.
- Redact `PilotParticipant.phoneHash`, `redactedPhone`, `email`, and notes.
- Redact conversation `Message.body` values when requested.
- Redact `PilotFeedback.notes` when requested.
- Preserve `AuditLog` records without preserving the redacted PII.

Hard deletion should be explicitly approved because relational data is useful
for incident review and idempotency.

## Preserve For Audit

- Opt-out status.
- Twilio MessageSid references.
- Idempotency records.
- Send-block/readiness blockers.
- Export/redaction audit events.
- Incident timestamps and record counts.

## Redact By Default

- Raw phone numbers.
- Emails.
- Message bodies in external exports.
- Admin notes.
- Feedback notes when no longer needed.
- Raw LLM prompts and outputs unless logging is explicitly enabled and the
  output is admin-review-safe.

## Never Collect

- Production Saga app data.
- Payment details.
- Ticketing, ticket sales, RSVP, QR, or event-publishing data.
- Secrets or environment values.
- Sensitive legal, medical, financial, or emergency details beyond what is
  needed to escalate safely.

## Twilio MessageSid Retention

Keep MessageSid values through the webhook/idempotency review window. They are
not phone numbers but are internal references and should not be published.

## LLM Review Retention

Keep `LlmReviewItem` records through prompt-quality review. Redact unsafe text
or private details before sharing outside the admin team.

## Feedback Exports

Feedback exports are admin-only, redacted by default, and should be treated as
product research notes. Do not publish raw participant feedback without explicit
permission and redaction review.

## Public Beta Waitlist And Consent

Retain `PublicBetaWaitlistEntry` and `ConsentEvent` records through the beta
review window so operators can audit consent, duplicate detection, admission
decisions, and cap usage.

Redact or soft-delete waitlist entries when requested:

- remove raw email display
- keep hashed email/phone only if needed for duplicate/opt-out review
- redact notes
- preserve consent/audit records without preserving unnecessary PII

Consent records do not authorize sending while `SMS_SENDS_DISABLED=true` and do
not bypass STOP/opt-out, compliance, allowlist, or public-launch gates.

## Simulation Runs

`BetaCohortSimulationRun` and `BetaCohortSimulationMemberResult` records are
synthetic-only launch planning evidence. They should be tagged and treated as
test data, excluded from real participant exports, and safely archived or
deleted when no longer useful. Never mix simulation members with real pilot
participants or production Saga app data.

## Standalone Boundary

Pilot data remains separate from the main Saga production app. Do not backfill,
join, or migrate pilot records into production Saga systems without a later
engineering review.
