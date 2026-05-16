# Feature Inventory

## Sagasan Web Chat

- Status: implemented
- Surface: `/`
- Purpose: route hosts, creatives, venues, and fans through a producer-style chat intake
- Guardrails: no public launch mode changes, no external contact, no ticket handling, no booking guarantees

## Host Brief Review

- Status: implemented
- Surface: `/projects/new`
- Purpose: review a partial or ready brief, continue intake, unlock production planning at the right threshold
- Guardrails: no premature `Find my crew`

## Host Crew Search

- Status: implemented with gating
- Surface: `/explore`
- Purpose: search mock or reviewed talent only when the brief has enough signal
- Guardrails: no outreach, no confirmation, no booking claims

## Creative Profile Handoff

- Status: implemented
- Surface: `/me`
- Purpose: preserve creative city, role, and portfolio context without host-brief bleed

## Venue and Fan Handoffs

- Status: implemented
- Surfaces: `/spaces`, `/feed`
- Purpose: route venue and fan users to the right next step without pretending Saga has already acted externally

## External Actions

- Status: gated
- Surfaces: relay, terms, booking-adjacent views
- Purpose: human-reviewed only
- Guardrails: no autonomous outreach, no live candidate contact, no group chat, no payment or ticketing execution
