# Admin Information Architecture + Needs Attention v0.2

## Purpose

v0.2 makes the admin portal easier for non-technical operators by reducing the
sidebar to clear job-based groups and adding a Needs Attention queue.

This is UX and approval visibility only. It does not enable live SMS, public
beta, public launch, live AI replies, candidate outreach, group chats, public
web research, production Saga app integration, ticketing, RSVP, QR, payments,
or production data imports.

## Sidebar Structure

1. Command Center
2. Needs Attention
3. Projects
4. Talent
5. Sourcing
6. Messages
7. Quality & Safety
8. Operations
9. Advanced

Command Center and Needs Attention are fixed top-level links, not dropdowns.
Advanced is collapsed by default.

## Sidebar Behavior

- Dropdowns can be opened and closed manually.
- Selecting a child page does not permanently lock the section open.
- Active parent sections open on first page load.
- Active items remain highlighted.
- Closed sections use a right chevron.
- Open sections use a down chevron.
- Item descriptions are removed from the sidebar to save space.
- Only sidebar content scrolls when the nav overflows.

## Needs Attention

`/admin/needs-attention` is a redacted operator queue for:

- pending outbound drafts
- blocked drafts
- shortlist packets needing approval
- candidate recommendations needing review
- public web research results needing review
- contactability evidence needing review
- AI replies needing review or tuning
- conversations marked `NEEDS_ADMIN`
- failed messaging pipeline jobs
- failed public web research jobs
- per-phone autonomy reply and handoff reviews
- critical safety or launch blockers

The summary includes:

- total count
- critical count
- review count
- warning count
- sidebar badge counts by work area

The service returns zero safely when the database is unavailable and never
includes raw phone numbers, emails, secrets, raw prompts, raw model outputs, or
private notes.

## Message Approval Visibility

Messages and drafts now surface through Needs Attention and the Messages badge.
The page copy states:

- approving a draft does not send while `SMS_SENDS_DISABLED` is on
- no message is sent unless all safety gates pass

There are no send buttons on the Needs Attention page.

Per-phone autonomy v0.1 adds review items when a phone is manual-review,
paused, or reaches candidate-outreach, shortlist, group-chat, payment/rate,
legal, or safety boundaries. These items are approval visibility only; they do
not send SMS.

## Plain Labels

- Production Observability -> System Health
- Launch Readiness Drill -> Launch Checklist
- Pilot Data Operations -> Data Tools
- LLM Quality Review -> AI Reply Review
- Relationship-Aware Matching -> Smart Matching
- Talent Discovery -> Talent Search
- Public Web Research Review & Cleanup -> Research Cleanup
- Network Projects -> Projects
- Role Openings -> Staffing Needs

URLs stay unchanged.

## Related Docs

- `docs/admin-route-inventory-v0.2.md`
- `docs/admin-page-consolidation-plan-v0.2.md`
- `docs/admin-operator-ux-v0.1.md`
- `docs/operator-command-center.md`
