"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import {
  buildBrowseAllTalentState,
  buildCrewRecommendationState,
} from "@/lib/buildMyCrewContracts";
import {
  buildHostBriefDraft,
  buildHostBriefProject,
  persistHostBriefHandoff,
  resolveHostBriefPrefill,
} from "@/lib/hostBriefHandoff";
import {
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromPrefill,
  organizerFieldLabel,
} from "@/lib/sagasanOrganizerIntake";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function ExploreTalentView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = useAgencyStore((state) => state.projects);
  const talentSearchQuery = useAgencyStore((state) => state.talentSearchQuery);
  const talentFilters = useAgencyStore((state) => state.talentFilters);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const createProjectFromBriefDraft = useAgencyStore(
    (state) => state.createProjectFromBriefDraft,
  );
  const setTalentSearchQuery = useAgencyStore((state) => state.setTalentSearchQuery);
  const updateTalentFilters = useAgencyStore((state) => state.updateTalentFilters);
  const resetTalentFilters = useAgencyStore((state) => state.resetTalentFilters);
  const addTalentToShortlist = useAgencyStore((state) => state.addTalentToShortlist);
  const { goHome, openTalentProfile } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";
  const hydratedBriefRef = useRef<string | null>(null);

  const projectSlug = searchParams.get("project");
  const roleParam = searchParams.get("role");
  const projectIdParam = searchParams.get("projectId");
  const encodedPrefill = searchParams.get("prefill");

  useEffect(() => {
    if (projectSlug) selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  useEffect(() => {
    if (roleParam) {
      updateTalentFilters({ role: roleParam });
    }
  }, [roleParam, updateTalentFilters]);

  const handoffPrefill = useMemo(
    () =>
      resolveHostBriefPrefill({
        encodedPrefill,
        projectId: projectIdParam,
      }),
    [encodedPrefill, projectIdParam],
  );
  const handoffProject = useMemo(
    () => (handoffPrefill ? buildHostBriefProject(handoffPrefill) : null),
    [handoffPrefill],
  );
  const handoffDraft = useMemo(
    () => (handoffPrefill ? buildHostBriefDraft(handoffPrefill) : null),
    [handoffPrefill],
  );
  const organizerReadiness = useMemo(
    () => evaluateOrganizerBriefReadiness(extractOrganizerIntakeFieldsFromPrefill(handoffPrefill)),
    [handoffPrefill],
  );

  useEffect(() => {
    if (
      !handoffDraft ||
      !handoffProject ||
      !projectIdParam ||
      projects.some((project) => project.id === projectIdParam) ||
      hydratedBriefRef.current === projectIdParam
    ) {
      return;
    }

    const createdProject = createProjectFromBriefDraft(handoffDraft);
    persistHostBriefHandoff({
      projectId: createdProject.id,
      prefill: handoffPrefill || {},
    });
    hydratedBriefRef.current = projectIdParam;
  }, [
    createProjectFromBriefDraft,
    handoffDraft,
    handoffPrefill,
    handoffProject,
    projectIdParam,
    projects,
  ]);

  const activeProject =
    projects.find((project) => project.id === projectIdParam) ||
    (projectIdParam ? handoffProject : null) ||
    projects.find((project) => project.slug === projectSlug) ||
    null;
  const hasHandoffProject = Boolean(handoffPrefill && handoffProject);
  const talentSearchBlocked = hasHandoffProject && !organizerReadiness.enoughInfoForTalentSearch;

  const talent = useAgencyStore((state) => state.talent);
  const roleOptions = useMemo(
    () => ["All roles", ...new Set(talent.flatMap((profile) => profile.roles))].slice(0, 16),
    [talent],
  );
  const cityOptions = useMemo(
    () => ["All cities", ...new Set(talent.map((profile) => profile.city))].slice(0, 12),
    [talent],
  );
  const tagOptions = useMemo(
    () => ["All tags", ...new Set(talent.flatMap((profile) => profile.tags))].slice(0, 14),
    [talent],
  );

  // Only show "Shortlisting into …" when the URL explicitly indicates a
  // project. Without an explicit param, a stale Zustand-store selection
  // (default: Beauty Brand fixture) used to leak into the cold-load header.
  // Closes P1-OI-4 — see docs/open-issues.md.
  const hasExplicitProjectParam = Boolean(projectIdParam || projectSlug);
  const shortlistTarget = hasExplicitProjectParam ? activeProject : null;
  // On cold-load (no active project), fall back to a "browse all
  // talent" surface populated from the raw demo dataset. This restores
  // the grid that was inadvertently emptied when PR e9e7bc6 removed
  // the default-project fallback while fixing the Beauty Brand label
  // leak. The browse-all surface is honest about its lack of project
  // scoring: brief=null, candidates are tagged demo_seed, no
  // shortlist target chips appear.
  const recommendationState = useMemo(
    () =>
      activeProject
        ? buildCrewRecommendationState({
            project: activeProject,
            prefill: handoffPrefill,
            searchQuery: talentSearchQuery,
            filters: talentFilters,
          })
        : buildBrowseAllTalentState({
            talent,
            searchQuery: talentSearchQuery,
            filters: talentFilters,
          }),
    [activeProject, handoffPrefill, talent, talentFilters, talentSearchQuery],
  );
  const surfacedCount = recommendationState.candidateGroups.reduce(
    (count, group) => count + group.candidates.length,
    0,
  );

  const missingRequiredLabels = useMemo(
    () =>
      organizerReadiness.missingRequiredFields.map((field) => organizerFieldLabel(field)),
    [organizerReadiness],
  );

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1260px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`overflow-hidden rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
          }`}
        >
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                Discover
              </p>
              <h1
                data-copy-lint="header"
                className="mt-3 text-[2.3rem] font-semibold leading-[0.96] tracking-tight sm:text-5xl"
              >
                Talent in your world.
              </h1>
              <p
                data-copy-lint="subhead"
                className={`mt-4 max-w-[720px] text-sm leading-7 sm:text-base ${isDark ? "text-white/64" : "text-ink-light"}`}
              >
                Picks shaped by context.
              </p>
              {shortlistTarget ? (
                <div className={`mt-5 inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm ${
                  isDark ? "border-white/10 bg-white/8 text-white/78" : "border-[#7bc6ff]/24 bg-[#edf5ff] text-[#173250]"
                }`}>
                  <span className="font-medium">Shortlisting into</span>
                  <span>{shortlistTarget.title}</span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoChip label="Portfolio fit" value="Visual style overlap." dark={isDark} />
              <InfoChip label="Budget fit" value="Rate and scope match." dark={isDark} />
              <InfoChip label="Audience fit" value="Cultural pull matters." dark={isDark} />
              <InfoChip label="Availability" value="Who can move now." dark={isDark} />
            </div>
          </div>

          {!activeProject ? (
            <div className={`mt-6 rounded-[24px] border px-4 py-4 ${
              isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
            }`}>
              <p className={`text-sm leading-7 ${isDark ? "text-white/68" : "text-ink-light"}`}>
                Browse demo profiles below, or tell Saga what you&apos;re planning for a project-scored shortlist.
              </p>
              <button
                onClick={() => {
                  requestWebChatReset("host");
                  goHome();
                }}
                className="brand-button-primary mt-3 rounded-pill px-4 py-2.5 text-sm font-medium"
              >
                Open chat
              </button>
            </div>
          ) : null}

          {talentSearchBlocked ? (
            <div className={`mt-6 rounded-[24px] border px-4 py-4 ${
              isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
            }`}>
              <p className={`text-sm leading-7 ${isDark ? "text-white/72" : "text-ink-light"}`}>
                Saga needs a little more project detail before searching for talent.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingRequiredLabels.map((field) => (
                  <span
                    key={field}
                    className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                      isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink"
                    }`}
                  >
                    {field}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (encodedPrefill) {
                    params.set("prefill", encodedPrefill);
                  }
                  router.push(params.size ? `/projects/new?${params.toString()}` : "/projects/new");
                }}
                className="brand-button-primary mt-4 rounded-pill px-4 py-2.5 text-sm font-medium"
              >
                Return to brief
              </button>
            </div>
          ) : null}

          {recommendationState.brief ? (
            <div className="mt-6 space-y-4">
              <div
                className={`rounded-[24px] border px-4 py-4 ${
                  isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-[10px] uppercase tracking-[0.22em] ${
                        isDark ? "text-white/42" : "text-ink-light"
                      }`}
                    >
                      Current brief
                    </p>
                    <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                      {recommendationState.brief.projectIdea}
                    </h2>
                  </div>
                  <span
                    className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                      isDark ? "bg-white/10 text-white/72" : "bg-canvas text-ink-light"
                    }`}
                  >
                    {recommendationState.brief.sourceMode === "brief_handoff"
                      ? "Brief from Sagasan"
                      : "Saved project view"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SnapshotLine
                    label="City"
                    value={recommendationState.brief.city}
                    dark={isDark}
                  />
                  <SnapshotLine
                    label="Timing"
                    value={recommendationState.brief.dateWindow}
                    dark={isDark}
                  />
                  <SnapshotLine
                    label="Scale"
                    value={recommendationState.brief.scale}
                    dark={isDark}
                  />
                  <SnapshotLine
                    label="Vibe"
                    value={
                      recommendationState.brief.vibeTags.length
                        ? recommendationState.brief.vibeTags.join(", ")
                        : "Not specified yet"
                    }
                    dark={isDark}
                  />
                </div>
              </div>

              <div
                className={`rounded-[24px] border px-4 py-4 text-sm leading-7 ${
                  isDark ? "border-white/10 bg-white/8 text-white/72" : "border-black/8 bg-white text-ink-light"
                }`}
              >
                {recommendationState.noOneContactedDisclaimer}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {recommendationState.suggestedRoles.map((role) => (
                  <div
                    key={role.id}
                    className={`rounded-[22px] border px-4 py-3 ${
                      isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-ink"}`}>
                      {role.role}
                    </p>
                    <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/68" : "text-ink-light"}`}>
                      {role.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!talentSearchBlocked ? (
          <div className="mt-6 flex flex-col gap-3">
            <label className={`flex items-center gap-3 rounded-[24px] border px-4 py-3 ${
              isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
            }`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={isDark ? "text-white/40" : "text-ink-light"}>
                <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                value={talentSearchQuery}
                onChange={(event) => setTalentSearchQuery(event.target.value)}
                placeholder="Find a photographer for a J-fashion shoot in LA"
                className={`w-full bg-transparent text-sm outline-none ${
                  isDark ? "text-white placeholder:text-white/30" : "text-ink placeholder:text-ink-light"
                }`}
              />
            </label>

            <details className="group">
              <summary className={`flex w-fit cursor-pointer list-none items-center gap-2 rounded-pill border px-4 py-3 text-sm font-medium ${
                isDark ? "border-white/10 bg-white/8 text-white/72" : "border-black/8 bg-white text-ink"
              }`}>
                Narrow this
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                <FilterSelect
                  value={talentFilters.role}
                  onChange={(value) => updateTalentFilters({ role: value })}
                  options={roleOptions}
                  dark={isDark}
                />
                <FilterSelect
                  value={talentFilters.city}
                  onChange={(value) => updateTalentFilters({ city: value })}
                  options={cityOptions}
                  dark={isDark}
                />
                <FilterSelect
                  value={talentFilters.projectType}
                  onChange={(value) => updateTalentFilters({ projectType: value as typeof talentFilters.projectType })}
                  options={["All", "Brand campaign", "Photoshoot", "Video shoot", "Social content package", "Music video", "Product launch", "Pop-up / activation", "Fan event", "Editorial shoot", "Creator collaboration", "Live performance", "Other"]}
                  dark={isDark}
                />
                <FilterSelect
                  value={talentFilters.tag}
                  onChange={(value) => updateTalentFilters({ tag: value })}
                  options={tagOptions}
                  dark={isDark}
                />
                <FilterSelect
                  value={talentFilters.availability}
                  onChange={(value) => updateTalentFilters({ availability: value as typeof talentFilters.availability })}
                  options={["all", "available", "maybe", "busy", "unknown"]}
                  dark={isDark}
                />
                <button
                  onClick={resetTalentFilters}
                  className={`rounded-pill border px-4 py-3 text-sm font-medium ${
                    isDark ? "border-white/10 bg-white/8 text-white/70" : "border-black/8 bg-white text-ink"
                  }`}
                >
                  Reset
                </button>
              </div>
            </details>
          </div>
          ) : null}
        </motion.section>

        {!talentSearchBlocked ? (
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-ink-light">
                  {activeProject ? "Build my crew" : "Browse talent"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {activeProject ? "Role-by-role review." : "Demo profiles, grouped by role."}
                </h2>
              </div>
              <div className="rounded-pill border border-black/8 bg-white/70 px-4 py-2 text-xs font-medium text-ink-light shadow-sm">
                {surfacedCount} surfaced
              </div>
            </div>

            {recommendationState.candidateGroups.length === 0 ? (
              <div className="rounded-[24px] border border-black/8 bg-white/88 px-5 py-5 text-sm leading-7 text-ink-light shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
                No demo candidates surfaced for this filter set yet. Reset the filters or keep refining the brief.
              </div>
            ) : null}

            {recommendationState.candidateGroups.map((group) => (
              <section key={group.role.id} className="space-y-3">
                <div
                  className={`rounded-[24px] border px-5 py-4 ${
                    isDark ? "border-white/10 bg-white/8" : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                        {group.role.role}
                      </p>
                      <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/68" : "text-ink-light"}`}>
                        {group.role.rationale}
                      </p>
                    </div>
                    <span
                      className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                        isDark ? "bg-white/10 text-white/72" : "bg-canvas text-ink-light"
                      }`}
                    >
                      {group.candidates.length} to review
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.candidates.map((candidate, index) => (
                    <motion.article
                      key={`${group.role.role}-${candidate.id}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + index * 0.02 }}
                      className="overflow-hidden rounded-[28px] border border-white/8 bg-white/78 shadow-[0_16px_40px_rgba(17,17,17,0.06)] backdrop-blur-xl"
                    >
                      <div className="relative h-[240px]">
                        <Image
                          src={candidate.imageSrc}
                          alt={candidate.name}
                          fill
                          sizes="(max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                        />
                        <div className="absolute left-4 top-4 rounded-pill bg-white/92 px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
                          {candidate.role}
                        </div>
                      </div>

                      <div className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold tracking-tight text-ink">
                              {candidate.name}
                            </h3>
                            <p className="mt-1 text-sm text-ink-light">{candidate.location}</p>
                          </div>
                          <div className="rounded-pill bg-canvas px-3 py-1.5 text-xs font-medium text-ink">
                            {candidate.availabilityLabel}
                          </div>
                        </div>

                        <p className="text-sm leading-6 text-ink-light">
                          {candidate.whyThisPersonMayFit}
                        </p>

                        <div className="space-y-2 rounded-[20px] bg-canvas px-4 py-3">
                          <InfoRow label="Review" value={candidate.reviewStatus} />
                          <InfoRow label="Contact" value={candidate.contactabilityStatus} />
                          <InfoRow label="Source" value={candidate.sourceMode === "demo_seed" ? "Demo seed profile" : candidate.sourceMode} />
                          <InfoRow label="Evidence" value={candidate.evidence} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-medium text-ink-light">
                            Not contacted
                          </span>
                          <span className="rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-medium text-ink-light">
                            Not confirmed
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openTalentProfile(candidate.id, shortlistTarget?.id)}
                            className="rounded-pill border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm"
                          >
                            View profile
                          </button>
                          {shortlistTarget ? (
                            <button
                              onClick={() =>
                                addTalentToShortlist(
                                  shortlistTarget.id,
                                  candidate.id,
                                  candidate.role,
                                )
                              }
                              className="rounded-pill bg-accent px-4 py-2.5 text-sm font-medium text-ink"
                            >
                              Add to shortlist
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SnapshotLine({
  dark,
  label,
  value,
}: {
  dark: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-[22px] border px-4 py-3 ${
        dark ? "border-white/10 bg-white/8" : "border-black/8 bg-white"
      }`}
    >
      <p className={`text-[10px] uppercase tracking-[0.18em] ${dark ? "text-white/42" : "text-ink-light"}`}>
        {label}
      </p>
      <p className={`mt-2 text-sm font-medium ${dark ? "text-white/76" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="uppercase tracking-[0.16em] text-ink-light">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function InfoChip({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-[22px] border px-4 py-3 ${
      dark ? "border-white/10 bg-white/8" : "border-black/8 bg-[#edf5ff]"
    }`}>
      <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/38" : "text-ink-light"}`}>{label}</p>
      <p className={`mt-2 text-sm font-medium ${dark ? "text-white/76" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  dark,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  dark: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-pill border px-4 py-3 text-sm outline-none ${
        dark ? "border-white/10 bg-white/8 text-white" : "border-black/8 bg-white text-ink"
      }`}
    >
      {options.map((option) => (
        <option
          key={option}
          value={option}
          className={dark ? "bg-[#101624] text-white" : "bg-white text-ink"}
        >
          {option}
        </option>
      ))}
    </select>
  );
}
