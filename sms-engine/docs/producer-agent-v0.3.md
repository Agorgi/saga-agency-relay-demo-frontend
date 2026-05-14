# Producer Agent v0.3

Producer Agent v0.3 adds a review-only outbound draft queue for organizer
shortlist messages and candidate outreach copy. Drafts are admin-editable and
approvable, but approval does not send SMS, create outreach, contact anyone, or
create group chats.

## Purpose

v0.1 generates project understanding, role maps, sourcing plans, internal
candidate recommendations, and shortlist draft intelligence. v0.2 adds human
review for candidate recommendations and shortlist packets. v0.3 turns approved
review artifacts into outbound copy drafts that remain inside admin.

Talent Discovery v0.1 feeds this flow only through admin-reviewed internal
candidates promoted into `CandidateRecommendation`. Public-web research
candidates cannot produce outreach drafts directly.

LLM Provider Integration v0.1 may assist draft wording through structured,
validated output in fallback, shadow, or mock/admin modes. It does not remove
admin review, approval gates, forbidden-claim checks, or the no-send boundary.

## Draft Types

- `ORGANIZER_SHORTLIST`: copy for sharing an approved `ShortlistPacket` with an
  organizer in a future manually reviewed send flow.
- `CANDIDATE_OUTREACH`: copy for asking an approved candidate whether they are
  open to being considered.
- `ADMIN_MANUAL`: reserved for future manually authored draft copy.

Draft statuses:

- `DRAFT`
- `NEEDS_REVIEW`
- `APPROVED`
- `REJECTED`
- `BLOCKED`
- `SENT` (future compatibility only; this phase never sends)

## Organizer Shortlist Draft Workflow

Admins can prepare organizer-facing draft copy from an approved
`ShortlistPacket`.

Rules:

- Includes only candidates already present in the approved shortlist packet.
- Frames candidates as not confirmed and only for consideration.
- Mentions missing roles or research gaps when available.
- Does not expose private notes, raw phone numbers, or raw emails.
- Does not claim candidates are confirmed, available, booked, contacted, paid, or
  selected.
- Does not send SMS or contact the organizer.

## Candidate Outreach Draft Workflow

Admins can prepare candidate outreach drafts for recommendations marked
`APPROVED_FOR_SHORTLIST`.

Rules:

- Drafts are generated only for approved shortlist candidates who are not
  opted out.
- Copy asks whether the candidate is open to being considered.
- Copy does not imply selection, booking, confirmed payment, confirmed role,
  confirmed rate, or team membership.
- Copy does not reveal private organizer notes or internal risk notes.
- Any group-intro language must remain future, conditional, and consent-based.
- Approval does not create an `Outreach`, send SMS, or create a group chat.

## Admin Review

Admins can review drafts from the project detail page and from
`/admin/outbound-drafts`.

Admin actions:

- Generate organizer shortlist message draft.
- Generate candidate outreach drafts.
- Edit draft body.
- Add internal admin notes.
- Approve draft.
- Reject draft.

The UI labels the queue as draft-only. An approved draft means the copy cleared
the internal v0.3 safety gates; it is not permission to send.

Producer Agent v0.4 adds dry-run send readiness for approved drafts. It reports
blockers and required actions, but still does not send SMS or create outreach.
See `docs/producer-agent-v0.4.md`.

## Approval Gates

Before a draft can be approved:

- Status must be `DRAFT` or `NEEDS_REVIEW`.
- Draft must be linked to a `ProjectBrief` or `Project`.
- Organizer shortlist drafts must link to a `ShortlistPacket`.
- Candidate outreach drafts must link to a `CandidateRecommendation` and a
  candidate `Person` or `Contact`.
- Forbidden-claim checks must pass.
- Raw phone numbers, raw emails, private notes, admin notes, and internal-only
  notes must not appear in the outbound body.
- Organizer shortlist copy must say candidates are not confirmed or are for
  consideration.
- Candidate outreach copy must ask whether the candidate is open to being
  considered.

Approving a draft:

- Updates `OutboundDraft.status` to `APPROVED`.
- Writes an audit log.
- Does not send SMS.
- Does not create `Outreach`.
- Does not contact organizers or candidates.
- Does not create a group chat.

## Audit Events

- `producer.organizer_shortlist_draft_generated`
- `producer.candidate_outreach_draft_generated`
- `producer.outbound_draft_edited`
- `producer.outbound_draft_approved`
- `producer.outbound_draft_rejected`
- `producer.outbound_draft_blocked`

Audit metadata includes safe IDs, old/new statuses, draft type, block reasons,
and no-side-effect markers. It must not include secrets, raw phone numbers, raw
emails, or private notes in organizer-facing fields.

## What It Does Not Do

- No live SMS enablement.
- No autonomous candidate outreach.
- No autonomous organizer shortlist sends.
- No `Outreach` send state.
- No group chat creation.
- No confirmed availability, booking, rates, payment, attendance, ticket sales,
  venue access, team placement, celebrity/influencer participation, or paid work
  claims.
- No public web sourcing.
- No active public web research by default, and no public candidate can bypass
  admin review into outreach.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, QR, RSVP, payment, production
  Saga permission, or production Saga app data behavior.

## Talent Research Quality Gate

Candidate outreach drafts now respect the Talent Research Quality Review gate.
If a linked recommendation is blocked by `REJECTED`, `NEEDS_MORE_RESEARCH`,
`NEEDS_ADMIN`, or `DO_NOT_CONTACT`, draft generation remains blocked. Public-web
candidates cannot bypass quality review into outreach drafts.

Public Web Research Review & Cleanup v0.5 adds an additional contactability
gate for future outreach readiness. A public-web result must have reviewed,
non-blocked contactability evidence before it can ever be considered
contactable for admin review, and this still does not send email, SMS, social
DMs, contact-form submissions, or outreach drafts.

## Tests

Run:

```bash
npm run test:producer-outreach-drafts
```

The test uses deterministic fixtures only. It verifies organizer shortlist draft
privacy, candidate outreach copy safety, blocked draft states, approval gates,
audit event names, and no SMS/Twilio/outreach/group-chat side effects.
