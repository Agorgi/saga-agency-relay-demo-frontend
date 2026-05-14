# Admin Route Inventory v0.2

This inventory documents every admin page under `src/app/admin`. No routes are
deleted or renamed in v0.2. The sidebar labels are plain-English aliases only.

| Route | Current label | Plain label | Category | Priority | Redundant? | Combine later? | Direct only? | Operator purpose |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Admin sign in | Admin Sign In | Authentication | Secondary | No | No | Yes | Sign in to the protected admin portal. |
| `/admin/command-center` | Command Center | Command Center | Command Center | Primary | No | No | No | See current stage, blockers, and next safe action. |
| `/admin/needs-attention` | Needs Attention | Needs Attention | Needs Attention | Primary | No | No | No | Review approvals, failures, and warnings that need operator action. |
| `/admin/projects` | Project Briefs | Project Briefs | Projects | Primary | No | `/admin/network-projects` | No | Review inbound ideas and producer briefs. |
| `/admin/projects/[id]` | Project detail | Project Brief Detail | Projects | Primary | No | No | Yes | Inspect one project brief and its review-only workflow. |
| `/admin/network-projects` | Network Projects | Projects | Projects | Secondary | Yes | `/admin/projects` | No | Review canonical standalone project records created from briefs or imports. |
| `/admin/network-projects/[id]` | Network project detail | Project Detail | Projects | Secondary | Yes | `/admin/projects/[id]` | Yes | Inspect one canonical project record. |
| `/admin/role-openings` | Role Openings | Staffing Needs | Projects | Secondary | Yes | `/admin/opportunities` | No | Review roles a project may need. |
| `/admin/opportunities` | Opportunities | Opportunities | Projects | Secondary | Yes | `/admin/role-openings` | No | Review opportunity records attached to staffing needs. |
| `/admin/tasks` | Tasks | Tasks | Projects | Primary | No | No | No | Track tasks and blocked work. |
| `/admin/interest-checks` | Interest Checks | Interest Checks | Projects | Primary | No | No | No | Review ideas people want to see exist. |
| `/admin/people` | People | People | Talent | Primary | No | No | No | Review people records in the standalone database. |
| `/admin/creator-profiles` | Creator Profiles | Creator Profiles | Talent | Primary | No | No | No | Review creator and gig-seeker profiles. |
| `/admin/contacts` | Contacts | Contacts | Talent | Primary | No | No | No | Review contacts with redacted contact details. |
| `/admin/relationships` | Relationships | Relationships | Talent | Secondary | No | No | No | Review relationship evidence used by matching. |
| `/admin/sourcing` | Talent Sourcing | Talent Search | Sourcing | Primary | No | No | No | Find possible collaborators using internal data and reviewed research. |
| `/admin/matching` | Smart Matching | Smart Matching | Sourcing | Primary | No | `/admin/candidate-graph` | No | Rank candidates for a project with explainable scores. |
| `/admin/sourcing-quality` | Candidate Quality Review | Candidate Reviews | Sourcing | Primary | No | No | No | Review candidate quality before shortlist consideration. |
| `/admin/sourcing/public-web` | Public Talent Research | Public Web Research | Sourcing | Primary | No | No | No | Queue or review gated public research plans without contacting anyone. |
| `/admin/sourcing/public-web-review` | Research Review | Research Cleanup | Sourcing | Primary | No | No | No | Review, discard, archive, and clean up public research results. |
| `/admin/candidate-graph` | Talent Map | Talent Map | Advanced | Advanced | Yes | `/admin/matching` | No | Debug graph evidence behind smart matching. |
| `/admin/recommendations` | Recommendations | Recommendations | Advanced | Advanced | Yes | `/admin/matching` | No | Review legacy recommendation records. |
| `/admin/matching-evaluation` | Matching Evaluation | Matching Evaluation | Advanced | Advanced | No | No | No | Run synthetic matching QA and tuning reports. |
| `/admin/outbound-drafts` | Outreach Drafts | Outreach Drafts | Messages | Primary | No | No | No | Review draft-only outreach and shortlist copy. |
| `/admin/groupchats` | Group Chats | Group Chats | Messages | Primary | No | No | No | Review group chat planning records; no chats are created automatically. |
| `/admin/outreach` | Outreach Log | Outreach Log | Advanced | Advanced | Yes | `/admin/outbound-drafts` | No | Inspect legacy outreach records without sending anything. |
| `/admin/llm-review` | AI Reply Review | AI Reply Review | Quality & Safety | Primary | No | Response Tuning | No | Review AI-assisted replies and tuning needs. |
| `/admin/transcript-dry-runs` | Transcript Dry Runs | Transcript Dry Runs | Quality & Safety | Primary | No | No | No | Run simulated conversations and inspect reply quality. |
| `/admin/audit` | Audit Log | Audit Log | Quality & Safety | Primary | No | No | No | Review redacted audit events. |
| `/admin/observability` | System Health | System Health | Operations | Primary | Yes | `/admin/pipeline` | No | Review redacted health and risk signals. |
| `/admin/pipeline` | Pipeline | Pipeline | Operations | Primary | Yes | `/admin/observability` | No | Review message processing jobs and blocked sends. |
| `/admin/data-ops` | Data Tools | Data Tools | Operations | Primary | No | No | No | Export, redact, and review pilot data safely. |
| `/admin/launch-drill` | Launch Checklist | Launch Checklist | Operations | Primary | No | No | No | Run dry launch readiness checks. |
| `/admin/public-beta` | Public Beta Waitlist | Public Beta | Operations | Primary | No | `/admin/access` | No | Inspect public beta readiness and waitlist state. |
| `/admin/access` | Public Beta Access | Public Beta Access | Operations | Secondary | Yes | `/admin/public-beta` | No | Review access decisions, caps, and waitlist behavior. |
| `/admin/pilot` | Pilot Overview | Pilot Overview | Operations | Secondary | No | No | No | Check pilot mode, safety gates, and pilot counters. |
| `/admin/pilot-participants` | Pilot Participants | Pilot Participants | Operations | Secondary | No | No | No | Review pilot participant state with redacted contact display. |
| `/admin/pilot-feedback` | Pilot Feedback | Pilot Feedback | Operations | Secondary | No | No | No | Review pilot feedback notes. |
| `/admin/beta-simulations` | Beta Simulations | Beta Simulations | Operations | Secondary | No | No | No | Run simulated cohorts before inviting real people. |
| `/admin/dev` | Admin Dev Lab | Dev Lab | Advanced | Advanced | No | No | No | Use developer/demo tools that run without Twilio. |

## Notes

- `Network Projects` is confusing because operators see it next to `Project
  Briefs`. In v0.2 it is labeled `Projects` and marked as a future consolidation
  candidate.
- `Role Openings` and `Opportunities` are related staffing concepts and should
  be evaluated for a combined Staffing page.
- `Candidate Graph`, `Recommendations`, and `Matching Evaluation` are useful
  but advanced for most operators, so they are grouped under Advanced.
- `Pipeline` remains direct in Operations because failed jobs can require
  immediate review.
