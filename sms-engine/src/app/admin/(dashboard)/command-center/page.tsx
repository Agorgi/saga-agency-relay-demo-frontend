import Link from "next/link";
import {
  evaluateCommandCenterAction,
  runLaunchReadinessDrillAction,
} from "@/app/admin/(dashboard)/actions";
import {
  recordCommandCenterViewed,
  type CommandCenterSummary,
  type GoNoGoStatus,
} from "@/lib/commandCenter/commandCenterSummary";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getNeedsAttentionSummary } from "@/lib/admin/needsAttention";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function toneForRisk(level: string): "safe" | "warn" | "danger" {
  if (level === "green") return "safe";
  if (level === "yellow") return "warn";
  return "danger";
}

function toneForGoNoGo(status: GoNoGoStatus) {
  if (status === "READY") return "border-emerald-900 bg-emerald-950/30 text-emerald-100";
  if (status === "READY_FOR_REVIEW") return "border-amber-900 bg-amber-950/30 text-amber-100";
  return "border-red-900 bg-red-950/30 text-red-100";
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number | boolean | null;
  tone?: "neutral" | "safe" | "warn" | "danger";
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-900 bg-emerald-950/30 text-emerald-100"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30 text-amber-100"
        : tone === "danger"
          ? "border-red-900 bg-red-950/30 text-red-100"
          : "border-zinc-800 bg-black text-zinc-100";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold">
        {value === null ? "n/a" : String(value)}
      </p>
    </div>
  );
}

