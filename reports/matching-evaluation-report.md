# Matching Evaluation Report

Generated: 2026-05-11T03:41:22.362Z
Overall: PASS
Average score: 98
Fixtures run: 12
Fixture pass count: 12
Fixture fail count: 0
Safety violations: 0

## Weight Config
- Version: relationship-aware-v0.7-baseline
- Role fit: 25
- Fandom/community fit: 15
- Location fit: 15
- Relationship proximity: 15
- Evidence quality: 10
- Contactability readiness: 10
- Review trust: 10

## Tuning Recommendations
- Reduce role count or optional-role weighting for interest checks and low-budget projects.

## Fixture Results

### anime-picnic-la
- Project type: community_event
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 39
- Result count: 156
- Duration ms: 34
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### cosplay-cafe-nyc
- Project type: community_event
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 37
- Result count: 148
- Duration ms: 27
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### gaming-popup-atlanta
- Project type: community_event
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 25
- Result count: 100
- Duration ms: 25
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### maid-cafe-la
- Project type: performance_event
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 37
- Result count: 148
- Duration ms: 28
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: no_paid_work_claims
- Safety violations: none

### artist-alley-market-la
- Project type: market
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 37
- Result count: 148
- Duration ms: 28
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### anime-rave-la
- Project type: higher_risk_event
- Status: PASS
- Score: 90
- Top-K quality: 0.5
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 36
- Result count: 144
- Duration ms: 28
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: security_logistics_flag
- Safety violations: none

### cosplay-photoshoot-nyc
- Project type: photoshoot
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 35
- Result count: 140
- Duration ms: 26
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### brand-community-launch
- Project type: launch_party
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 34
- Result count: 170
- Duration ms: 30
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: none
- Safety violations: none

### love-and-deepspace-interest-picnic
- Project type: interest_check
- Status: PASS
- Score: 90
- Top-K quality: 0.5
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 36
- Result count: 72
- Duration ms: 13
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: interest_check_only; do_not_over_source
- Safety violations: none

### low-budget-casual-meetup
- Project type: casual_meetup
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 36
- Result count: 72
- Duration ms: 13
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: do_not_over_source
- Safety violations: none

### remote-illustration-design
- Project type: creative_support
- Status: PASS
- Score: 100
- Top-K quality: 1
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 34
- Result count: 68
- Duration ms: 12
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: remote_ok
- Safety violations: none

### edge-safety-heavy-project
- Project type: edge_safety
- Status: PASS
- Score: 93
- Top-K quality: 0.67
- Role coverage: 1
- Explanation quality: 1
- Candidate pool size: 34
- Result count: 68
- Duration ms: 12
- Public web gating correct: true
- Proximity labels correct: true
- Contactability handling correct: true
- Performance budget respected: true
- Failures: none
- Warnings: safety_escalation_expected; reduce_matching_confidence; safety-sensitive fixture requires human review before real launch
- Safety violations: none

## Safety
- No SMS sent.
- No Twilio required.
- No live web calls.
- No outreach, email, DM, group chat, public launch, or production Saga app data.
- Candidate names are synthetic fixture labels only; no raw phone numbers or emails are included.
