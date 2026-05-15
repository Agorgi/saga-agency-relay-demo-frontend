import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getObservabilitySummary } from "@/sms-engine/observability/observabilitySummary";

export const dynamic = "force-dynamic";

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
      <p className="mt-2 text-2xl font-semibold">
        {value === null ? "n/a" : String(value)}
      </p>
    </div>
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

function KeyValueList({ rows }: { rows: Array<[string, string | number | boolean | null]> }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
          <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
          <dd className="mt-1 text-zinc-200">{value === null ? "n/a" : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function CountMap({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No recent activity.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
        >
          {key}: {value}
        </span>
      ))}
    </div>
  );
}

function riskTone(level: string): "safe" | "warn" | "danger" {
  if (level === "green") return "safe";
  if (level === "yellow") return "warn";
  return "danger";
}

export default async function ObservabilityPage() {
  const summary = await getObservabilitySummary();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System health"
        title="System Health"
        description="Check redacted pilot readiness, messaging, AI, pipeline, and risk signals."
        helpText="This page is read-only. It has no send controls, no environment editing, and no raw phone numbers or secrets."
      />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
          SENDS DISABLED: {String(summary.sms.sendsDisabled)}
        </span>
        <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
          ALLOWLIST REQUIRED: {String(summary.sms.allowlistRequired)}
        </span>
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200">
          PUBLIC LAUNCH DISABLED: {String(!summary.sms.publicLaunchEnabled)}
        </span>
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200">
          LLM ACTIVE LIVE DISABLED: {String(!summary.llm.activeLiveAllowed)}
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Risk level" value={summary.risk.level} tone={riskTone(summary.risk.level)} />
        <StatCard
          label="Database"
          value={summary.app.database}
          tone={summary.app.database === "connected" ? "safe" : "danger"}
        />
        <StatCard
          label="Blocked sends"
          value={summary.sms.recentBlockedSendCount}
          tone={summary.sms.recentBlockedSendCount > 0 ? "warn" : "safe"}
        />
        <StatCard
          label="Failed jobs"
          value={summary.pipeline.failedJobs}
          tone={(summary.pipeline.failedJobs || 0) > 0 ? "warn" : "safe"}
        />
        <StatCard
          label="Simulation risk"
          value={summary.betaCohortSimulation.simulationRiskLevel}
          tone={riskTone(summary.betaCohortSimulation.simulationRiskLevel)}
        />
      </section>

      <Section title="Risk and Recommended Actions">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Blockers</p>
            <ChipList items={summary.risk.blockers} empty="No red blockers." />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Warnings</p>
            <ChipList items={summary.risk.warnings} empty="No warnings." />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">Recommended actions</p>
            <ChipList items={summary.risk.recommendedActions} empty="No immediate action." />
          </div>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="System Health">
          <KeyValueList
            rows={[
              ["Generated at", summary.generatedAt],
              ["Environment", `${summary.environment.platform}/${summary.environment.environment}`],
              ["App ok", summary.app.ok],
              ["App base URL configured", summary.app.appBaseUrlConfigured],
              ["Admin configured", summary.app.adminConfigured],
              ["Internal API configured", summary.app.internalApiConfigured],
            ]}
          />
        </Section>

        <Section title="SMS Safety and Twilio">
          <KeyValueList
            rows={[
              ["Provider mode", summary.sms.providerMode],
              ["Sends disabled", summary.sms.sendsDisabled],
              ["Allowlist required", summary.sms.allowlistRequired],
              ["Allowed numbers count", summary.sms.allowedNumbersCount],
              ["Twilio staging mode", summary.sms.twilioStagingMode],
              ["Webhook validation", summary.sms.webhookValidationEnabled],
              ["Compliance approved", summary.sms.smsComplianceApproved],
              ["Public launch enabled", summary.sms.publicLaunchEnabled],
              ["Recent inbound", summary.sms.recentInboundCount],
              ["Recent outbound", summary.sms.recentOutboundCount],
              ["Unexpected outbound", summary.sms.unexpectedOutboundDetected],
            ]}
          />
        </Section>

        <Section title="LLM Health">
          <KeyValueList
            rows={[
              ["Provider", summary.llm.providerEffective],
              ["Mode", summary.llm.modeEffective],
              ["Model", summary.llm.model],
              ["Shadow mode", summary.llm.shadowMode],
              ["Active mock available", summary.llm.activeMockAvailable],
              ["Active live allowed", summary.llm.activeLiveAllowed],
              ["Recent calls", summary.llm.recentCallCount],
              ["Recent successes", summary.llm.recentSuccessCount],
              ["Recent failures", summary.llm.recentFailureCount],
              ["Recent fallbacks", summary.llm.recentFallbackCount],
              ["Fallback rate", formatFallbackRate(summary.llm.fallbackRate)],
            ]}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              Top failure categories
            </p>
            <CountMap counts={summary.llm.topFailureCategories} />
          </div>
        </Section>

        <Section title="Conversation Engine">
          <KeyValueList
            rows={[
              ["Intent classifications", summary.conversation.recentIntentClassifications],
              ["Reply plans", summary.conversation.recentReplyPlans],
              ["Needs admin", summary.conversation.needsAdminCount],
            ]}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              Flow counts
            </p>
            <CountMap counts={summary.conversation.flowCounts} />
          </div>
        </Section>

        <Section title="Producer Agent Activity">
          <KeyValueList
            rows={[
              ["Project understandings", summary.producer.recentProjectUnderstandingCount],
              ["Role maps", summary.producer.recentRoleMapCount],
              ["Candidate recommendations", summary.producer.recentCandidateRecommendationCount],
              ["Shortlist drafts", summary.producer.recentShortlistDraftCount],
              ["Draft readiness checks", summary.producer.recentDraftReadinessCount],
            ]}
          />
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
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/sourcing"
            >
              Open sourcing workbench
            </Link>
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/sourcing/public-web"
            >
              Open public web shadow research
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
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/candidate-graph"
            >
              Open candidate graph
            </Link>
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/matching"
            >
              Open matching
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
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/matching-evaluation"
            >
              Open matching evaluation
            </Link>
          </div>
        </Section>

        <Section title="Pipeline Jobs">
          <KeyValueList
            rows={[
              ["Processing mode", summary.pipeline.messageProcessingMode],
              ["Pending jobs", summary.pipeline.pendingJobs],
              ["Processing jobs", summary.pipeline.processingJobs],
              ["Succeeded jobs", summary.pipeline.succeededJobs],
              ["Failed jobs", summary.pipeline.failedJobs],
              ["Retryable jobs", summary.pipeline.retryableJobs],
              ["Oldest pending age seconds", summary.pipeline.oldestPendingJobAgeSeconds],
            ]}
          />
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/pipeline"
            >
              Open pipeline jobs
            </Link>
          </div>
        </Section>

        <Section title="Pilot Readiness">
          <KeyValueList
            rows={[
              ["Pilot stage", summary.pilot.pilotStage],
              ["Pilot reply mode", summary.pilot.pilotReplyMode],
              ["Access mode", summary.pilot.accessMode],
              ["Access mode effective", summary.pilot.accessModeEffective],
              ["Public beta enabled", summary.pilot.publicBetaEnabled],
              ["Active participants", summary.pilot.activeParticipants],
              ["Waitlisted participants", summary.pilot.waitlistedParticipants],
              ["Participant cap", `${summary.pilot.capUsage.active ?? "n/a"}/${summary.pilot.capUsage.max}`],
              ["Invite codes", summary.pilot.inviteCodeCount],
              ["Blocked inbound access", summary.pilot.recentBlockedInboundCount],
              ["Paused participants", summary.pilot.pausedParticipants],
              ["Opted-out participants", summary.pilot.optedOutParticipants],
              ["Recent feedback", summary.pilot.recentFeedbackCount],
              ["Outbound self-test available", summary.pilot.designPartnerReadiness.outboundSelfTestReadinessAvailable],
              ["Auto replies enabled", summary.pilot.designPartnerReadiness.autoRepliesEnabled],
            ]}
          />
        </Section>

        <Section title="Capped Public Beta">
          <KeyValueList
            rows={[
              ["Waitlist entries", summary.publicBeta.publicBetaWaitlistCount],
              ["Admitted entries", summary.publicBeta.publicBetaAdmittedCount],
              ["Paused entries", summary.publicBeta.publicBetaPausedCount],
              ["Rejected entries", summary.publicBeta.publicBetaRejectedCount],
              [
                "Cap usage",
                `${summary.publicBeta.publicBetaCapUsage.admitted ?? "n/a"}/${summary.publicBeta.publicBetaCapUsage.max}`,
              ],
              ["Daily new users", summary.publicBeta.publicBetaDailyNewUserCount],
              ["Public beta ready", summary.publicBeta.publicBetaReadiness],
              ["Public beta blockers", summary.publicBeta.publicBetaBlockerCount],
              ["Public number visible", summary.publicBeta.publicBetaPublicNumberVisible],
            ]}
          />
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/public-beta"
            >
              Open public beta dashboard
            </Link>
          </div>
        </Section>

        <Section title="Beta Cohort Simulation">
          <KeyValueList
            rows={[
              ["Available", summary.betaCohortSimulation.betaCohortSimulationAvailable],
              ["Risk", summary.betaCohortSimulation.simulationRiskLevel],
              ["Blockers", summary.betaCohortSimulation.simulationBlockerCount],
              ["Design partner simulation ready", summary.betaCohortSimulation.designPartnerSimulationReady],
              ["Private beta simulation ready", summary.betaCohortSimulation.privateBetaSimulationReady],
              ["Public beta simulation ready", summary.betaCohortSimulation.publicBetaSimulationReady],
              ["Over-capacity simulation ready", summary.betaCohortSimulation.overCapacitySimulationReady],
              ["Latest run", summary.betaCohortSimulation.latestRunAt],
            ]}
          />
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/beta-simulations"
            >
              Open beta cohort simulations
            </Link>
          </div>
        </Section>

        <Section title="Pilot Data Operations">
          <KeyValueList
            rows={[
              ["Data ops available", summary.dataOps.pilotDataOpsAvailable],
              ["Recent exports", summary.dataOps.exportCountRecent],
              ["Recent redactions", summary.dataOps.redactionCountRecent],
              ["Paused participants", summary.dataOps.participantsPausedCount],
              ["Opted-out participants", summary.dataOps.participantsOptedOutCount],
              ["Backup checklist", summary.dataOps.backupChecklistStatus],
              ["Retention policy exists", summary.dataOps.retentionPolicyExists],
              ["Incident runbook exists", summary.dataOps.incidentRunbookExists],
            ]}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              Data ops warnings
            </p>
            <ChipList
              items={summary.dataOps.dataOpsWarnings}
              empty="No data-ops document or checklist warnings."
            />
          </div>
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/data-ops"
            >
              Open data operations
            </Link>
          </div>
        </Section>

        <Section title="Launch Readiness Drill">
          <KeyValueList
            rows={[
              ["Launch drill available", summary.launchDrill.launchDrillAvailable],
              ["Recommended stage", summary.launchDrill.currentRecommendedLaunchStage],
              ["Launch risk", summary.launchDrill.launchRiskLevel],
              ["Launch blockers", summary.launchDrill.launchBlockerCount],
              ["Last drill run", summary.launchDrill.lastLaunchDrillRunAt],
              ["Design partner ready", summary.launchDrill.designPartnerLaunchReady],
              ["Public beta candidate ready", summary.launchDrill.publicBetaCandidateReady],
            ]}
          />
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/launch-drill"
            >
              Open launch drill
            </Link>
          </div>
        </Section>

        <Section title="Operator Command Center">
          <KeyValueList
            rows={[
              ["Command center available", true],
              ["Observability risk", summary.risk.level],
              ["Recommended launch stage", summary.launchDrill.currentRecommendedLaunchStage],
              ["Launch blockers", summary.launchDrill.launchBlockerCount],
              ["Sends disabled", summary.sms.sendsDisabled],
              ["Public launch enabled", summary.sms.publicLaunchEnabled],
            ]}
          />
          <div className="mt-4">
            <Link
              className="text-sm text-amber-200 underline-offset-4 hover:underline"
              href="/admin/command-center"
            >
              Open command center
            </Link>
          </div>
        </Section>

        <Section title="Runbooks">
          <div className="flex flex-wrap gap-2">
            {[
              ["/docs/production-observability.md", "Production observability"],
              ["/docs/incident-response-runbook.md", "Incident response"],
              ["/docs/pilot-data-inventory.md", "Pilot data inventory"],
              ["/docs/pilot-backup-restore-runbook.md", "Backup and restore"],
              ["/docs/pilot-data-incident-runbook.md", "Pilot data incident"],
              ["/docs/pilot-rollback-runbook.md", "Pilot rollback"],
              ["/docs/outbound-sms-self-test-runbook.md", "Outbound self-test"],
              ["/docs/public-launch-foundations.md", "Public launch foundations"],
              ["/docs/talent-discovery-engine-v0.1.md", "Talent discovery"],
              ["/docs/public-web-research-policy.md", "Public web research policy"],
              ["/docs/public-web-research-live-dry-run-v0.4.md", "Public web live dry run"],
            ].map(([href, label]) => (
              <span
                key={href}
                className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Docs are repo files for operator review; no public launch docs are
            served from this page.
          </p>
        </Section>
      </div>
    </div>
  );
}

function formatFallbackRate(value: number | string) {
  if (typeof value !== "number") {
    return String(value);
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }

  return `${Math.round(value)}%`;
}
