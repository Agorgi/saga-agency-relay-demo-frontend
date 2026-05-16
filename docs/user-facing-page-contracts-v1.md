# User-Facing Page Contracts v1

## Landing Chat

- Sagasan stays in conversation until the organizer brief is ready enough to review.
- Host users should see brief progress, what is known, and what is missing.
- `Review brief` can appear once a partial brief is ready.
- `Build my event` should not appear after only idea plus city.

## `/projects/new`

- This is the brief review surface.
- If the brief is partial, unknown fields should say `Not answered yet.`
- The page should show progress and missing essentials clearly.
- `Keep answering` returns the user to Sagasan with the brief context preserved.
- `Build plan` appears only when the production-plan threshold is met.
- `Find my crew` appears only when the talent-search threshold is met.

## `/explore`

- Explorer should use the current brief, not a hardcoded seed demo, when a host handoff exists.
- If talent search is not ready, explorer should block with the missing fields and a `Return to brief` action.
- Explorer should not imply outreach, contact, confirmation, or booking.

## `/me`

- Creative handoffs should preserve only creative-relevant context.
- Host event vibe or timing should not bleed into creative availability.

## `/relay`

- Relay remains a gated downstream surface.
- If there is no selected candidate or approved context, the page should show an empty or blocked state.
- No outreach, terms, or booking should appear active without review context.

## Public Event Pages

- Public pages should not expose backstage or internal host data.
- Ticketing language should stay consistent with Sagasan’s chat boundary: tickets live elsewhere.
