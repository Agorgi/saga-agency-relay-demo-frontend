import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getRelationshipAwareMatchingWeights } from "@/lib/graph/matchingWeights";
import { getMatchingEvaluationHealthSnapshot } from "@/lib/matchingEval/matchingEvaluationHealth";
import { matchingEvalFixtures } from "@/lib/matchingEval/matchingEvalFixtures";
import {
  getMatchingEvaluationFixtureSummary,
  runMatchingEvaluation,
} from "@/lib/matchingEval/runMatchingEvaluation";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function MatchingEvaluationPage(props: {
  searchParams: Promise<{ fixtureId?: string; run?: string }>;
}) {
  const searchParams = await props.searchParams;
  const shouldRun = searchParams.run === "1";
  const fixtureId = searchParams.fixtureId || "";
  const [health, fixtureSummary] = [
    getMatchingEvaluationHealthSnapshot(),
    getMatchingEvaluationFixtureSummary(),
  ];
  const weights = getRelationshipAwareMatchingWeights();
  const report = shouldRun
    ? await runMatchingEvaluation({ fixtureId: fixtureId || undefined })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Synthetic ranking QA"
          title="Matching Evaluation"
          description="Run synthetic golden fixtures against smart matching, inspect pass/fail behavior, and review tuning recommendations."
          helpText="This page does not send SMS, contact candidates, create group chats, run live web research, send organizer shortlists, or use production Saga app data."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/matching">
            Open matching
          </Link>
          <Link className={buttonClass} href="/admin/candidate-graph">
            Open candidate graph
          </Link>
          <Link
            className={buttonClass}
            href="/admin/data-ops?doc=docs%2Fmatching-evaluation-tuning-v0.7.md"
          >
            Open eval docs
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Available", health.matchingEvaluationAvailable],
          ["Last score", health.lastMatchingEvaluationScore ?? "n/a"],
          ["Last passed", health.lastMatchingEvaluationPassed ?? "n/a"],
          ["Failure count", health.matchingEvaluationFailureCount ?? "n/a"],
          ["Safety violations", health.matchingEvaluationSafetyViolationCount ?? "n/a"],
          ["Tuning recs", health.matchingEvaluationTuningRecommendationCount ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              {label}
            </p>
            <p className="mt-2 break-words text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Run Evaluation">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input type="hidden" name="run" value="1" />
          <select name="fixtureId" defaultValue={fixtureId} className={inputClass}>
            <option value="">All fixtures</option>
            {matchingEvalFixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                {fixture.title}
              </option>
            ))}
          </select>
          <button className={buttonClass}>Run selected</button>
          <Link className={buttonClass} href="/admin/matching-evaluation?run=1">
            Run all
          </Link>
        </form>
        <p className="mt-3 text-sm text-zinc-500">
          Fixture count: {fixtureSummary.fixtureCount}. Candidate fixtures:{" "}
          {fixtureSummary.candidateCount}. Golden expectations:{" "}
          {fixtureSummary.expectationCount}. Use{" "}
          <code>npm run matching:evaluation-report</code> to write the redacted
          Markdown report.
        </p>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Weight Config">
          <dl className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
            {Object.entries(weights.baseWeights).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-zinc-500">
            Version: {weights.scoringVersion}. Evaluation can recommend changes
            but never applies them automatically.
          </p>
        </Section>

        <Section title="Current Run Summary">
          {!report ? (
            <p className="text-sm text-zinc-500">
              Choose a fixture or run all to view evaluation results.
            </p>
          ) : (
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={report.passed ? "PASSED" : "FAILED"} />
                <StatusBadge status={`SCORE_${report.averageScore}`} />
              </div>
              <p>Generated: {report.generatedAt}</p>
              <p>Fixtures run: {report.fixturesRun}</p>
              <p>Passed: {report.fixturePassCount}</p>
              <p>Failed: {report.fixtureFailCount}</p>
              <p>Safety violations: {report.safetyViolationCount}</p>
              <p>No SMS/Twilio/live-web/production-data required: true</p>
            </div>
          )}
        </Section>
      </div>

      {report ? (
        <Section title="Tuning Recommendations">
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">
            {report.tuningRecommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report ? (
        <Section title="Fixture Results">
          <div className="space-y-4">
            {report.results.map((result) => (
              <article
                key={result.fixtureId}
                className="rounded-md border border-zinc-900 bg-zinc-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{result.fixtureId}</h4>
                    <p className="mt-1 text-sm text-zinc-500">
                      {result.projectType} - score {result.score}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={result.passed ? "PASSED" : "FAILED"} />
                    <StatusBadge status={`POOL_${result.candidatePoolSize}`} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
                  <p>Top-K quality: {result.topKPrecision}</p>
                  <p>Role coverage: {result.roleCoverage}</p>
                  <p>Explanation quality: {result.explanationQuality}</p>
                  <p>Public web gating: {String(result.publicWebGatingCorrect)}</p>
                  <p>Proximity labels: {String(result.proximityLabelsCorrect)}</p>
                  <p>Contactability: {String(result.contactabilityHandlingCorrect)}</p>
                  <p>Safety violations: {result.safetyViolations.length}</p>
                  <p>Duration: {result.durationMs}ms</p>
                  <p>Results: {result.resultCount}</p>
                </div>
                <div className="mt-4 rounded-md border border-zinc-900 bg-black p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Expected vs actual notes
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Failures: {result.failures.join("; ") || "none"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Warnings: {result.warnings.join("; ") || "none"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
