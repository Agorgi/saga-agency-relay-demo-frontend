# Public Web Research Policy

Public web research is allowed only as an admin-reviewed candidate discovery
input for the standalone Saga SMS Producer app. It is disabled by default and
must never become autonomous outreach.

## Allowed Sources

- Public portfolio websites.
- Public personal or creator websites.
- Public Instagram, TikTok, YouTube, LinkedIn, or similar profile pages when
  reachable through public search without logging in.
- Public event/vendor directories.
- Public convention artist, vendor, exhibitor, or guest pages.
- Public press, creator pages, or project pages that directly support role-fit
  evidence.

## Disallowed Sources

- Private or login-gated pages.
- DMs, private messages, private groups, subscriber-only spaces, or scraped
  community forums.
- Personal sensitive data such as home address, protected-class inference,
  private health, legal, financial, or family information.
- Contact extraction from non-public sources.
- Any source that requires account login, bypassing controls, or violating a
  site's terms.

## Citation Requirements

Every public-web candidate card must include source URLs. A candidate without
source URLs is invalid and must not enter the active review queue as a public
candidate.

Admin review should check:

- the source URL exists and is public
- the evidence actually supports the role
- the source is recent enough to be useful
- the candidate is not being described with unverifiable claims
- no private or sensitive data is included

## Sensitive-Data Rules

Do not store raw phone numbers, raw emails, private notes, DMs, scraped private
content, or sensitive inferences from public research. If a public profile
contains contact details, do not copy them into organizer-facing fields. Store
only the public profile URL and evidence summary needed for admin review.

## No Outreach

Public research does not authorize contact. Talent Discovery can produce a
candidate card and admin status only. Candidate outreach remains a separate,
approval-gated draft workflow and must not be sent automatically.
Contactability evidence is evaluated only for future admin review; follow
`docs/outreach-channel-policy.md` before any later channel-specific outreach
design. The current system must not send SMS, email, social DMs, contact-form
submissions, or organizer-facing contact details.

## No Availability Claims

Do not claim a public candidate is available, interested, affordable, confirmed,
booked, paid, willing, or placed on a team. Public research can say only that a
candidate may be worth reviewing based on public evidence.

## Retention And Redaction

Public research candidates should be kept only as long as needed for sourcing
review. If a candidate is incorrect, sensitive, or asks to be removed, mark the
candidate `DO_NOT_CONTACT` or redact/delete the research record according to the
pilot data-ops runbooks.

Relevant docs:

- `docs/pilot-data-retention.md`
- `docs/pilot-data-incident-runbook.md`
- `docs/pilot-data-inventory.md`

## Incorrect Candidates

If a candidate is misidentified or evidence is weak:

1. Mark the record `NEEDS_MORE_INFO`, `REJECTED`, or `DO_NOT_CONTACT`.
2. Preserve the audit trail without preserving raw sensitive details.
3. Add a short admin note only if needed for future reviewers.
4. Do not contact the person to clarify unless a future human-approved outreach
   process permits it.

## Disabled By Default

```bash
PUBLIC_WEB_RESEARCH_ENABLED=false
PUBLIC_WEB_RESEARCH_MODE=disabled
PUBLIC_WEB_RESEARCH_PROVIDER=none
PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS=false
PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=false
PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS=
PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS=
```

Shadow, live dry-run, and future admin-active modes remain admin-only, require
citations, and still cannot send SMS, create group chats, publish shortlists,
invite users, or connect to production Saga app data.

## Shadow Mode v0.3

`/admin/sourcing/public-web` shows public-web plans in shadow mode. The live
OpenAI web-search provider is not injected from shadow. Public Web Research Live
Dry Run v0.4 can run one safe demo query only when
`PUBLIC_WEB_RESEARCH_ENABLED=true`, `PUBLIC_WEB_RESEARCH_MODE=live_dry_run`,
`PUBLIC_WEB_RESEARCH_PROVIDER=openai_web_search`,
`PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED=true`, `SMS_SENDS_DISABLED=true`, and
the other gates in `docs/public-web-research-live-dry-run-v0.4.md` pass.
Public Web Research Async Dry Run v0.4.1 queues that live dry-run work into
`PublicWebResearchJob` and processes it from CLI/worker context to avoid Railway
HTTP proxy timeouts.
After the initial live provider call returned `invalid_schema:400`, the OpenAI
provider was changed to a two-step flow: Responses `web_search` first for cited
summary/source capture, followed by a no-tool structured extraction pass. Do not
recombine web search and complex candidate-card schema generation in the same
provider request without a new dry-run review.
Results are stored as `PublicWebResearchRun` / `PublicWebResearchResult` records
and may create `TalentCandidate` records with `source=PUBLIC_WEB_RESEARCH` and
`status=NEEDS_MORE_INFO`.

## Review and Cleanup v0.5

`/admin/sourcing/public-web-review` is the review/cleanup surface for existing
public-web results. It normalizes citations, scores source quality, detects
duplicates, records contactability evidence, and lets admins discard, archive,
mark duplicate, mark do-not-contact, or send a result to Talent Research Quality
Review. Contactability evidence is not permission to contact. Outreach remains
disabled.

Shadow results are research-only. They cannot create outreach, group chats, or
organizer-facing shortlist entries. Each result must pass the public-web safety
checker and Talent Research Quality Review before an admin can consider it for a
shortlist workflow.

## Talent Research Quality Gate

Every public-web candidate must pass Talent Research Quality Review before it
can be promoted. Required checks include source URLs, clear identity, role-fit
evidence, location/community support where relevant, no private/login-gated
source, no raw contact-info leakage, and no unsupported availability, rate,
payment, booking, or willingness claims.

The default outcome for public-web candidates is `NEEDS_MORE_RESEARCH` unless
evidence is strong and an admin explicitly marks the review
`APPROVED_FOR_SHORTLIST`. See `docs/talent-research-quality-v0.2.md`.
