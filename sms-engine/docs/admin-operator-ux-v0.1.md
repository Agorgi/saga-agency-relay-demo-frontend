# Admin Operator UX v0.1

## Purpose

Admin UX + Navigation Simplification v0.1 turns the admin portal into an
operator console instead of a flat developer dashboard. The goal is that a
non-technical operator can start at Command Center, understand the current
stage, and find the right work area without reading 30 unrelated links.

This is UX/navigation only. It does not enable live SMS, public beta, public
launch, public web research, candidate outreach, group chats, production Saga
app integration, ticketing, RSVP, QR, payments, or production data imports.

## Sidebar Structure

v0.2 updates this structure with a fixed Needs Attention link and shorter
sidebar labels. See `docs/admin-info-architecture-v0.2.md` and
`docs/admin-route-inventory-v0.2.md`.

Command Center stays pinned at the top. Everything else is grouped by the job
the operator is trying to do:

1. Command Center
2. Pilot & Launch
3. Projects
4. Talent Network
5. Sourcing & Matching
6. Messages & Outreach
7. Quality & Safety
8. Test Lab / Advanced

Advanced pages remain reachable under Test Lab / Advanced rather than being
hidden.

## Page Naming Principles

Sidebar labels use plain English even when the route keeps its older technical
name:

- Candidate Graph -> Talent Map
- Relationship-Aware Matching -> Smart Matching
- Public Web Research -> Public Talent Research
- Launch Readiness Drill -> Launch Checklist
- Production Observability -> System Health
- Pilot Data Operations -> Data Tools
- LLM Quality Review -> AI Reply Review

Routes were not renamed.

## Active State Behavior

- The current page is highlighted in the sidebar.
- Nested project pages highlight their parent item.
- The active section opens automatically.
- Operators can collapse and expand sections.
- Open/closed section state is saved in local storage when available.
- No page becomes unreachable if local storage is unavailable.

## Command Center Purpose

Command Center is the operator home base. The top of the page shows:

- current stage
- overall status
- next recommended action
- top blockers
- critical warnings

The primary cards use plain-language safety status:

- SMS Safety
- A2P / Compliance
- Pilot Readiness
- Public Beta Readiness
- LLM Status
- Pipeline Health
- Talent / Matching Status

Detailed technical sections still exist below for deeper inspection.

## Route Inventory

| Route | Old label | New label | Category | Audience | Sidebar |
| --- | --- | --- | --- | --- | --- |
| `/admin` | Admin sign in | Admin Sign In | Authentication | Operator | No |
| `/admin/command-center` | Command center | Command Center | Command Center | Operator | Yes |
| `/admin/pilot` | Pilot status | Pilot Overview | Pilot & Launch | Operator | Yes |
| `/admin/launch-drill` | Launch drill | Launch Checklist | Pilot & Launch | Operator | Yes |
| `/admin/beta-simulations` | Beta simulations | Beta Simulations | Pilot & Launch | Operator | Yes |
| `/admin/access` | Beta access | Public Beta Access | Pilot & Launch | Operator | Yes |
| `/admin/public-beta` | Public beta | Public Beta Waitlist | Pilot & Launch | Operator | Yes |
| `/admin/pilot-participants` | Pilot participants | Pilot Participants | Pilot & Launch | Operator | Yes |
| `/admin/pilot-feedback` | Pilot feedback | Pilot Feedback | Pilot & Launch | Operator | Yes |
| `/admin/projects` | Projects | Project Briefs | Projects | Operator | Yes |
| `/admin/projects/[id]` | Project detail | Project Brief Detail | Projects | Operator | Parent |
| `/admin/network-projects` | Network projects | Network Projects | Projects | Operator | Yes |
| `/admin/network-projects/[id]` | Network project detail | Network Project Detail | Projects | Operator | Parent |
| `/admin/role-openings` | Roles | Role Openings | Projects | Operator | Yes |
| `/admin/opportunities` | Opportunities | Opportunities | Projects | Operator | Yes |
| `/admin/tasks` | Tasks | Tasks | Projects | Operator | Yes |
| `/admin/interest-checks` | Interest checks | Interest Checks | Projects | Operator | Yes |
| `/admin/people` | People | People | Talent Network | Operator | Yes |
| `/admin/creator-profiles` | Creators | Creator Profiles | Talent Network | Operator | Yes |
| `/admin/contacts` | Contacts | Contacts | Talent Network | Operator | Yes |
| `/admin/relationships` | Relationships | Relationships | Talent Network | Operator | Yes |
| `/admin/sourcing` | Sourcing | Talent Sourcing | Sourcing & Matching | Operator | Yes |
| `/admin/sourcing/public-web` | Web research | Public Talent Research | Sourcing & Matching | Operator | Yes |
| `/admin/sourcing/public-web-review` | Web review | Research Review | Sourcing & Matching | Operator | Yes |
| `/admin/sourcing-quality` | Sourcing quality | Candidate Quality Review | Sourcing & Matching | Operator | Yes |
| `/admin/candidate-graph` | Candidate graph | Talent Map | Sourcing & Matching | Operator | Yes |
| `/admin/matching` | Matching | Smart Matching | Sourcing & Matching | Operator | Yes |
| `/admin/matching-evaluation` | Matching eval | Matching Evaluation | Sourcing & Matching | Operator | Yes |
| `/admin/recommendations` | Recommendations | Recommendations | Sourcing & Matching | Operator | Yes |
| `/admin/outbound-drafts` | Outbound drafts | Outreach Drafts | Messages & Outreach | Operator | Yes |
| `/admin/outreach` | Outreach | Outreach Log | Messages & Outreach | Operator | Yes |
| `/admin/groupchats` | Group chats | Group Chats | Messages & Outreach | Operator | Yes |
| `/admin/pipeline` | Pipeline | Pending Replies & Jobs | Messages & Outreach | Operator | Yes |
| `/admin/observability` | Observability | System Health | Quality & Safety | Operator | Yes |
| `/admin/audit` | Audit | Audit Log | Quality & Safety | Operator | Yes |
| `/admin/llm-review` | LLM review | AI Reply Review | Quality & Safety | Operator | Yes |
| `/admin/transcript-dry-runs` | Transcript dry runs | Transcript Dry Runs | Quality & Safety | Operator | Yes |
| `/admin/data-ops` | Data ops | Data Tools | Quality & Safety | Operator | Yes |
| `/admin/dev` | Test lab | Admin Dev Lab | Test Lab / Advanced | Advanced | Yes |

## Operator Guidance

If an operator is unsure where to go, start with Command Center. Use the grouped
sidebar to move from high-level readiness into the specific work area:

- use Pilot & Launch for readiness and gate checks
- use Projects for project briefs and role needs
- use Sourcing & Matching for candidate research and ranking
- use Quality & Safety for health, audits, transcript review, and data tools
- use Test Lab / Advanced only when a developer or lead operator asks for it

## Out Of Scope

This release does not change SMS behavior, Twilio configuration, public beta
gates, LLM modes, candidate review rules, matching algorithms, public web
research gates, or production app integration.
