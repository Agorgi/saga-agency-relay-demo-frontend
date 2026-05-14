import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  evaluateLiveReplyReadinessAction,
  evaluateOutboundSelfTestReadinessAction,
} from "@/app/admin/(dashboard)/actions";
import { getLiveReplyExecutionReadinessSnapshot } from "@/sms-engine/conversation/liveReplyExecutor";
import { getDb } from "@/sms-engine/db";
import { summarizeDesignPartnerTranscriptDryRuns } from "@/sms-engine/dryRuns/runDesignPartnerTranscript";
import { safeLlmHealth } from "@/sms-engine/llm/llmProvider";
import { getLaunchDrillHealthSnapshot } from "@/sms-engine/launchDrill/launchReadinessDrill";
import { metadataObject } from "@/sms-engine/messages";
import { getDesignPartnerPilotReadinessSnapshot } from "@/sms-engine/pilotReadiness";
import { getOutboundSelfTestReadinessSnapshot } from "@/sms-engine/producer/outboundSelfTestReadiness";

export const dynamic = "force-dynamic";

function boolLabel(value: boolean) {
  return value ? "true" : "false";
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "safe" | "warn";
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-900 bg-emerald-950/30 text-emerald-100"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30 text-amber-100"
        : "border-zinc-800 bg-black text-zinc-100";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function PilotPage() {
  const db = getDb();
  const readiness = getDesignPartnerPilotReadinessSnapshot();
  const outboundSelfTestReadiness = await getOutboundSelfTestReadinessSnapshot();
  const liveReplyReadiness = await getLiveReplyExecutionReadinessSnapshot();
  const launchDrill = await getLaunchDrillHealthSnapshot();
  const transcriptDryRuns = summarizeDesignPartnerTranscriptDryRuns();
  const llm = safeLlmHealth();

  const [
    recentMessages,
    optedOutUsers,
    optedOutContacts,
    activeParticipants,
    pausedParticipants,
    optedOutParticipants,
  ] = await Promise.all([
    db.message.findMany({
      where: {
        channel: { in: ["SMS", "GROUP_SMS"] },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.user.count({ where: { smsOptedOutAt: { not: null } } }),
    db.contact.count({ where: { smsOptedOutAt: { not: null } } }),
    db.pilotParticipant.count({ where: { status: "ACTIVE" } }),
    db.pilotParticipant.count({ where: { status: "PAUSED" } }),
    db.pilotParticipant.count({ where: { status: "OPTED_OUT" } }),
  ]);

  const recentInbound = recentMessages.filter(
    (message) => message.direction === "INBOUND",
  ).length;
  const recentBlockedOutbound = recentMessages.filter((message) => {
    const metadata = metadataObject(message.metadata);
    return message.direction === "OUTBOUND" && metadata.blocked === true;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Twilio staging
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Pilot status</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Operator view for the standalone design-partner SMS pilot. Counts are
          staging-only, the pilot is not active, and allowed phone numbers are
          never displayed here.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pilot stage" value={readiness.pilotStage} />
        <StatCard label="Reply mode" value={readiness.pilotReplyMode} />
        <StatCard
          label="Public launch enabled"
          value={boolLabel(readiness.publicLaunchEnabled)}
          tone={readiness.publicLaunchEnabled ? "warn" : "safe"}
        />
        <StatCard
          label="Public distribution"
          value={boolLabel(readiness.stageAllowsPublicDistribution)}
          tone={readiness.stageAllowsPublicDistribution ? "warn" : "safe"}
        />
        <StatCard label="Launch drill stage" value={launchDrill.currentRecommendedLaunchStage} />
        <StatCard
          label="Launch risk"
          value={launchDrill.launchRiskLevel}
          tone={launchDrill.launchRiskLevel === "red" ? "warn" : "safe"}
        />
        <StatCard label="Launch blockers" value={String(launchDrill.launchBlockerCount)} />
        <StatCard
          label="Design partner launch ready"
          value={boolLabel(launchDrill.designPartnerLaunchReady)}
          tone={launchDrill.designPartnerLaunchReady ? "safe" : "warn"}
        />
        <StatCard label="Provider mode" value={readiness.providerMode} />
        <StatCard
          label="Sends disabled"
          value={boolLabel(readiness.sendsDisabled)}
          tone={readiness.sendsDisabled ? "safe" : "warn"}
        />
        <StatCard
          label="Allowlist required"
          value={boolLabel(readiness.allowlistRequired)}
          tone={readiness.allowlistRequired ? "safe" : "warn"}
        />
        <StatCard
          label="Allowed number count"
          value={readiness.allowedNumbersCount}
        />
        <StatCard
          label="Twilio configured"
          value={boolLabel(readiness.twilioConfigured)}
          tone={readiness.twilioConfigured ? "safe" : "neutral"}
        />
        <StatCard
          label="Webhook validation"
          value={boolLabel(readiness.webhookValidationEnabled)}
          tone={readiness.webhookValidationEnabled ? "safe" : "warn"}
        />
        <StatCard
          label="Conversation engine"
          value={readiness.conversationEngineMode}
        />
        <StatCard
          label="Send readiness"
          value={readiness.sendReadinessAvailable ? "available" : "unavailable"}
          tone={readiness.sendReadinessAvailable ? "safe" : "warn"}
        />
        <StatCard
          label="Self-test readiness"
          value={
            outboundSelfTestReadiness.ready ? "ready dry-run" : "blocked"
          }
          tone={outboundSelfTestReadiness.ready ? "warn" : "safe"}
        />
        <StatCard
          label="Autonomous replies"
          value={liveReplyReadiness.autonomousRepliesEnabled ? "enabled" : "blocked"}
          tone={liveReplyReadiness.autonomousRepliesEnabled ? "warn" : "safe"}
        />
        <StatCard label="LLM provider" value={llm.provider} />
        <StatCard
          label="Transcript dry runs"
          value={
            transcriptDryRuns.readyForDryRunReview
              ? "passed"
              : "not ready"
          }
          tone={transcriptDryRuns.readyForDryRunReview ? "safe" : "warn"}
        />
        <StatCard
          label="LLM mode"
          value={llm.mode}
          tone={llm.mode === "active_live" ? "warn" : "safe"}
        />
        <StatCard
          label="OpenAI configured"
          value={boolLabel(llm.configured)}
          tone={llm.configured ? "warn" : "safe"}
        />
        <StatCard
          label="Engine active"
          value={boolLabel(readiness.conversationEngineEffectiveActive)}
          tone={readiness.conversationEngineEffectiveActive ? "warn" : "safe"}
        />
        <StatCard label="Recent inbound" value={recentInbound} />
        <StatCard
          label="Recent blocked outbound"
          value={recentBlockedOutbound}
          tone={recentBlockedOutbound > 0 ? "safe" : "neutral"}
        />
        <StatCard
          label="Opted out"
          value={optedOutUsers + optedOutContacts}
          tone="neutral"
        />
        <StatCard label="Active participants" value={activeParticipants} />
        <StatCard label="Paused participants" value={pausedParticipants} />
        <StatCard label="Opted-out participants" value={optedOutParticipants} />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Transcript and launch drill readiness</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Dry-run readiness can pass while live pilot launch remains blocked
              by A2P, sends-disabled, and manual stage evidence gates.
            </p>
          </div>
          <a
            href="/admin/launch-drill"
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Open launch drill
          </a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Dry-run scenarios passed" value={`${transcriptDryRuns.scenariosPassed}/${transcriptDryRuns.scenarioCount}`} />
          <StatCard label="Dry-run average score" value={String(transcriptDryRuns.averageScore)} />
          <StatCard
            label="Dry-run review ready"
            value={boolLabel(transcriptDryRuns.readyForDryRunReview)}
            tone={transcriptDryRuns.readyForDryRunReview ? "safe" : "warn"}
          />
          <StatCard
            label="Launch drill last run"
            value={launchDrill.lastLaunchDrillRunAt || "none"}
          />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Simulation only
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              Transcript Dry Run Readiness
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Ten synthetic design-partner transcripts must pass before any
              real invite-only pilot planning. This summary fails closed until
              dry runs are executed and reviewed.
            </p>
          </div>
          <a
            href="/admin/transcript-dry-runs"
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Open dry runs
          </a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Last run"
            value={
              transcriptDryRuns.ranAt
                ? new Date(transcriptDryRuns.ranAt).toLocaleString()
                : "not run"
            }
          />
          <StatCard
            label="Scenarios passed"
            value={`${transcriptDryRuns.scenariosPassed}/${transcriptDryRuns.scenarioCount}`}
          />
          <StatCard
            label="Average score"
            value={transcriptDryRuns.averageScore}
          />
          <StatCard
            label="Ready for design partners"
            value={boolLabel(transcriptDryRuns.readyForDesignPartners)}
            tone={transcriptDryRuns.readyForDesignPartners ? "warn" : "safe"}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Blockers</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {transcriptDryRuns.blockers.length > 0 ? (
                transcriptDryRuns.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>No transcript dry-run blockers.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Warnings</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {transcriptDryRuns.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-lg font-semibold">LLM provider</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          OpenAI is optional. Fallback mode is deterministic, shadow mode audits
          model output without using it, and active live output remains disabled
          by default.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={`PROVIDER_${llm.provider}`} />
          <StatusBadge status={`MODE_${llm.mode}`} />
          <StatusBadge status={llm.shadowMode ? "SHADOW_MODE" : "NOT_SHADOW"} />
          <StatusBadge
            status={
              llm.activeLiveAllowed
                ? "ACTIVE_LIVE_ALLOWED"
                : "ACTIVE_LIVE_DISABLED"
            }
          />
          <StatusBadge
            status={
              llm.promptLoggingEnabled
                ? "PROMPT_LOGGING_ON"
                : "PROMPT_LOGGING_OFF"
            }
          />
          <StatusBadge
            status={
              llm.outputLoggingEnabled
                ? "OUTPUT_LOGGING_ON"
                : "OUTPUT_LOGGING_OFF"
            }
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Model" value={llm.model} />
          <StatCard label="Timeout ms" value={llm.timeoutMs} />
          <StatCard
            label="Daily call cap"
            value={llm.dailyCallCap ?? "not set"}
          />
          <StatCard
            label="Custom base URL"
            value={boolLabel(llm.customBaseUrlConfigured)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-lg font-semibold">Safety posture</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={readiness.providerMode} />
          <StatusBadge
            status={
              readiness.sendsDisabled ? "SENDS_DISABLED" : "SENDS_ENABLED"
            }
          />
          <StatusBadge
            status={
              readiness.allowlistRequired
                ? "ALLOWLIST_REQUIRED"
                : "ALLOWLIST_NOT_REQUIRED"
            }
          />
          <StatusBadge
            status={
              readiness.webhookValidationEnabled
                ? "WEBHOOK_VALIDATION_ON"
                : "WEBHOOK_VALIDATION_OFF"
            }
          />
          <StatusBadge status={`ENGINE_${readiness.conversationEngineMode}`} />
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          Do not enable outbound sends or public distribution from this page. Use
          it only to confirm staging safety state before controlled inbound-only
          tests and later design-partner rehearsals.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Controlled live replies
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              Live Reply Execution Readiness
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Shows whether ordinary allowlisted inbound conversations could use
              autonomous replies after compliance approval. This page has no
              send button and does not expose phone numbers.
            </p>
          </div>
          <form action={evaluateLiveReplyReadinessAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Evaluate live reply gates
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge
            status={
              liveReplyReadiness.autonomousRepliesEnabled
                ? "AUTONOMOUS_REPLIES_ENABLED"
                : "AUTONOMOUS_REPLIES_BLOCKED"
            }
          />
          <StatusBadge status="ORDINARY_INBOUND_ONLY" />
          <StatusBadge status="NO_SHORTLISTS" />
          <StatusBadge status="NO_CANDIDATE_OUTREACH" />
          <StatusBadge status="NO_GROUP_CHATS" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Autonomous enabled"
            value={boolLabel(liveReplyReadiness.autonomousRepliesEnabled)}
            tone={liveReplyReadiness.autonomousRepliesEnabled ? "warn" : "safe"}
          />
          <StatCard
            label="Blockers"
            value={liveReplyReadiness.autonomousReplyBlockerCount}
            tone={
              liveReplyReadiness.autonomousReplyBlockerCount > 0
                ? "safe"
                : "warn"
            }
          />
          <StatCard
            label="Daily sends"
            value={`${liveReplyReadiness.sendCaps.dailySendCount}/${liveReplyReadiness.sendCaps.dailySendCap}`}
          />
          <StatCard
            label="Autonomous replies"
            value={`${liveReplyReadiness.sendCaps.autonomousReplyDailyCount}/${liveReplyReadiness.sendCaps.autonomousReplyDailyCap}`}
          />
          <StatCard
            label="Per-number cap"
            value={liveReplyReadiness.sendCaps.perNumberDailySendCap}
          />
          <StatCard
            label="Reply mode"
            value={liveReplyReadiness.safetySnapshot.pilotReplyMode}
          />
          <StatCard
            label="Compliance"
            value={boolLabel(
              liveReplyReadiness.safetySnapshot.smsComplianceApproved,
            )}
            tone={
              liveReplyReadiness.safetySnapshot.smsComplianceApproved
                ? "warn"
                : "safe"
            }
          />
          <StatCard
            label="Idempotency"
            value={
              liveReplyReadiness.idempotency.oneReplyPerInboundSid
                ? "one per sid"
                : "unknown"
            }
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Live reply blockers</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {liveReplyReadiness.blockers.length > 0 ? (
                liveReplyReadiness.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>No environment blockers in dry-run evaluation.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Scope limits</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              <li>Allowed: organizer, gig-seeker, and interest-check replies.</li>
              <li>Blocked: contact replies, shortlist sends, candidate outreach, and group chats.</li>
              <li>Blocked: rates, contracts, payment, legal, safety, and high-risk topics.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Dry run only
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              Outbound SMS Self-Test Readiness
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Evaluates whether a future one-number founder/operator SMS
              self-test would be allowed after compliance approval. This page
              does not send SMS and does not expose allowed numbers.
            </p>
          </div>
          <form action={evaluateOutboundSelfTestReadinessAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              Evaluate readiness
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={outboundSelfTestReadiness.readinessStatus} />
          <StatusBadge status="DRY_RUN_ONLY" />
          <StatusBadge status="NO_SEND_BUTTON" />
          <StatusBadge
            status={
              outboundSelfTestReadiness.safetySnapshot.publicLaunchEnabled
                ? "PUBLIC_LAUNCH_ENABLED"
                : "PUBLIC_LAUNCH_DISABLED"
            }
          />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ready"
            value={boolLabel(outboundSelfTestReadiness.ready)}
            tone={outboundSelfTestReadiness.ready ? "warn" : "safe"}
          />
          <StatCard
            label="Blockers"
            value={outboundSelfTestReadiness.blockers.length}
            tone={
              outboundSelfTestReadiness.blockers.length > 0 ? "safe" : "warn"
            }
          />
          <StatCard
            label="Compliance approved"
            value={boolLabel(
              outboundSelfTestReadiness.safetySnapshot.smsComplianceApproved,
            )}
            tone={
              outboundSelfTestReadiness.safetySnapshot.smsComplianceApproved
                ? "warn"
                : "safe"
            }
          />
          <StatCard
            label="Allowed number count"
            value={outboundSelfTestReadiness.safetySnapshot.allowedNumbersCount}
          />
          <StatCard
            label="Sends disabled"
            value={boolLabel(
              outboundSelfTestReadiness.safetySnapshot.sendsDisabled,
            )}
            tone={
              outboundSelfTestReadiness.safetySnapshot.sendsDisabled
                ? "safe"
                : "warn"
            }
          />
          <StatCard
            label="Pilot stage"
            value={outboundSelfTestReadiness.safetySnapshot.pilotStage}
          />
          <StatCard
            label="Reply mode"
            value={outboundSelfTestReadiness.safetySnapshot.pilotReplyMode}
          />
          <StatCard
            label="Webhook validation"
            value={boolLabel(
              outboundSelfTestReadiness.safetySnapshot
                .webhookValidationEnabled,
            )}
            tone={
              outboundSelfTestReadiness.safetySnapshot.webhookValidationEnabled
                ? "safe"
                : "warn"
            }
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Blockers</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {outboundSelfTestReadiness.blockers.length > 0 ? (
                outboundSelfTestReadiness.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>No blockers in dry-run evaluation.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Required actions</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {outboundSelfTestReadiness.requiredActions.length > 0 ? (
                outboundSelfTestReadiness.requiredActions.map((item) => (
                  <li key={item}>{item}</li>
                ))
              ) : (
                <li>Seek explicit operator approval before any real test.</li>
              )}
            </ul>
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm font-medium text-zinc-200">Warnings</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-zinc-500">
              {outboundSelfTestReadiness.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Pilot readiness gates</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              These are operator review items, not proof that the pilot is
              active. Keep them manual until compliance, support, and rollback
              procedures are approved.
            </p>
          </div>
          <a
            href="/admin/pilot-feedback"
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Capture feedback
          </a>
          <a
            href="/admin/pilot-participants"
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Manage participants
          </a>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {readiness.manualGates.map((gate) => (
            <div
              key={gate.label}
              className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-200">{gate.label}</p>
                <StatusBadge status={gate.status} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          Readiness requires the runbook, conversation quality guide, A2P or
          number compliance approval, allowlisted participants, verified
          STOP/START/HELP behavior, and no production Saga app connection.
        </p>
      </section>
    </div>
  );
}
