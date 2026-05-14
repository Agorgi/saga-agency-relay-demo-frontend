# Admin Page Consolidation Plan v0.2

This is an audit only. v0.2 does not delete, merge, or rename routes. It makes
the sidebar easier to use and records where future consolidation should happen.

## Keep Primary

- Command Center
- Needs Attention
- Project Briefs
- Tasks
- Interest Checks
- People
- Creator Profiles
- Contacts
- Talent Search
- Smart Matching
- Candidate Reviews
- Public Web Research
- Research Cleanup
- Outreach Drafts
- Group Chats
- AI Reply Review
- Transcript Dry Runs
- Audit Log
- System Health
- Pipeline
- Data Tools
- Launch Checklist
- Public Beta

## Move Under Advanced

- Dev Lab
- Talent Map / Candidate Graph
- Recommendations
- Matching Evaluation
- Outreach Log

These pages are still reachable. They are just less prominent for non-technical
operators.

## Combine In A Future Pass

- Project Briefs + Network Projects
- Role Openings + Opportunities
- Smart Matching + Candidate Graph + Recommendations
- AI Reply Review + Response Tuning
- System Health + Pipeline
- Public Beta + Public Beta Access

## Specific Answers

### What is Network Projects for?

Network Projects are canonical standalone project records that can come from
SMS briefs, admin work, interest checks, imports, or future Saga surfaces. They
are more structured than Project Briefs.

### Should Network Projects be folded into Projects?

Yes, likely. Operators should not need to understand two separate project
concepts. A future pass should make Project Briefs the intake/review tab and
Network Projects the canonical/project-record tab under one Projects page.

### Should Role Openings and Opportunities become one Staffing page?

Yes. Role Openings describe what a project needs; Opportunities describe how
those roles become visible or actionable. A combined Staffing Needs page would
be clearer.

### Should Matching, Candidate Graph, and Recommendations become one Smart Matching page?

Mostly yes. Smart Matching should be the primary page. Candidate Graph can
become a diagnostic tab, and Recommendations can become a legacy/results tab.

### Should LLM Review and Response Tuning become one AI Reply Review page?

Yes. Response Tuning is a filter or tab inside AI Reply Review, not a separate
operator concept.

### Should Observability and Pipeline become one System Health page?

Eventually yes, but not immediately. Pipeline failures deserve a direct route
because operators need a quick place to inspect failed jobs. A future System
Health page can include Pipeline as a tab.

## Pages That Need Clearer Purpose

- Network Projects: explain canonical project record vs inbound brief.
- Opportunities: explain relationship to role openings.
- Recommendations: explain legacy vs smart matching results.
- Pipeline: separate pending replies from processing jobs.
- Dev Lab: clearly mark as advanced only.

## Out Of Scope

This plan does not enable SMS, public beta, public launch, candidate outreach,
group chats, public web research, production Saga app integration, ticketing,
RSVP, QR, payments, or production data imports.
