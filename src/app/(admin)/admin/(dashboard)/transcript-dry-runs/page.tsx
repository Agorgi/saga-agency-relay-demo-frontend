import Link from "next/link";
import { markTranscriptDryRunReviewAction } from "@/app/(admin)/admin/(dashboard)/transcript-dry-runs/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { designPartnerTranscriptScenarios } from "@/sms-engine/dryRuns/designPartnerTranscriptScenarios";
import {
  runDesignPartnerTranscriptDryRuns,
  summarizeDesignPartnerTranscriptDryRuns,
  type DesignPartnerTranscriptDryRunResult,
} from "@/sms-engine/dryRuns/runDesignPartnerTranscript";

export const dynamic = "force-dynamic";

const buttonClass =
  "rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function boolText(value: boolean) {
  return value ? "true" : "false";
}

function statCard({
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

function transcriptPreview(result: DesignPartnerTranscriptDryRunResult) {
  return (
    <div className="mt-4 space-y-3">
      {result.turns.map((turn) => (
        <div
          key={turn.turnNumber}
          className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={`TURN_${turn.turnNumber}`} />
            <StatusBadge status={turn.classifiedIntent} />
            <StatusBadge status={turn.nextStage} />
            <StatusBadge status={turn.selectedReplySource} />
            {turn.fallbackUsed ? <StatusBadge status="FALLBACK_USED" /> : null}
            {turn.forbiddenClaimsDetected ? (
              <StatusBadge status="FORBIDDEN_CLAIM" />
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 text-sm lg:grid-cols-3">
            <div>
              <p className="font-medium text-zinc-200">User</p>
              <p className="mt-1 text-zinc-500">{turn.userMessage}</p>
            </div>
            <div>
              <p className="font-medium text-zinc-200">Deterministic</p>
              <p className="mt-1 text-zinc-500">{turn.deterministicReply}</p>
            </div>
            <div>
              <p className="font-medium text-zinc-200">OpenAI / selected</p>
              <p className="mt-1 text-zinc-500">
                {turn.llmReply || "No OpenAI output captured for this turn."}
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Selected: {turn.selectedReply}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-3">
            <p>
              Missing required:{" "}
              {turn.missingRequiredFields.join(", ") || "none"}
            </p>
            <p>Fallback reason: {turn.fallbackReason || "none"}</p>
            <p>
              Ambiguity: {turn.ambiguityNotes.join("; ") || "none"}
            </p>
          </div>
          {turn.failures.length > 0 || turn.warnings.length > 0 ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-red-200">Failures</p>
                <ul className="mt-1 space-y-1 text-xs text-red-200/80">
                  {turn.failures.map((failure) => (
                    <li key={failure}>{failure}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-200">Warnings</p>
                <ul className="mt-1 space-y-1 text-xs text-amber-200/80">
                  {turn.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default async function TranscriptDryRunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const runParam = paramValue(params.run);
  const scenarioParam = paramValue(params.scenario);
  const shouldRun = runParam === "all" || Boolean(scenarioParam);
  const results = shouldRun
    ? await runDesignPartnerTranscriptDryRuns({
        scenarioIds: scenarioParam ? [scenarioParam] : undefined,
      })
    : [];
  const summary = summarizeDesignPartnerTranscriptDryRuns({
    results: shouldRun ? results : null,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Design partner simulation
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Transcript dry runs
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Runs synthetic organizer, creator, interest-check, and contact-reply
            conversations through the real Conversation Engine and dry-run LLM
            language path. No SMS is sent, no Twilio send API is called, and no
            real design partner data is used.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form method="get">
            <input type="hidden" name="run" value="all" />
            <button className={buttonClass}>Run all dry runs</button>
          </form>
          <Link href="/admin/llm-review" className={buttonClass}>
            Open LLM review
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCard({
          label: "Ran at",
          value: summary.ranAt ? new Date(summary.ranAt).toLocaleTimeString() : "not run",
        })}
        {statCard({
          label: "Scenarios passed",
          value: `${summary.scenariosPassed}/${summary.scenarioCount}`,
          tone: summary.readyForDryRunReview ? "safe" : "warn",
        })}
        {statCard({
          label: "Average score",
          value: summary.averageScore,
          tone: summary.averageScore >= 10 ? "safe" : "warn",
        })}
        {statCard({
          label: "Ready for live pilot",
          value: boolText(summary.readyForDesignPartners),
          tone: summary.readyForDesignPartners ? "warn" : "safe",
        })}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            status={
              summary.readyForDryRunReview
                ? "DRY_RUNS_PASS"
                : "DRY_RUNS_NOT_READY"
            }
          />
          <StatusBadge status="NO_SMS" />
          <StatusBadge status="NO_TWILIO_SEND_API" />
          <StatusBadge status="NO_PRODUCTION_DATA" />
          <StatusBadge status="ACTIVE_LIVE_DISABLED" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-zinc-200">Blockers</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-500">
              {summary.blockers.length > 0 ? (
                summary.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))
              ) : (
                <li>No dry-run blockers.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">Warnings</p>
            <ul className="mt-2 space-y-1 text-sm text-zinc-500">
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-lg font-semibold">Scenario fixtures</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {designPartnerTranscriptScenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {scenario.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {scenario.persona.name} | {scenario.persona.type}
                  </p>
                </div>
                <form method="get">
                  <input type="hidden" name="scenario" value={scenario.id} />
                  <button className={buttonClass}>Run one</button>
                </form>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {scenario.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={scenario.persona.expectedFlow} />
                {scenario.safetyCritical ? (
                  <StatusBadge status="SAFETY_CRITICAL" />
                ) : null}
                <StatusBadge status={`${scenario.turns.length}_TURNS`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {results.length > 0 ? (
        <section className="space-y-4">
          {results.map((result) => (
            <article
              key={result.scenarioId}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={result.passed ? "PASS" : "FAIL"} />
                    <StatusBadge status={result.personaType} />
                    {result.llmUsed ? <StatusBadge status="LLM_USED" /> : null}
                    {result.fallbackUsed ? (
                      <StatusBadge status="FALLBACK_USED" />
                    ) : null}
                    {result.forbiddenClaimsDetected ? (
                      <StatusBadge status="FORBIDDEN_CLAIMS" />
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{result.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {result.scenarioId} | final stage {result.finalState.stage}
                  </p>
                </div>
                <div className="grid gap-2 text-right text-xs text-zinc-500">
                  <p>Score: {result.score}/14</p>
                  <p>Escalation correct: {boolText(result.escalationCorrect)}</p>
                  <p>Producer Agent: {result.producerAgent ? "ran" : "not run"}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {Object.entries(result.scoreBreakdown).map(([key, value]) =>
                  statCard({
                    label: key.replaceAll("_", " "),
                    value,
                    tone: value >= 1.5 ? "safe" : "warn",
                  }),
                )}
              </div>

              {transcriptPreview(result)}

              {result.producerAgent ? (
                <div className="mt-4 rounded-md border border-zinc-900 bg-zinc-950 p-3">
                  <p className="text-sm font-medium text-zinc-200">
                    Producer Agent dry-run output
                  </p>
                  <div className="mt-2 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                    <p>Title: {result.producerAgent.projectUnderstandingTitle}</p>
                    <p>City: {result.producerAgent.projectUnderstandingCity}</p>
                    <p>
                      Required roles:{" "}
                      {result.producerAgent.requiredRoles.join(", ") || "none"}
                    </p>
                    <p>
                      Optional roles:{" "}
                      {result.producerAgent.optionalRoles.join(", ") || "none"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {result.producerAgent.shortlistSummary}
                  </p>
                </div>
              ) : null}

              {result.failures.length > 0 || result.warnings.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-red-200">Failures</p>
                    <ul className="mt-2 space-y-1 text-sm text-red-200/80">
                      {result.failures.map((failure) => (
                        <li key={failure}>{failure}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-200">
                      Warnings
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-200/80">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <form
                action={markTranscriptDryRunReviewAction}
                className="mt-4 grid gap-3 border-t border-zinc-900 pt-4 md:grid-cols-[220px_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="scenarioId" value={result.scenarioId} />
                <label className="block text-sm font-medium text-zinc-300">
                  Mark output
                  <select name="reviewStatus" className={inputClass}>
                    {[
                      "good",
                      "confusing",
                      "wrong next question",
                      "too verbose",
                      "unsafe",
                      "better than fallback",
                      "worse than fallback",
                      "needs prompt tuning",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Review notes
                  <textarea
                    name="reviewerNotes"
                    rows={2}
                    className={inputClass}
                    placeholder="Admin-only notes. Do not include phone numbers, secrets, or production data."
                  />
                </label>
                <div className="flex items-end">
                  <button className={buttonClass}>Save marker</button>
                </div>
              </form>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
