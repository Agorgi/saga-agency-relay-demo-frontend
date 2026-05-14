# Outreach Channel Policy

This policy supports future outreach readiness. It does not enable outreach.
Public-web contactability evidence is not consent, permission, or an instruction
to contact anyone.

## SMS

- Requires opt-in/consent and A2P compliance.
- Do not SMS public-web candidates unless they explicitly opted in or are an
  already known approved contact.
- `SMS_SENDS_DISABLED=true` remains the safe default.

## Email

- Business-facing public emails may be possible later after legal/operator
  review.
- Future email outreach must use honest sender identity, honest subject lines,
  required business/contact information where applicable, and opt-out handling.
- Do not bulk-send without review.

## Instagram and Social DMs

- Store public profile URLs/handles only as possible contactability evidence.
- Do not automate DMs in this phase.
- Future DM flows must use approved platform/API flows or a human-admin process.
- Do not scrape private/login-gated data or bypass platform rules.

## Contact Forms and Booking Links

- Public booking links and contact forms are generally safer than personal phone
  numbers.
- They still require admin review.
- Do not auto-submit forms in this phase.

## Agency or Manager Contact

- Can be marked lower risk when clearly business-facing.
- Still requires admin review.

## Public Phone Numbers

- High risk by default.
- Do not call or text unless clearly business-facing and compliance/consent
  rules are satisfied.
- Do not expose public phone numbers to organizers.

## Overrides

Do-not-contact and opt-out status override every contactability signal. No
channel should become organizer-facing by default.

## Candidate Graph Use

Candidate Graph v0.6a may index contactability score and review status for
admin matching readiness. That score is not permission to contact someone. A
candidate still needs quality review, contactability review, channel-specific
policy review, and explicit admin approval before any future outreach draft can
be considered. v0.6a does not send email, SMS, DMs, contact forms, or group-chat
invites.

Relationship-aware matching v0.6b may use contactability readiness as one
ranking dimension, but this is still not outreach permission. Match results can
be promoted only into review/shortlist workflows and must not create outreach
drafts, send messages, reveal raw contact details to organizers, or create group
chats.
