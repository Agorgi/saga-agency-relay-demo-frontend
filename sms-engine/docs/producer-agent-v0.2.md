# Producer Agent v0.2

Producer Agent v0.2 adds the first human approval queue after v0.1 generates
project understanding, role maps, sourcing plans, internal candidate
recommendations, and draft shortlist copy.

This approval workflow is for candidate recommendations and organizer-facing
shortlist packets only. It is not an approval workflow for ordinary conversation
replies.

## Candidate Review Workflow

Candidate recommendations can be reviewed from the project detail page. Admins
can mark each recommendation as:

- `SUGGESTED`
- `APPROVED_FOR_SHORTLIST`
- `REJECTED`
- `NEEDS_MORE_INFO`
- `CONTACT_LATER`
- `DO_NOT_CONTACT`

Existing downstream statuses still exist for future/manual workflows:
`APPROVED`, `CONTACTED`, `INTERESTED`, `DECLINED`, `SHORTLISTED`,
`ADDED_TO_TEAM`, and `REJECTED`.

Candidate review supports admin notes, a shortlist reason override, and an
organizer-facing summary override. Internal notes are not included in
organizer-facing packet fields.

Talent Discovery v0.1 can promote only internal, reviewed `TalentCandidate`
records into this candidate-review workflow. Public-web candidates remain
`NEEDS_MORE_INFO` until a human verifies evidence and links them to an
appropriate internal record. See `docs/talent-discovery-engine-v0.1.md`.

Rules:

- `APPROVED_FOR_SHORTLIST` means the candidate may appear in a draft shortlist
  packet for admin review.
- `REJECTED`, `NEEDS_MORE_INFO`, `CONTACT_LATER`, and `DO_NOT_CONTACT` do not
  appear in organizer-facing shortlist packets.
- `DO_NOT_CONTACT` candidates are skipped by mock outreach approval.
- Opted-out people cannot be approved for shortlist.
- No candidate review action sends SMS, creates outreach, confirms team
  membership, or creates a group chat.

## Shortlist Packet Workflow

Shortlist packets are durable admin-review objects created from
`APPROVED_FOR_SHORTLIST` candidate recommendations.

Packet statuses:

- `DRAFT`
- `NEEDS_REVIEW`
- `APPROVED`
- `REJECTED`
- `SENT` (future compatibility only; this phase does not send packets)

Packet generation:

- Includes only `APPROVED_FOR_SHORTLIST` candidates.
- Groups coverage by role.
- Shows roles covered and roles still missing.
- Produces organizer-facing copy with explicit "not confirmed" / "for
  consideration" language.
- Stores candidate summaries without raw phone numbers, raw emails, private
  notes, or internal risk notes.

## Approval Gates

A shortlist packet can be approved only when:

- It is linked to a `ProjectBrief` or `Project`.
- Status is `DRAFT` or `NEEDS_REVIEW`.
- At least one candidate summary exists.
- Organizer-facing text does not expose raw phone numbers or emails.
- Organizer-facing text does not expose private/admin/internal notes.
- Forbidden claim checks pass.
- The copy clearly states candidates are not confirmed or are only for
  consideration.

Approving a packet:

- Updates status to `APPROVED`.
- Writes an audit log.
- Does not send SMS.
- Does not contact candidates.
- Does not contact the organizer.
- Does not create outreach.
- Does not create a group chat.

## Audit Events

- `producer.candidate_reviewed`
- `producer.candidate_approved_for_shortlist`
- `producer.candidate_rejected`
- `producer.candidate_needs_more_info`
- `producer.shortlist_packet_generated`
- `producer.shortlist_packet_edited`
- `producer.shortlist_packet_approved`
- `producer.shortlist_packet_rejected`

Audit metadata includes safe IDs, old/new statuses, counts, and safety-check
results. It must not include secrets, raw phone numbers, raw emails, or private
notes in organizer-facing fields.

## Relationship To v0.1

Producer Agent v0.1 creates draft intelligence. Producer Agent v0.2 adds the
human review layer that decides which internal recommendations are safe to place
in a shortlist packet.

Producer Agent v0.3 builds on approved v0.2 artifacts by creating review-only
organizer shortlist and candidate outreach drafts. Draft approval remains
internal readiness only and is documented in `docs/producer-agent-v0.3.md`.

Talent Research Quality Review v0.2 adds an evidence-quality gate before
candidates can be promoted through shortlist workflows. Public-web candidates
must have an approved `TalentResearchReview`; rejected, needs-more-research,
needs-admin, opted-out, or do-not-contact candidates are blocked. Internal
approved profiles can still move through admin review more quickly, but private
notes and raw contact details remain excluded from organizer-facing text.

Conversation Engine v0.1 remains responsible for text conversation planning.
It is still shadow-only for Twilio staging and active only in mock/admin
simulation where allowed.

## What It Does Not Do

- No live SMS enablement.
- No autonomous candidate outreach.
- No autonomous organizer shortlist sends.
- No group chat creation.
- No confirmed availability, rates, payment, booking, attendance, ticket sales,
  venue access, team placement, celebrity/influencer participation, or paid work
  claims.
- No public web sourcing.
- No active public web research by default; research plans and candidate cards
  remain admin-reviewed and citation-required.
- Public Web Research Shadow Mode v0.3 and Live Dry Run v0.4 remain admin
  review-only paths and cannot bypass quality review, shortlist approval,
  outreach gates, or do-not-contact blocks.
- No production Saga app integration.
- No event publishing, ticketing, ticket sales, QR, RSVP, payment, production
  Saga permission, or production Saga app data behavior.

## Tests

Run:

```bash
npm run test:producer-approval-queue
```

The test uses deterministic fixtures only. It verifies review statuses,
shortlist packet filtering, approval safety gates, organizer-facing privacy,
forbidden-claim checks, and no SMS/Twilio/group-chat side effects.

Candidate Graph v0.6b can promote a ranked match only into review/shortlist
workflow states. It still respects Producer Agent v0.2 approval gates:
do-not-contact, opted-out, rejected, needs-more-research, private notes, raw
contact details, and unsupported availability/booking claims remain blockers.
