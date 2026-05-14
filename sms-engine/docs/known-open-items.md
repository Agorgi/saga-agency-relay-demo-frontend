# Known Open Items

## External Blockers

- A2P / Twilio compliance approval.
- Trust Hub / campaign approvals if Twilio requires additional review.
- Number purchase or messaging restrictions if the compliance profile is not
  approved.

## Not Yet Enabled By Design

- Outbound SMS.
- Live autonomous replies.
- Public beta.
- Public launch.
- Production Saga app integration.
- Group chat automation.
- Candidate outreach sends.
- Organizer shortlist sends.
- Open-web sourcing.

## Future Engineering Review Items

- Production authentication model for broader operator/admin usage.
- Migration review before any production Saga app data connection.
- Main Saga app integration design.
- External monitoring and alerting provider.
- Higher-scale cost controls and rate limiting.
- Privacy/legal review.
- Support workflow and escalation ownership.

## Known Accepted Caveats

- Railway environment naming may still say "production" while the app is used
  as staging-purpose infrastructure.
- The standalone pilot database is separate from the main Saga app.
- A2P remains the next external blocker.
- Public launch requires explicit final gates and must not be inferred from
  public beta or design-partner readiness.
- Release candidate status is operational packaging only; it is not launch
  approval.
