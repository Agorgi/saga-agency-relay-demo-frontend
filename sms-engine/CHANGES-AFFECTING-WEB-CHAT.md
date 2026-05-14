# Changes Made In Relay-Demo That Should Be Backported To sms-producer-mvp

This file tracks edits made to files under `sms-engine/` (which originated from `saga-sms-producer-mvp` via subtree import) that need to be applied to the upstream `saga-sms-producer-mvp` repo as well, so the two stay in sync.

## 2026-05-14 — Sanitize Twilio-shaped test fixtures in `scripts/test-security-hardening.ts`

**Why:** GitHub push protection blocked PR-A because the test fixture values match the Twilio Account SID regex (`AC` + 32 hex chars). Even though these are clearly test fixtures and not real credentials, GitHub blocks the push regardless of intent.

**What changed in relay-demo:** Replaced the SID-shaped fixture values at lines [244, 262, 291, 310, 328, 341] with `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, while preserving the test's ability to verify the redaction logic.

**Backport action needed in sms-producer-mvp:** Apply the same replacement to `scripts/test-security-hardening.ts` in `saga-sms-producer-mvp` so the next subtree pull doesn't reintroduce the unsanitized values. The same replacement was also applied to additional `TWILIO_ACCOUNT_SID` test fixtures elsewhere under `scripts/` during this relay-demo PR, so the SMS repo should mirror those changes too.

**Backport ticket / thread:** Alex will carry this back to the SMS thread.
