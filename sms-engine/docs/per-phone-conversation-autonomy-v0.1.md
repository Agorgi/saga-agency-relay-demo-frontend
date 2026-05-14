# Per-Phone Conversation Autonomy Controls v0.1

## Purpose

Per-phone conversation autonomy lets an operator decide which known phone
numbers Saga may answer automatically during normal pilot conversation.

This is an autonomy permission layer only. It does not override global SMS
safety gates, compliance gates, allowlists, opt-out state, or human review
requirements.

## Autonomy Modes

| Mode | Plain-English meaning | What Saga may do |
|---|---|---|
| `MANUAL_REVIEW` | Off. An operator reviews replies. | Log inbound messages and create draft replies or reply plans. |
| `AUTONOMOUS_UNTIL_OUTREACH` | On for ordinary conversation only. | Continue normal FAQ, organizer intake, gig-seeker onboarding, interest-check, and clarification flows if every global SMS gate also allows it. |
| `PAUSED` | Temporarily stop automatic replies. | Log inbound messages and create a Needs Attention item for review. |

Unknown phone numbers default to `MANUAL_REVIEW`.

## What ON Means

When ON, Saga can keep a normal conversation moving with that person during an
approved pilot window. It can answer basic capability questions, collect project
details, onboard a creator/gig-seeker, or help shape an interest check.

ON still stops before any external action.

## What OFF Means

OFF means Saga can receive and persist inbound messages and may prepare draft
reply plans, but an operator must review before a reply moves forward.

## What PAUSED Means

PAUSED means inbound messages can still be logged, but automatic replies are
blocked and surfaced for admin review.

## Handoff Boundary

Saga must stop and create Needs Attention before:

- candidate outreach
- sending or showing shortlists
- group chat creation
- team confirmation
- public-web candidate contact
- rates, payments, contracts, permits, legal issues, or safety-sensitive issues
- any other external action

The suggested safe draft at that point is:

> I have enough to turn this into a production brief. The Saga team will review
> possible collaborators before anyone is contacted.

That draft still obeys global send gates and the per-phone autonomy setting.

## Global Gates Still Win

Per-phone autonomy does not override:

- `SMS_SENDS_DISABLED`
- `SMS_REQUIRE_ALLOWLIST`
- A2P/compliance approval
- STOP/opt-out
- provider readiness
- pilot stage and reply mode
- idempotency and send caps
- candidate outreach, shortlist, and group-chat review gates

## Admin Toggle

Operators can update the setting from:

- Contacts
- Pilot Participants

The UI label is **Autonomous SMS replies** with these options:

- Off — manual review
- On — autonomous until outreach
- Paused

The admin UI shows redacted phone display only.

## Needs Attention

Needs Attention surfaces:

- reply needs review before sending
- user is paused; review before replying
- project ready for candidate outreach approval
- candidate shortlist needs human review
- group chat creation requires approval
- payment/rate/legal/safety issue requires review
- opt-out or do-not-contact conflict

No Needs Attention item sends a message.

## What Remains Disabled

This phase does not enable live SMS, public beta, public launch, active live AI,
async-active processing, candidate outreach, emails, DMs, group chats, ticketing,
RSVP, QR codes, payments, production Saga app integration, or real user data
imports.
