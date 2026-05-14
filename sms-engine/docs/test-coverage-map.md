# Test Coverage Map

Baseline: `main` after `d74dc17`. Source: `package.json` and `scripts/`.

There are 100 package scripts before this audit, 101 after adding `test:repo-truth-audit`, and 102 after adding `test:per-phone-autonomy-controls`.

Legend in dependency columns: `no`, `yes`, `optional`, `skips`, or `mock`.

| Script | File/target | Feature covered | DB? | Railway? | OpenAI? | Twilio? | Internet? | Sends SMS? | CI safe? | Railway SSH safe? | RC wrapper? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `dev` | `next dev` | local app | optional | no | optional | optional | no | no | no | no | no | local only |
| `clean` | remove build output | maintenance | no | no | no | no | no | no | yes | yes | no | destructive only to build output |
| `build` | `next build` | app build | no | no | no | no | no | no | yes | yes | no | emits known non-blocking trace warning |
| `postbuild` | standalone asset copy | deploy build | no | no | no | no | no | no | yes | yes | no | used after build |
| `start` | standalone server | deploy runtime | optional | yes | optional | optional | no | no | no | yes | no | runtime command |
| `lint` | eslint | code quality | no | no | no | no | no | no | yes | yes | no | static |
| `typecheck` | TypeScript | code quality | no | no | no | no | no | no | yes | yes | no | static |
| `postinstall` | prisma generate | generated client | no | no | no | no | no | no | yes | yes | no | install hook |
| `prisma:generate` | Prisma generate | DB client | no | no | no | no | no | no | yes | yes | no | generation only |
| `prisma:migrate` | Prisma dev migrate | local schema | yes | no | no | no | no | no | no | no | no | local DB mutation |
| `prisma:deploy` | Prisma deploy migrate | deployment schema | yes | yes | no | no | no | no | no | yes | no | migration command |
| `prisma:seed` | Prisma seed | seed/demo data | yes | no | no | no | no | no | no | careful | no | writes DB |
| `db:studio` | Prisma Studio | DB inspection | yes | no | no | no | no | no | no | no | no | local UI |
| `db:up` | Docker Postgres | local DB | no | no | no | no | no | no | no | no | no | local infra |
| `db:down` | Docker down | local DB | no | no | no | no | no | no | no | no | no | local infra |
| `db:reset` | Prisma reset | local DB | yes | no | no | no | no | no | no | no | no | destructive local DB |
| `test:agent` | `scripts/test-producer-agent.ts` | producer agent baseline | no | no | fallback | no | no | no | yes | yes | yes via staging | alias-like legacy |
| `test:producer-agent` | `scripts/test-producer-agent-v01.ts` | producer agent v0.1 | no | no | fallback | no | no | no | yes | yes | yes | current wrapper target |
| `test:producer-approval-queue` | producer queue script | approval queue | no | no | no | no | no | no | yes | yes | yes | mock fixtures |
| `test:producer-outreach-drafts` | producer drafts script | outreach/shortlist drafts | no | no | no | no | no | no | yes | yes | yes | no send |
| `test:producer-send-readiness` | producer send readiness script | send gates | no | no | no | no | no | no | yes | yes | yes | safety-focused |
| `test:talent-discovery` | talent discovery script | internal search/sourcing | no | no | no | no | no | no | yes | yes | no | fixture-based |
| `test:talent-research-quality` | research quality script | candidate review quality | no | no | mock | no | no | no | yes | yes | no | deterministic first |
| `test:public-web-research-shadow` | public web shadow script | shadow research gates | no | no | mock | no | no | no | yes | yes | no | no live web |
| `test:public-web-research-live` | live provider script | optional live web provider | no | no | skips | no | skips | no | yes when skipped | yes when skipped | no | only runs with explicit flags |
| `test:public-web-research-live-dry-run` | live dry-run script | dry-run gates | no | no | mock | no | no | no | yes | yes | no | no live call in CI |
| `test:public-web-research-async-dry-run` | async dry-run script | async public web jobs | no | no | mock | no | no | no | yes | yes | no | no live call |
| `test:public-web-research-provider-schema` | provider schema script | OpenAI schema/request | no | no | mock | no | no | no | yes | yes | no | regression for schema fix |
| `test:public-web-research-review-cleanup` | review cleanup script | review/cleanup/contactability | no | no | no | no | no | no | yes | yes | no | no web call |
| `test:contactability-evidence` | same cleanup script | contactability evidence | no | no | no | no | no | no | yes | yes | no | alias to cleanup test |
| `test:candidate-graph-foundation` | graph foundation script | graph tags/proximity/persistence | no | no | no | no | no | no | yes | yes | no | fixture-based |
| `test:relationship-aware-matching` | matching script | project-specific ranking | no | no | no | no | no | no | yes | yes | no | fixture-based |
| `test:matching-evaluation-tuning` | matching eval script | golden matching eval | no | no | no | no | no | no | yes | yes | no | synthetic |
| `test:outbound-self-test-readiness` | self-test readiness script | one-number readiness | no | no | no | no | no | no | yes | yes | yes | safety-only |
| `test:post-a2p-self-test-plan` | post-A2P plan script | self-test docs/readiness | no | no | no | no | no | no | yes | yes | no | docs/readiness |
| `test:controlled-live-reply-execution` | controlled live script | live reply gates | no | no | mock/fallback | mock | no | no | yes | yes | yes | does not send |
| `test:per-phone-autonomy-controls` | per-phone autonomy script | per-phone reply autonomy and handoffs | no | no | no | no | no | no | yes | yes | no | verifies no SMS/outreach/group chat |
| `test:llm-provider` | provider script | LLM resolver/provider | no | no | optional/mock | no | no | no | yes | yes | yes | fallback safe |
| `test:llm-evals` | LLM eval script | AI eval fixtures | no | no | optional/mock | no | no | no | yes | yes | no | no SMS |
| `test:llm-model-preflight` | model preflight script | model config preflight | no | no | optional | no | optional | no | yes if skipped | yes if skipped | no | catches model access mistakes |
| `test:llm-health-config` | health config script | LLM health fields | no | no | no | no | no | no | yes | yes | no | config-only |
| `test:llm-organizer-reply-language` | organizer language script | reply language | no | no | fallback/mock | no | no | no | yes | yes | no | no send |
| `test:llm-shadow-organizer-inbound` | shadow script | shadow organizer comparison | no | no | mock | no | no | no | yes | yes | no | no live mode |
| `test:llm-active-mock-admin-dev` | active mock script | admin/dev active_mock | no | no | mock | no | no | no | yes | yes | no | no active_live |
| `test:llm-quality-review` | quality review script | LLM review queue | no | no | mock | no | no | no | yes | yes | yes | no raw prompts |
| `test:intake` | producer agent script | intake alias | no | no | fallback | no | no | no | yes | yes | no | alias to agent |
| `test:matching` | `scripts/test-matching.ts` | legacy matching | no | no | no | no | no | no | yes | yes | yes via staging | older deterministic matching |
| `test:demo-flow` | demo flow script | demo flow | optional | no | no | mock | no | no | yes | yes | yes via staging | skips DB checks if no DB |
| `test:staging-repeatability` | staging repeatability script | staging repeatability | no | no | no | no | no | no | yes | yes | no | safe |
| `test:mock-app-integration` | mock integration script | internal contract mock | no | no | no | no | no | no | yes | yes | no | no production app |
| `test:security` | security hardening script | security gates | no | no | no | no | no | no | yes | yes | yes via staging/security | core security |
| `test:security-hardening` | wrapper | security alias | no | no | no | no | no | no | yes | yes | yes | wrapper |
| `test:workflow` | workflow state script | workflow state machine | no | no | no | no | no | no | yes | yes | yes via staging | consent/state guards |
| `test:workflow-state-machine` | wrapper | workflow alias | no | no | no | no | no | no | yes | yes | no | wrapper |
| `test:staging-baseline` | wrapper | staging baseline | no | no | fallback/mock | mock | no | no | yes | yes | yes | wrapper |
| `test:twilio-readiness` | Twilio readiness script | webhook/safety readiness | no | no | no | mock | no | no | yes | yes | yes | no live Twilio |
| `test:twilio-staging-no-send` | no-send script | Twilio staging no-send | no | no | no | mock | no | no | yes | yes | no | safety |
| `test:twilio-inbound-no-reply` | inbound no-reply script | inbound gating | no | no | no | mock | no | no | yes | yes | no | safety |
| `test:twilio-pilot-preflight` | pilot preflight script | pilot Twilio gates | no | no | no | mock | no | no | yes | yes | no | safety |
| `test:twilio-status-callbacks` | status callback script | Twilio callbacks | no | no | no | mock | no | no | yes | yes | no | safety |
| `test:design-partner-pilot-readiness` | pilot readiness script | design partner readiness | no | no | no | no | no | no | yes | yes | yes | docs/gates |
| `test:design-partner-pilot-preflight` | pilot preflight script | design partner preflight | no | no | no | no | no | no | yes | yes | yes | safety |
| `test:design-partner-transcript-dry-runs` | transcript dry-run script | design partner transcripts | no | no | fallback/mock | no | no | no | yes | yes | yes | synthetic |
| `test:design-partner-operator-playbook` | playbook script | pilot playbook docs | no | no | no | no | no | no | yes | yes | no | docs-only |
| `test:messaging-pipeline` | pipeline script | messaging pipeline | no | no | no | no | no | no | yes | yes | yes | no send |
| `test:production-observability` | observability script | health/observability | no | no | no | no | no | no | yes | yes | yes | redaction |
| `test:public-beta-access-control` | access script | public beta gates | no | no | no | no | no | no | yes | yes | yes | public off |
| `test:pilot-data-ops` | data ops script | redaction/export | no | no | no | no | no | no | yes | yes | yes | no production data |
| `test:launch-readiness-drill` | launch drill script | launch readiness | no | no | no | no | no | no | yes | yes | yes | simulation |
| `test:operator-command-center` | command center script | command center | no | no | no | no | no | no | yes | yes | yes | no env flips |
| `test:admin-navigation-ux` | admin nav script | admin v0.1 nav | no | no | no | no | no | no | yes | yes | no | static/React render |
| `test:admin-info-architecture` | admin IA script | admin v0.2 IA | no | no | no | no | no | no | yes | yes | no | static |
| `test:capped-public-beta-infrastructure` | capped beta script | capped beta infra | no | no | no | no | no | no | yes | yes | yes | public off |
| `test:beta-cohort-simulation` | beta cohort script | cohort simulation | no | no | no | no | no | no | yes | yes | yes | synthetic |
| `test:release-candidate-package` | RC package script | RC docs/report | no | no | no | no | no | no | yes | yes | yes | docs/safety |
| `test:release-candidate` | wrapper | full RC safe suite | no | no | fallback/mock | mock | no | no | yes | yes | yes | long wrapper |
| `jobs:process-inbound-once` | inbound worker script | inbound jobs | yes | optional | fallback/mock | gated | no | no by default | no | careful | no | worker context |
| `jobs:process-public-web-research-once` | web research worker | async web research jobs | yes | optional | optional/gated | no | optional/gated | no | no | careful | no | skips unless gates pass |
| `observability:daily-report` | report script | observability report | optional | optional | no | no | no | no | yes | yes | no | redacted |
| `launch:drill-report` | report script | launch drill report | no | no | no | no | no | no | yes | yes | no | simulation |
| `command-center:report` | report script | command center report | optional | optional | no | no | no | no | yes | yes | no | redacted |
| `beta:cohort-report` | report script | cohort report | no | no | no | no | no | no | yes | yes | no | synthetic |
| `release:rc-report` | report script | RC report | no | no | no | no | no | no | yes | yes | no | redacted |
| `web-research:live-dry-run` | live dry-run CLI | public web dry run | optional | optional | gated | no | gated | no | yes when skipped | careful | no | only with explicit gates |
| `public-web:review-report` | review report script | public web review report | optional | optional | no | no | no | no | yes | yes | no | redacted |
| `matching:evaluation-report` | matching eval report | matching evaluation | no | no | no | no | no | no | yes | yes | no | synthetic |
| `test:ai-evals` | AI eval script | AI eval fixtures | no | no | optional/mock | no | no | no | yes | yes | no | eval-only |
| `test:conversation-intent-router` | conversation script | intent routing | no | no | no | no | no | no | yes | yes | yes via conversation wrapper | deterministic |
| `test:conversation-organizer-policy` | conversation script | organizer policy | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-organizer-multiturn` | conversation script | organizer multi-turn | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-gig-seeker-policy` | conversation script | gig seeker policy | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-gig-seeker-multiturn` | conversation script | gig seeker multi-turn | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-interest-check-policy` | conversation script | interest-check policy | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-interest-check-multiturn` | conversation script | interest-check multi-turn | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-contact-reply-policy` | conversation script | contact reply policy | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-contact-reply-demo-flow` | conversation script | contact reply demo | no | no | no | no | no | no | yes | yes | no | not in wrapper |
| `test:conversation-capability-responses` | conversation script | capability FAQ | no | no | no | no | no | no | yes | yes | yes | no promises |
| `test:conversation-golden-transcripts` | conversation script | golden transcripts | no | no | no | no | no | no | yes | yes | yes | deterministic |
| `test:conversation-engine-v0.1` | wrapper | full conversation engine | no | no | no | no | no | no | yes | yes | yes | wrapper |
| `test:internal-api` | internal API script | internal Saga contract | no | no | no | no | no | no | yes | yes | no | no production app |
| `test:seed-idempotency` | seed script | seed safety | optional | no | no | no | no | no | no | careful | no | may touch local DB |
| `test:repo-truth-audit` | `scripts/test-repo-truth-audit.ts` | repo audit docs | no | no | no | no | no | no | yes | yes | no | verifies this audit inventory |

## Summary

- Total package scripts after this audit plus per-phone autonomy controls: 102.
- Wrapper/alias scripts: about 10 (`test:staging-baseline`, `test:release-candidate`, `test:conversation-engine-v0.1`, security/workflow aliases, and report/script aliases).
- Scripts that require a DB to do useful work: migrations, seed/reset/studio, worker jobs, some reports, and optional DB-backed demo checks.
- Scripts that can call OpenAI or internet: public web live/dry-run paths and optional LLM model preflight; all are gated or mocked in CI.
- Mock-only/synthetic tests dominate the safety suite.
- Scripts that should never send SMS: all scripts in this map. Any future exception must be isolated, named clearly, and gated by explicit operator runbook.
