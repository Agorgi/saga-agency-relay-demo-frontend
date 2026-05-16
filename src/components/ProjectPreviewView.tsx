"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import {
  buildHostBriefDraft,
  buildHostBriefProject,
  encodeHostBriefPrefill,
  persistHostBriefHandoff,
  resolveHostBriefPrefill,
} from "@/lib/hostBriefHandoff";
import {
  buildOrganizerProgressLabel,
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromPrefill,
  organizerFieldLabel,
} from "@/lib/sagasanOrganizerIntake";
import { readPendingNextStep } from "@/lib/webChatNextStep";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function ProjectPreviewView({
  encodedPrefill,
}: {
  encodedPrefill: string | null;
}) {
  const createProjectFromBriefDraft = useAgencyStore(
    (state) => state.createProjectFromBriefDraft,
  );
  const projects = useAgencyStore((state) => state.projects);
  const isDark = useThemeMode() === "dark";
  const router = useRouter();
  const [showPlan, setShowPlan] = useState(false);

  const prefill = useMemo(() => {
    const fromQueryOrSession = resolveHostBriefPrefill({ encodedPrefill });
    if (fromQueryOrSession) {
      return fromQueryOrSession;
    }

    return readPendingNextStep("/projects/new")?.prefill ?? null;
  }, [encodedPrefill]);
  const draft = useMemo(
    () => (prefill ? buildHostBriefDraft(prefill) : null),
    [prefill],
  );
  const organizerFields = useMemo(
    () => extractOrganizerIntakeFieldsFromPrefill(prefill),
    [prefill],
  );
  const readiness = useMemo(
    () => evaluateOrganizerBriefReadiness(organizerFields),
    [organizerFields],
  );
  const previewProject = useMemo(
    () => (prefill ? buildHostBriefProject(prefill) : null),
    [prefill],
  );
  const recentProjects = useMemo(
    () => projects.slice(0, 3),
    [projects],
  );
  const encodedResolvedPrefill = useMemo(
    () => encodeHostBriefPrefill(prefill),
    [prefill],
  );

  useEffect(() => {
    if (!prefill || !previewProject) {
      return;
    }

    persistHostBriefHandoff({
      projectId: previewProject.id,
      prefill,
    });
  }, [prefill, previewProject]);

  const missingRequiredLabels = useMemo(
    () =>
      readiness.missingRequiredFields.map((field) => organizerFieldLabel(field)),
    [readiness],
  );
  const stageLabel =
    readiness.stage === "talent_search_ready"
      ? "Crew search ready"
      : readiness.stage === "production_plan_ready"
        ? "Plan ready"
        : readiness.stage === "draft_brief_ready"
          ? "Partial brief"
          : readiness.stage === "intake_in_progress"
            ? "Intake in progress"
            : "Seed idea";

  function returnToChat() {
    requestWebChatReset("host");
    const suffix = encodedResolvedPrefill
      ? `?intent=host&prefill=${encodeURIComponent(encodedResolvedPrefill)}`
      : "?intent=host";
    router.push(`/${suffix}`);
  }

  if (!prefill || !draft || !previewProject) {
    return (
      <div
        className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-24 pt-24 md:px-6 md:pt-28 ${
          isDark ? "text-white" : "text-ink"
        }`}
      >
        <div className="mx-auto max-w-[760px] space-y-6">
          <section
            className={`rounded-[30px] p-5 sm:p-7 ${
              isDark ? "brand-surface-deep" : "brand-surface-strong"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
              New project
            </p>
            <h1
              data-copy-lint="header"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
            >
              Start with Sagasan.
            </h1>
            <p
              data-copy-lint="subhead"
              className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}
            >
              Start in chat first.
            </p>
          </section>

          <section
            className={`rounded-[26px] border p-6 ${
              isDark
                ? "border-white/8 bg-white/[0.04]"
                : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
            }`}
            >
            <button
              onClick={() => {
                requestWebChatReset("host");
                router.push("/?intent=host");
              }}
              className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium"
            >
                Talk to Sagasan
              </button>

              <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/60" : "text-ink-light"}`}>
              Sagasan builds the brief with you first, then this page turns that context into a reviewable draft.
              </p>
            </section>

          {recentProjects.length ? (
            <section
              className={`rounded-[26px] border p-6 ${
                isDark
                  ? "border-white/8 bg-white/[0.04]"
                  : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
              }`}
            >
              <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                Recent drafts.
              </h2>
              <div className="mt-4 space-y-3">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.slug}`)}
                    className={`block w-full rounded-[22px] px-4 py-3 text-left ${
                      isDark ? "bg-white/[0.05]" : "bg-canvas"
                    }`}
                  >
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>
                      {project.title}
                    </p>
                    <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                      {project.city} · {project.dateLabel}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {encodedResolvedPrefill ? (
            <section
              className={`rounded-[26px] border p-6 ${
                isDark
                  ? "border-white/8 bg-white/[0.04]"
                  : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
              }`}
            >
              <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                Continue latest draft.
              </h2>
              <button
                onClick={() => router.push(`/projects/new?prefill=${encodeURIComponent(encodedResolvedPrefill)}`)}
                className="brand-button-primary mt-4 rounded-pill px-4 py-2.5 text-sm font-medium"
              >
                Continue draft
              </button>
            </section>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-24 pt-24 md:px-6 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[880px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[30px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
            New project
          </p>
          <h1
            data-copy-lint="header"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            Here&apos;s what I heard.
          </h1>
          <p
            data-copy-lint="subhead"
            className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}
          >
            Does this look right?
          </p>
        </motion.section>

        <section
          className={`rounded-[28px] border p-6 ${
            isDark
              ? "border-white/8 bg-white/[0.04]"
              : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
              {stageLabel}
            </p>
            <p className={`text-xs ${isDark ? "text-white/58" : "text-ink-light"}`}>
              {buildOrganizerProgressLabel(readiness)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PreviewLine label="Project idea" value={String(prefill.projectIdea || previewProject.title || "Not answered yet.")} />
            <PreviewLine label="Format" value={String(prefill.scopeFormat || prefill.eventType || draft.projectType || "Not answered yet.")} />
            <PreviewLine label="City" value={String(prefill.city || draft.city || "Not answered yet.")} />
            <PreviewLine label="Attendance" value={String(prefill.expectedAttendance || prefill.scale || "Not answered yet.")} />
            <PreviewLine label="Timing" value={String(prefill.date || draft.dateLabel || "Not answered yet.")} />
            <PreviewLine label="Vibe" value={String(prefill.themeVibe || prefill.vibe || "Not answered yet.")} />
            <PreviewLine label="Budget" value={String(prefill.budget || "Not answered yet.")} />
            <PreviewLine label="Help needed" value={String(prefill.helpNeeded || "Not answered yet.")} />
          </div>

          <div className="mt-5">
            <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
              Auto-derived roles
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.roles.map((role) => (
                <span
                  key={role}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                    isDark ? "bg-white/8 text-white/74" : "bg-canvas text-ink"
                  }`}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <InfoPanel
              dark={isDark}
              label="What we know"
              lines={Object.entries(readiness.knownFields)
                .slice(0, 8)
                .map(([field, value]) => `${organizerFieldLabel(field as Parameters<typeof organizerFieldLabel>[0])}: ${value}`)}
            />
            <InfoPanel
              dark={isDark}
              label="Still missing"
              lines={
                missingRequiredLabels.length
                  ? missingRequiredLabels.map((field) => `${field}: Not answered yet.`)
                  : ["Enough signal is in place for the next stage."]
              }
            />
          </div>

          {readiness.enoughInfoForProductionPlan ? (
            <>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowPlan((current) => !current)}
                  className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
                >
                  {showPlan ? "Hide plan" : "Build plan"}
                </button>
              </div>

              {showPlan ? (
                <div
                  className={`mt-6 rounded-[24px] border p-5 ${
                    isDark ? "border-white/10 bg-white/[0.04]" : "border-black/8 bg-white"
                  }`}
                >
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                    Production plan
                  </p>
                  <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/72" : "text-ink-light"}`}>
                    {previewProject.staffingPlan.summary}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <PreviewLine label="Timeline" value={previewProject.staffingPlan.recommendedTimeline} />
                    <PreviewLine label="Budget plan" value={previewProject.staffingPlan.estimatedBudgetRange} />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {!readiness.enoughInfoForProductionPlan ? (
              <button
                onClick={returnToChat}
                className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Keep answering
              </button>
            ) : null}

            {readiness.enoughInfoForTalentSearch ? (
              <button
                onClick={() => {
                  const nextProject = createProjectFromBriefDraft(draft);
                  const firstRole = nextProject.requiredRoles[0]?.name || null;
                  const nextPrefill = encodedResolvedPrefill;
                  persistHostBriefHandoff({
                    projectId: nextProject.id,
                    prefill,
                  });
                  const params = new URLSearchParams({
                    projectId: nextProject.id,
                  });
                  if (firstRole) {
                    params.set("role", firstRole);
                  }
                  if (nextPrefill) {
                    params.set("prefill", nextPrefill);
                  }
                  router.push(`/explore?${params.toString()}`);
                }}
                className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Find my crew
              </button>
            ) : null}

            <button
              onClick={returnToChat}
              className={`text-sm font-medium ${
                isDark ? "text-white/72" : "text-ink-light"
              }`}
            >
              Edit details
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-canvas px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-light">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-ink">{value}</p>
    </div>
  );
}

function InfoPanel({
  dark,
  label,
  lines,
}: {
  dark: boolean;
  label: string;
  lines: string[];
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 ${
        dark ? "border-white/10 bg-white/[0.04]" : "border-black/8 bg-white"
      }`}
    >
      <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/42" : "text-ink-light"}`}>
        {label}
      </p>
      <div className="mt-3 space-y-2">
        {lines.map((line) => (
          <p
            key={line}
            className={`text-sm leading-6 ${dark ? "text-white/72" : "text-ink-light"}`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
