# Design Partner Pilot Script v0.8

This is the operator-facing package for a future 10-person design-partner pilot.
It does not invite anyone, send SMS, publish the number, enable public beta,
enable public launch, or connect the production Saga app.

The pilot remains blocked until A2P/compliance is approved, the v0.9
one-number self-test plan is reviewed, the one-number self-test passes, the
internal-team test passes, and the launch readiness drill shows no
safety-critical blockers.

## Pilot Purpose

The design-partner pilot tests Saga SMS as a standalone AI producer interface.
The pilot should validate:

- Project intake for organizers and project-runners.
- Creator/gig-seeker onboarding.
- Interest checks for ideas people want to exist.
- Talent and team-building flow clarity.
- Trust, tone, usefulness, and next-step confidence.
- Operator visibility into what happened and why.

## Pilot Non-Goals

- No public launch.
- No public number sharing.
- No production Saga app integration.
- No ticketing, RSVP, QR codes, or payments.
- No promised event execution.
- No promised paid work.
- No autonomous candidate outreach.
- No group chat automation.
- No organizer shortlist sends.

## Ideal 10 Design Partner Mix

- 3 organizers or project-runners.
- 3 creators or gig-seekers.
- 2 fandom/community users with interest-check ideas.
- 1 vendor, venue, or operator type.
- 1 power user or edge-case tester.

## Invite Criteria

Invite only people who:

- Are trusted by the operator.
- Understand Saga SMS is in a private pilot.
- Are willing to give feedback.
- Are not relying on Saga for urgent or critical logistics.
- Explicitly opt in to SMS before allowlisting.
- Understand STOP and HELP behavior.

## Approved Pilot User Language

Use this language manually outside the app. Do not send it through Saga SMS.

Pre-invite:

> Saga SMS is in a private pilot. You can text Saga to plan a creative project,
> look for collaborators, join the creator network for gig opportunities, or
> check interest in an idea. Saga can help collect details, turn ideas into
> briefs, and suggest next steps. It does not guarantee bookings, paid work,
> event execution, team formation, logistics, ticket sales, venue access, or
> revenue. Reply STOP to opt out.

Opt-in:

> If you want to participate, reply with explicit consent before we add your
> number to the private pilot allowlist. Message and data rates may apply. Reply
> STOP to opt out or HELP for help.

What to text Saga first:

> Start with one sentence about what you want to do, what kind of gigs you want,
> or an idea you wish existed.

What Saga can help with:

> Saga can collect details, ask a useful next question, shape a brief or creator
> profile for review, and help the team understand possible next steps.

What Saga cannot promise:

> Saga cannot promise bookings, paid opportunities, event execution, confirmed
> teams, candidate availability, venue access, ticket outcomes, revenue, or
> public launch access.

How to give feedback:

> After your test, tell the operator what was clear, confusing, useful, or
> missing. You can also mention whether you would use it again.

How to opt out:

> Reply STOP to opt out. Reply HELP if you need help during the pilot.

## First-Message Scripts

These are examples for the operator to send manually, not through the app.

Organizer:

> Try texting Saga an idea for an event or creative project you would want to
> make.

Creator/gig-seeker:

> Try texting Saga what kind of gigs or creative projects you would want to be
> considered for.

Interest-check user:

> Try texting Saga something you wish existed, even if you do not want to
> organize it yourself.

Edge-case tester:

> Try asking Saga what it does, what it can help with, or what it cannot
> promise.

## Capability Response Alignment

Saga should follow the approved Capability / FAQ responses:

- "What do you do?" - explain that Saga shapes project ideas, creator profiles,
  and interest checks into pilot next steps.
- "How does this work?" - ask the user to describe what they are trying to do,
  then collect basics and point to the right next step.
- "Can you find me talent?" - explain that Saga can understand the project and
  look for relevant people for review. Candidates are not confirmed until
  reviewed and contacted.
- "Can you get me gigs?" - route toward creator/gig-seeker onboarding. Do not
  promise bookings or paid opportunities.
- "Can you guarantee paid work?" - set a boundary and flag firm-commitment
  questions for Saga team review.
- "Can you make my event happen?" - route toward organizer intake while making
  clear execution is not confirmed.
- "What happens next?" - ask the user to pick the right lane: project, gigs, or
  interest check.
- "Help" - mention project ideas, creator/gig profiles, interest checks, basic
  pilot questions, and STOP.

Capability replies must be concise and user-facing. Do not expose internal
systems, model providers, messaging providers, admin tools, review queues,
candidate graph internals, or production infrastructure.

## Monitoring Workflow

Before each pilot day:

- Check `/admin/command-center`.
- Check `/api/health`.
- Check Twilio outbound logs.
- Confirm `SMS_SENDS_DISABLED`, allowlist, and compliance state.
- Check observability risk.
- Check failed jobs.
- Check LLM fallback and failure rates.

During pilot:

- Watch new inbound conversations.
- Review `NEEDS_ADMIN` escalations.
- Review blocked sends.
- Review opt-outs.
- Review LLM quality items.
- Review unsafe or unclear replies.
- Record feedback.

End of day:

- Review all transcripts.
- Score tone, clarity, trust, and usefulness.
- Log bugs.
- Update pilot feedback.
- Decide continue, pause, or fix.

## Success Criteria

- 10/10 users can understand what Saga does.
- 8/10 users complete a meaningful first flow.
- No unexpected outbound SMS.
- No duplicate replies.
- STOP and HELP behavior works.
- No unsafe promises.
- No raw PII exposure.
- No candidate outreach without approval.
- No group chat auto-creation.
- Admin can explain what happened in every conversation.
- Average conversation quality score is above the operator threshold.
- At least 7/10 users say they would use it again or want to keep testing.

## Pause / Rollback Criteria

Pause immediately if any of these happen:

- Unexpected outbound SMS.
- Duplicate replies.
- STOP is not respected.
- A non-allowlisted user receives a reply.
- Unsafe promise.
- Candidate contacted without approval.
- Group chat created unexpectedly.
- Public beta accidentally enabled.
- Raw phone, email, or secret exposed.
- Model output creates unsafe expectations.
- Twilio compliance warning.
- Observability risk is red for a critical issue.

Rollback steps:

- Set or keep `SMS_SENDS_DISABLED=true`.
- Set `PILOT_REPLY_MODE=draft_only`.
- Remove design partner numbers from the allowlist if needed.
- Disable the Twilio webhook if needed.
- Preserve audit logs.
- Write an incident report.
- Do not delete data until reviewed.

## Move-Forward Decision

Do not move to private beta or capped public beta unless:

- The pilot met success criteria.
- Pause criteria did not occur, or incidents were resolved and reviewed.
- Feedback themes are understood.
- Data ops and observability remain safe.
- The command center shows the next stage as ready for review.
- Product, engineering, and operator owners explicitly approve the next step.