function OperatorCard({
  title,
  message,
  detail,
  href,
  tone = "neutral",
}: {
  title: string;
  message: string;
  detail: string;
  href: string;
  tone?: "neutral" | "safe" | "warn" | "danger";
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-900 bg-emerald-950/30"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30"
        : tone === "danger"
          ? "border-red-900 bg-red-950/30"
          : "border-zinc-800 bg-black";
  return (
    <Link href={href} className={`block rounded-lg border p-4 transition hover:border-zinc-600 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <p className="mt-2 text-base font-semibold text-zinc-100">{message}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </Link>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KeyValueList({
  rows,
}: {
  rows: Array<[string, string | number | boolean | null]>;
}) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
          <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
          <dd className="mt-1 break-words text-zinc-200">
            {value === null ? "n/a" : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-zinc-300">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function GoNoGoPanel({ summary }: { summary: CommandCenterSummary }) {
  return (
    <Section title="Go / No-Go">
      <div className="grid gap-4 lg:grid-cols-2">
        {summary.goNoGo.map((item) => (
          <article key={item.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {item.id}
                </p>
                <h4 className="mt-1 text-sm font-semibold">{item.title}</h4>
              </div>
              <span className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${toneForGoNoGo(item.status)}`}>
                {item.status}
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
                  Blockers
                </p>
                <ChipList items={item.blockers} empty="No blockers." />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Required evidence
                </p>
                <ChipList items={item.requiredEvidence} empty="No evidence listed." />
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

export default async function CommandCenterPage() {
  const [summary, needsAttention] = await Promise.all([
    recordCommandCenterViewed(),
    getNeedsAttentionSummary({ limit: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operator home"
        title="Command Center"
        description="Start here to see what is safe, what is blocked, and what the operator should do next."
        primaryStatus={summary.overallStatus}
        helpText="This page does not send SMS, invite users, edit environment variables, or launch public beta."
      />

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Current stage
            </p>
            <h3 className="mt-2 text-2xl font-semibold">{summary.currentStage}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {summary.nextRecommendedAction}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label="Overall status"
              value={summary.overallStatus}
              tone={toneForRisk(summary.overallStatus)}
            />
            <StatCard
              label="Top blockers"
              value={summary.blockers.length}
              tone={summary.blockers.length ? "warn" : "safe"}
            />
            <StatCard label="Critical warnings" value={summary.warnings.length} />
            <StatCard
              label="Needs attention"
              value={needsAttention.criticalCount}
              tone={needsAttention.criticalCount ? "danger" : "safe"}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OperatorCard
            title="SMS Safety"
            message={summary.sms.sendsDisabled ? "SMS sending is OFF" : "SMS sending is ON"}
            detail={
              summary.sms.sendsDisabled
                ? "Good for pre-pilot safety. No live send button is enabled."
                : "Pause and restore the SMS send kill switch before testing."
            }
            href="/admin/observability"
            tone={summary.sms.sendsDisabled ? "safe" : "danger"}
          />
          <OperatorCard
            title="Autonomous SMS"
            message={
              summary.conversationAutonomy.autonomousParticipantsCount
                ? `${summary.conversationAutonomy.autonomousParticipantsCount} people toggled on`
                : "No phones are autonomous"
            }
            detail={
              summary.conversationAutonomy.autonomyHandoffCount
                ? "Review handoffs in Needs Attention before any reply moves forward."
                : "Per-phone autonomy still stops at outreach, shortlist, and group-chat boundaries."
            }
            href="/admin/needs-attention"
            tone={
              summary.conversationAutonomy.autonomyHandoffCount
                ? "warn"
                : "safe"
            }
          />
          <OperatorCard
            title="A2P / Compliance"
            message={
              summary.sms.smsComplianceApproved
                ? "A2P approval is recorded"
                : "A2P approval is still needed"
            }
            detail="Do not run the one-number outbound self-test until approval is confirmed."
            href="/admin/launch-drill"
            tone={summary.sms.smsComplianceApproved ? "safe" : "warn"}
          />
          <OperatorCard
            title="Pilot Readiness"
            message={
              summary.designPartnerPilot.designPartnerPilotReady
                ? "Design partner pilot is ready for review"
                : "Design partner pilot is not ready yet"
            }
            detail="Pilot remains blocked until A2P, self-test, and internal smoke test pass."
            href="/admin/pilot"
            tone={summary.designPartnerPilot.designPartnerPilotReady ? "safe" : "warn"}
          />
          <OperatorCard
            title="Public Beta Readiness"
            message={
              summary.publicBeta.publicLaunchEnabled
                ? "Public launch is ON"
                : "Public launch is OFF"
            }
            detail="Public beta and public launch stay gated separately from simulations."
            href="/admin/public-beta"
            tone={summary.publicBeta.publicLaunchEnabled ? "danger" : "safe"}
          />
          <OperatorCard
            title="LLM Status"
            message={
              summary.llm.activeLiveAllowed
                ? "Live AI mode is allowed"
                : "Live AI mode is OFF"
            }
            detail={`Current mode: ${summary.llm.modeEffective}. Use review pages for details.`}
            href="/admin/llm-review"
            tone={summary.llm.activeLiveAllowed ? "danger" : "safe"}
          />
          <OperatorCard
            title="Pipeline Health"
            message={
              summary.pipeline.failedJobs
                ? `${summary.pipeline.failedJobs} failed jobs`
                : "No failed jobs reported"
            }
            detail="Check pending replies and processing jobs before any pilot window."
            href="/admin/pipeline"
            tone={summary.pipeline.failedJobs ? "warn" : "safe"}
          />
          <OperatorCard
            title="Needs Attention"
            message={
              needsAttention.totalCount
                ? `${needsAttention.totalCount} items need review`
                : "No open attention items"
            }
            detail="One queue for approvals, blocked drafts, failed jobs, and warnings."
            href="/admin/needs-attention"
            tone={needsAttention.criticalCount ? "danger" : needsAttention.totalCount ? "warn" : "safe"}
          />
          <OperatorCard
            title="Talent / Matching Status"
            message={
              summary.candidateGraph.relationshipAwareMatchingAvailable
                ? "Smart matching is available"
                : "Smart matching needs review"
            }
            detail="Candidates are not approved, contacted, or shown to users automatically."
            href="/admin/matching"
            tone={summary.candidateGraph.relationshipAwareMatchingAvailable ? "safe" : "warn"}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          `SENDS DISABLED: ${String(summary.sms.sendsDisabled)}`,
          `ALLOWLIST REQUIRED: ${String(summary.sms.allowlistRequired)}`,
          `PUBLIC LAUNCH DISABLED: ${String(!summary.sms.publicLaunchEnabled)}`,
          `LLM ACTIVE LIVE DISABLED: ${String(!summary.llm.activeLiveAllowed)}`,
          `DRY RUN ONLY`,
        ].map((label) => (
          <span
            key={label}
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100"
          >
            {label}
          </span>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall status"
          value={summary.overallStatus}
          tone={toneForRisk(summary.overallStatus)}
        />
        <StatCard label="Current stage" value={summary.currentStage} />
        <StatCard label="Configured pilot stage" value={summary.configuredPilotStage} />
        <StatCard
          label="Stage mismatch"
          value={summary.stageMismatch}
          tone={summary.stageMismatch ? "warn" : "safe"}
        />
        <StatCard
          label="Blockers"
          value={summary.blockers.length}
          tone={summary.blockers.length ? "warn" : "safe"}
        />
        <StatCard label="Warnings" value={summary.warnings.length} />
        <StatCard
          label="One-number self-test"
          value={summary.goNoGo.find((item) => item.id === "one_number_self_test")?.status || "n/a"}
          tone="warn"
        />
        <StatCard
          label="Public launch ready"
          value={summary.publicBeta.publicLaunchReady}
          tone={summary.publicBeta.publicLaunchReady ? "safe" : "warn"}
        />
        <StatCard
          label="Public beta ready"
          value={summary.publicBeta.publicBetaReady}
          tone={summary.publicBeta.publicBetaReady ? "safe" : "warn"}
        />
        <StatCard
          label="Simulation risk"
          value={summary.betaCohortSimulation.simulationRiskLevel}
          tone={toneForRisk(summary.betaCohortSimulation.simulationRiskLevel)}
        />
        <StatCard
          label="Release candidate"
          value={summary.releaseCandidate.releaseCandidateStatus}
          tone={
            summary.releaseCandidate.releaseCandidateStatus ===
            "BLOCKED_UNSAFE_CONFIG"
              ? "danger"
              : "safe"
          }
        />
        <StatCard
          label="Talent discovery"
          value={summary.talentDiscovery.talentDiscoveryAvailable}
          tone="safe"
        />
        <StatCard
          label="Talent quality"
          value={summary.talentResearchQuality.talentQualityRiskLevel}
          tone={toneForRisk(summary.talentResearchQuality.talentQualityRiskLevel)}
        />
      </section>

      <Section title="Recommended Next Action">
        <p className="text-sm leading-6 text-zinc-300">{summary.nextRecommendedAction}</p>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Global Blockers">
          <ChipList items={summary.blockers} empty="No command-center blockers." />
        </Section>
        <Section title="Warnings">
          <ChipList items={summary.warnings} empty="No command-center warnings." />
        </Section>
      </div>

      <GoNoGoPanel summary={summary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="SMS Safety">
          <KeyValueList
            rows={[
              ["Provider mode", summary.sms.providerMode],
              ["Sends disabled", summary.sms.sendsDisabled],
              ["Allowlist required", summary.sms.allowlistRequired],
              ["Allowed numbers count", summary.sms.allowedNumbersCount],
              ["Twilio staging", summary.sms.twilioStagingMode],
              ["Webhook validation", summary.sms.webhookValidationEnabled],
              ["Compliance approved", summary.sms.smsComplianceApproved],
              ["Recent outbound", summary.sms.recentOutboundCount],
              ["Blocked sends", summary.sms.recentBlockedSendCount],
              ["Unexpected outbound", summary.sms.unexpectedOutboundDetected],
            ]}
          />
        </Section>

        <Section title="LLM Status">
          <KeyValueList
            rows={[
              ["Provider", summary.llm.providerEffective],
              ["Mode", summary.llm.modeEffective],
              ["Model", summary.llm.model],
              ["Shadow mode", summary.llm.shadowMode],
              ["Active mock available", summary.llm.activeMockAvailable],
              ["Active live allowed", summary.llm.activeLiveAllowed],
              ["Recent calls", summary.llm.recentCallCount],
              ["Recent failures", summary.llm.recentFailureCount],
              ["Recent fallbacks", summary.llm.recentFallbackCount],
            ]}
          />
        </Section>

        <Section title="Messaging Pipeline">
          <KeyValueList
            rows={[
              ["Mode", summary.pipeline.messageProcessingMode],
              ["Async available", summary.pipeline.asyncProcessingAvailable],
              ["Async active enabled", summary.pipeline.asyncActiveEnabled],
              ["Pending jobs", summary.pipeline.pendingJobs],
              ["Failed jobs", summary.pipeline.failedJobs],
            ]}
          />
        </Section>

        <Section title="Access Control">
          <KeyValueList
            rows={[
              ["Access mode", summary.access.smsAccessMode],
              ["Effective access mode", summary.access.accessModeEffective],
              ["Public access enabled", summary.access.publicAccessEnabled],
              ["Public beta enabled", summary.access.publicBetaEnabled],
              ["Public launch enabled", summary.access.publicLaunchEnabled],
              ["Participant cap", summary.access.maxActiveParticipants],
              ["Active participants", summary.access.currentActiveParticipants],
              ["Waitlisted participants", summary.access.waitlistedParticipantCount],
              ["Invite codes", summary.access.inviteCodeCount],
              ["Blocked inbound", summary.access.recentBlockedInboundCount],
            ]}
          />
        </Section>

        <Section title="Pilot Participants">
          <KeyValueList
            rows={[
              ["Pilot stage", summary.pilot.pilotStage],
              ["Reply mode", summary.pilot.pilotReplyMode],
              ["Active", summary.pilot.activeParticipants],
              ["Waitlisted", summary.pilot.waitlistedParticipants],
              ["Paused", summary.pilot.pausedParticipants],
              ["Opted out", summary.pilot.optedOutParticipants],
              ["Participant cap", summary.pilot.participantCap],
              ["Recent feedback", summary.pilot.recentFeedbackCount],
              ["Transcript dry runs available", summary.pilot.transcriptDryRuns.available],
              ["Dry-run score", summary.pilot.transcriptDryRuns.latestAverageScore],
            ]}
          />
        </Section>

        <Section title="Data Operations">
          <KeyValueList
            rows={[
              ["Data ops available", summary.dataOps.pilotDataOpsAvailable],
              ["Recent exports", summary.dataOps.exportCountRecent],
              ["Recent redactions", summary.dataOps.redactionCountRecent],
              ["Paused participants", summary.dataOps.participantsPausedCount],
              ["Opted out participants", summary.dataOps.participantsOptedOutCount],
              ["Retention policy", summary.dataOps.retentionPolicyExists],
              ["Backup runbook", summary.dataOps.backupRunbookExists],
              ["Data incident runbook", summary.dataOps.incidentRunbookExists],
            ]}
          />
        </Section>

        <Section title="Launch Drill">
          <KeyValueList
            rows={[
              ["Recommended stage", summary.launchDrill.currentRecommendedStage],
              ["Risk", summary.launchDrill.riskLevel],
              ["Blockers", summary.launchDrill.blockerCount],
              ["Warnings", summary.launchDrill.warningCount],
              ["Last run", summary.launchDrill.lastRunAt],
              ["Design partner ready", summary.launchDrill.designPartnerLaunchReady],
              ["Public beta candidate ready", summary.launchDrill.publicBetaCandidateReady],
            ]}
          />
        </Section>

        <Section title="Post-A2P One-Number Self-Test">
          <KeyValueList
            rows={[
              ["Plan available", summary.postA2PSelfTest.postA2PSelfTestPlanAvailable],
              ["Checklist available", summary.postA2PSelfTest.postA2PSelfTestChecklistAvailable],
              ["Ready", summary.postA2PSelfTest.oneNumberSelfTestReady],
              ["Blockers", summary.postA2PSelfTest.oneNumberSelfTestBlockers.length],
              ["Next action", summary.postA2PSelfTest.nextPostA2PAction],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Fpost-a2p-one-number-self-test-v0.9.md"
            >
              Open self-test plan
            </Link>
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Fpost-a2p-self-test-checklist.md"
            >
              Open self-test checklist
            </Link>
          </div>
        </Section>

        <Section title="Design Partner Pilot Package">
          <KeyValueList
            rows={[
              ["Pilot script", summary.designPartnerPilot.designPartnerPilotScriptAvailable],
              ["Feedback questions", summary.designPartnerPilot.designPartnerFeedbackQuestionsAvailable],
              ["Operator checklist", summary.designPartnerPilot.designPartnerOperatorChecklistAvailable],
              ["Pilot ready", summary.designPartnerPilot.designPartnerPilotReady],
              ["Blockers", summary.designPartnerPilot.designPartnerPilotBlockers.length],
              ["Next operator action", summary.designPartnerPilot.nextOperatorAction],
            ]}
          />
        </Section>

        <Section title="Incident Readiness">
          <KeyValueList
            rows={[
              ["Incident runbook", summary.incidentReadiness.incidentRunbookExists],
              ["Rollback runbook", summary.incidentReadiness.rollbackRunbookExists],
              ["Data incident runbook", summary.incidentReadiness.dataIncidentRunbookExists],
              ["Last launch drill", summary.incidentReadiness.lastLaunchDrillRunAt],
              ["Last observability report", summary.incidentReadiness.lastObservabilityDailyReportAt],
              ["Current risk", summary.incidentReadiness.currentRiskLevel],
              ["Critical audit events", summary.incidentReadiness.recentCriticalAuditEvents],
              ["Unexpected outbound", summary.incidentReadiness.recentUnexpectedOutboundCount],
              ["Failed jobs", summary.incidentReadiness.recentFailedJobs],
              ["LLM failures", summary.incidentReadiness.recentLlmFailures],
              ["Opt-outs", summary.incidentReadiness.recentOptOuts],
            ]}
          />
        </Section>

        <Section title="Public Beta and Public Launch Guardrails">
          <KeyValueList
            rows={[
              ["Public beta enabled", summary.publicBeta.publicBetaEnabled],
              ["Public beta ready", summary.publicBeta.publicBetaReady],
              ["Public beta blockers", summary.publicBeta.publicBetaBlockerCount],
              ["Landing enabled", summary.publicBeta.publicBetaLandingEnabled],
              ["Waitlist enabled", summary.publicBeta.publicBetaWaitlistEnabled],
              ["Public number visible", summary.publicBeta.publicBetaPublicNumberVisible],
              ["Waitlist entries", summary.publicBeta.waitlistCount],
              ["Admitted entries", summary.publicBeta.admittedCount],
              ["Paused entries", summary.publicBeta.pausedCount],
              ["Rejected entries", summary.publicBeta.rejectedCount],
              ["Daily new users", summary.publicBeta.dailyNewUserCount],
              ["Participant cap", summary.publicBeta.maxActiveParticipants],
              ["Daily cap", summary.publicBeta.newUserDailyCap],
              ["Public launch enabled", summary.publicBeta.publicLaunchEnabled],
              ["Public launch ready", summary.publicBeta.publicLaunchReady],
              ["Access mode", summary.publicBeta.accessMode],
              ["Support contact configured", summary.publicBeta.supportContactConfigured],
              ["Privacy URL configured", summary.publicBeta.privacyUrlConfigured],
              ["Terms URL configured", summary.publicBeta.termsUrlConfigured],
              ["Public launch docs", summary.publicBeta.publicLaunchFoundationsDocExists],
              ["Abuse/rate-limit docs", summary.publicBeta.abuseRateLimitDocExists],
              ["Production app integration", summary.publicBeta.productionAppIntegrationStatus],
            ]}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
              Public beta blockers
            </p>
            <ChipList
              items={summary.publicBeta.publicBetaBlockers}
              empty="No public beta blockers."
            />
          </div>
        </Section>

        <Section title="Beta Cohort Simulation">
          <KeyValueList
            rows={[
              ["Available", summary.betaCohortSimulation.betaCohortSimulationAvailable],
              ["Simulation risk", summary.betaCohortSimulation.simulationRiskLevel],
              ["Simulation blockers", summary.betaCohortSimulation.simulationBlockerCount],
              ["Design partner simulation ready", summary.betaCohortSimulation.designPartnerSimulationReady],
              ["Private beta simulation ready", summary.betaCohortSimulation.privateBetaSimulationReady],
              ["Public beta simulation ready", summary.betaCohortSimulation.publicBetaSimulationReady],
              ["Over-capacity simulation ready", summary.betaCohortSimulation.overCapacitySimulationReady],
              ["Required simulations passed", summary.betaCohortSimulation.requiredSimulationsPassed],
              ["Latest run", summary.betaCohortSimulation.latestRunAt],
            ]}
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
                Simulation blockers
              </p>
              <ChipList
                items={summary.betaCohortSimulation.blockers}
                empty="No simulation blockers."
              />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                Simulation warnings
              </p>
              <ChipList
                items={summary.betaCohortSimulation.warnings}
                empty="No simulation warnings."
              />
            </div>
          </div>
          <div className="mt-4">
            <Link className={buttonClass} href="/admin/beta-simulations">
              Open cohort simulations
            </Link>
          </div>
        </Section>

        <Section title="Matching Evaluation">
          <KeyValueList
            rows={[
              ["Available", summary.matchingEvaluation.matchingEvaluationAvailable],
              ["Last score", summary.matchingEvaluation.lastMatchingEvaluationScore],
              ["Last passed", summary.matchingEvaluation.lastMatchingEvaluationPassed],
              ["Failure count", summary.matchingEvaluation.matchingEvaluationFailureCount],
              ["Safety violations", summary.matchingEvaluation.matchingEvaluationSafetyViolationCount],
              ["Tuning recommendations", summary.matchingEvaluation.matchingEvaluationTuningRecommendationCount],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className={buttonClass} href="/admin/matching-evaluation">
              Open matching evaluation
            </Link>
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Fmatching-evaluation-tuning-v0.7.md"
            >
              View eval runbook
            </Link>
          </div>
        </Section>

        <Section title="Release Candidate">
          <KeyValueList
            rows={[
              ["Version", summary.releaseCandidate.releaseCandidateVersion],
              ["Tag", summary.releaseCandidate.releaseCandidateTag],
              ["Status", summary.releaseCandidate.releaseCandidateStatus],
              ["RC blockers", summary.releaseCandidate.releaseCandidateBlockerCount],
              ["Current action", summary.releaseCandidate.currentRecommendedAction],
              ["Post-A2P action", summary.releaseCandidate.postA2PNextAction],
            ]}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
              Release candidate blockers
            </p>
            <ChipList
              items={summary.releaseCandidate.releaseCandidateBlockers}
              empty="No unsafe RC blockers."
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Frelease-candidate-v0.1.md"
            >
              Open RC summary
            </Link>
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Fpost-a2p-execution-playbook.md"
            >
              Open post-A2P playbook
            </Link>
          </div>
        </Section>

        <Section title="Talent Discovery">
          <KeyValueList
            rows={[
              ["Available", summary.talentDiscovery.talentDiscoveryAvailable],
              ["Recent internal searches", summary.talentDiscovery.recentInternalSearchCount],
              ["Recent sourcing plans", summary.talentDiscovery.recentSourcingPlanCount],
              ["Recent public research plans", summary.talentDiscovery.recentPublicResearchPlanCount],
              ["Public web research enabled", summary.talentDiscovery.publicWebResearchEnabled],
              ["Public web research mode", summary.talentDiscovery.publicWebResearchMode],
              ["Public web shadow available", summary.talentDiscovery.publicWebResearchShadowAvailable],
              ["Live dry run available", summary.talentDiscovery.publicWebResearchLiveDryRunAvailable],
              ["Async research jobs", summary.talentDiscovery.publicWebResearchAsyncAvailable],
              ["Review cleanup available", summary.talentDiscovery.publicWebResearchReviewAvailable],
              ["Live dry run allowed", summary.talentDiscovery.publicWebResearchLiveDryRunAllowed],
              ["Recent live dry runs", summary.talentDiscovery.recentPublicWebLiveDryRunCount],
              ["Pending web jobs", summary.talentDiscovery.publicWebResearchPendingJobCount],
              ["Failed web jobs", summary.talentDiscovery.publicWebResearchFailedJobCount],
              ["Last citation count", summary.talentDiscovery.publicWebResearchLastCitationCount],
              ["Public web pending review", summary.talentDiscovery.publicWebResultsPendingReviewCount],
              ["Needs contact research", summary.talentDiscovery.publicWebNeedsMoreContactResearchCount],
              ["Public web duplicates", summary.talentDiscovery.publicWebDuplicateCount],
              ["Public web DNC", summary.talentDiscovery.publicWebDoNotContactCount],
              ["Contactability evidence", summary.talentDiscovery.contactabilityEvidenceAvailable],
              ["Contactability pending", summary.talentDiscovery.contactabilityPendingReviewCount],
              ["Contactability high risk", summary.talentDiscovery.contactabilityHighRiskCount],
              ["Public web review risk", summary.talentDiscovery.publicWebReviewRiskLevel],
              ["Public web risk", summary.talentDiscovery.publicWebResearchRiskLevel],
              ["Candidate review queue", summary.talentDiscovery.candidateReviewQueueCount],
              ["Quality review available", summary.talentResearchQuality.talentResearchQualityAvailable],
              ["Pending quality reviews", summary.talentResearchQuality.pendingTalentQualityReviewCount],
              ["Approved quality reviews", summary.talentResearchQuality.approvedTalentQualityReviewCount],
              ["Needs more research", summary.talentResearchQuality.needsMoreResearchCount],
              ["Rejected candidates", summary.talentResearchQuality.rejectedTalentCandidateCount],
              ["Do-not-contact candidates", summary.talentResearchQuality.doNotContactCandidateCount],
              ["Public web pending review", summary.talentResearchQuality.publicWebCandidatesPendingReviewCount],
              ["Talent quality risk", summary.talentResearchQuality.talentQualityRiskLevel],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className={buttonClass} href="/admin/sourcing">
              Open sourcing workbench
            </Link>
            <Link className={buttonClass} href="/admin/sourcing/public-web">
              Open web research
            </Link>
            <Link className={buttonClass} href="/admin/sourcing-quality">
              Open quality review
            </Link>
          </div>
        </Section>

        <Section title="Candidate Graph">
          <KeyValueList
            rows={[
              ["Available", summary.candidateGraph.candidateGraphAvailable],
              ["Relationship-aware matching", summary.candidateGraph.relationshipAwareMatchingAvailable],
              ["Search profiles", summary.candidateGraph.candidateSearchProfileCount],
              ["Graph edges", summary.candidateGraph.graphEdgeCount],
              ["Unverified research candidates", summary.candidateGraph.unverifiedResearchCandidateCount],
              ["Do-not-contact candidates", summary.candidateGraph.doNotContactCandidateCount],
              ["Public-web-only candidates", summary.candidateGraph.publicWebOnlyCandidateCount],
              ["Recent match runs", summary.candidateGraph.recentMatchRunCount],
              ["Pending match reviews", summary.candidateGraph.pendingMatchReviewCount],
              ["Internal candidate coverage", summary.candidateGraph.internalCandidateCoverage],
              ["Public-web candidate coverage", summary.candidateGraph.publicWebCandidateCoverage],
              ["Average candidate score", summary.candidateGraph.averageCandidateScore],
              ["High-risk matches", summary.candidateGraph.highRiskMatchCount],
              ["Do-not-contact/opt-out excluded", summary.candidateGraph.doNotContactExcludedCount],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className={buttonClass} href="/admin/candidate-graph">
              Open candidate graph
            </Link>
            <Link className={buttonClass} href="/admin/matching">
              Open matching
            </Link>
            <Link
              className={buttonClass}
              href="/admin/data-ops?doc=docs%2Fcandidate-graph-indexing-strategy.md"
            >
              Open indexing strategy
            </Link>
          </div>
        </Section>
      </div>

      <Section title="Kill Switch and Rollback Status">
        <div className="grid gap-3 lg:grid-cols-3">
          {summary.killSwitches.map((item) => (
            <article
              key={item.key}
              className={`rounded-md border p-3 ${
                item.severity === "danger"
                  ? "border-red-900 bg-red-950/30"
                  : item.severity === "warn"
                    ? "border-amber-900 bg-amber-950/30"
                    : "border-zinc-900 bg-zinc-950"
              }`}
            >
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                {item.key}
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                Current: <span className="font-semibold">{item.currentValue}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Expected: {item.expectedSafeValue}
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                {item.recommendedOperatorAction}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-4">
          <Link className={buttonClass} href="/admin/launch-drill">
            Open rollback drill
          </Link>
        </div>
      </Section>

      <Section title="Safe Action Hub">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summary.safeActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="rounded-md border border-zinc-900 bg-zinc-950 p-3 transition hover:border-zinc-700"
            >
              <p className="text-sm font-semibold text-zinc-100">{action.title}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{action.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-amber-200">
                {action.actionKind === "dry_run" ? "Dry run only" : "Runbook link"}
              </p>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <form action={evaluateCommandCenterAction} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
            <p className="text-sm font-semibold">Record command-center evaluation</p>
            <p className="mt-1 text-xs text-zinc-500">
              Writes redacted audit events only. No env vars change and no SMS is sent.
            </p>
            <textarea
              name="notes"
              rows={3}
              className={inputClass}
              placeholder="Optional operator note; audit stores note presence only"
            />
            <button className={`${buttonClass} mt-3`}>Record evaluation</button>
          </form>
          <form action={runLaunchReadinessDrillAction} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
            <p className="text-sm font-semibold">Run launch readiness drill</p>
            <p className="mt-1 text-xs text-zinc-500">
              Runs the existing launch drill simulation and audit trail.
            </p>
            <input type="hidden" name="notes" value="Invoked from command center" />
            <button className={`${buttonClass} mt-3`}>Run launch drill</button>
          </form>
        </div>
      </Section>

      <Section title="Runbooks">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary.runbooks.map((item) => (
            <div key={item.key} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 break-words font-mono text-xs text-zinc-500">{item.path}</p>
              <p className={`mt-2 text-xs ${item.exists ? "text-emerald-200" : "text-red-200"}`}>
                {item.exists ? "Available" : "Missing"}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
