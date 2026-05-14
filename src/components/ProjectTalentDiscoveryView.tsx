"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRecommendationsForRole, getTalentById } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";
import type { CreativeProject, TalentRecommendation } from "@/types/sagaAgency";
import { TalentReviewCanvas } from "./TalentReviewCanvas";

function recommendationScore(recommendation: TalentRecommendation) {
  return (
    recommendation.portfolioFitScore * 0.32 +
    recommendation.styleFitScore * 0.15 +
    recommendation.categoryExperienceScore * 0.11 +
    recommendation.locationFitScore * 0.08 +
    recommendation.budgetFitScore * 0.12 +
    recommendation.availabilityLikelihood * 0.08 +
    recommendation.distributionScore * 0.1 +
    recommendation.priorProjectRelevance * 0.04
  );
}

function withStatus(project: CreativeProject, recommendation: TalentRecommendation): TalentRecommendation {
  const isBooked = project.bookedTalentIds.includes(recommendation.id);
  const isShortlisted = project.shortlistedTalentIds.includes(recommendation.id);

  return {
    ...recommendation,
    candidateStatus: isBooked ? "booked" : isShortlisted ? "shortlisted" : recommendation.candidateStatus,
  };
}

function branchBoost(recommendation: TalentRecommendation, cue: string) {
  const tokens = cue
    .toLowerCase()
    .split(/[\s,/.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  if (!tokens.length) return 0;

  const haystack = `${recommendation.name} ${recommendation.bio} ${recommendation.city} ${recommendation.primaryRole} ${recommendation.tags.join(" ")} ${recommendation.credits.join(" ")} ${recommendation.whySagaMatched.join(" ")}`.toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches * 16;
}

function summarizeRoles(roles: string[]) {
  if (roles.length <= 2) return roles.join(", ");
  return `${roles.slice(0, 2).join(", ")} +${roles.length - 2}`;
}

export function ProjectTalentDiscoveryView({ projectSlug }: { projectSlug: string }) {
  const searchParams = useSearchParams();
  const projects = useAgencyStore((state) => state.projects);
  const talent = useAgencyStore((state) => state.talent);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const addTalentToShortlist = useAgencyStore((state) => state.addTalentToShortlist);
  const removeTalentFromShortlist = useAgencyStore((state) => state.removeTalentFromShortlist);
  const askSagaToReachOut = useAgencyStore((state) => state.askSagaToReachOut);
  const { openTalentProfile, openProject, goRelay } = useSagaNavigation();

  const [activeRole, setActiveRole] = useState("All");
  const [branchInput, setBranchInput] = useState("");
  const [branchCue, setBranchCue] = useState("");
  const [mobilePanel, setMobilePanel] = useState<"roles" | "brief" | "shortlist" | null>(null);
  const isDark = useThemeMode() === "dark";

  useEffect(() => {
    selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  const project = projects.find((entry) => entry.slug === projectSlug) || null;
  const roleParam = searchParams.get("role");

  useEffect(() => {
    if (roleParam) {
      setActiveRole(roleParam);
    }
  }, [roleParam]);

  const roleRecommendations = useMemo(() => {
    if (!project) return {};

    return Object.fromEntries(
      project.requiredRoles.map((role) => [
        role.name,
        getRecommendationsForRole(project, role.name, 16).map((recommendation) => withStatus(project, recommendation)),
      ])
    ) as Record<string, TalentRecommendation[]>;
  }, [project]);

  const allRecommendations = useMemo(() => {
    if (!project) return [];

    const merged = new Map<string, TalentRecommendation>();
    project.requiredRoles.forEach((role) => {
      (roleRecommendations[role.name] || []).forEach((recommendation) => {
        const existing = merged.get(recommendation.id);
        if (!existing || recommendationScore(recommendation) > recommendationScore(existing)) {
          merged.set(recommendation.id, recommendation);
        }
      });
    });

    return [...merged.values()].sort((a, b) => recommendationScore(b) - recommendationScore(a));
  }, [project, roleRecommendations]);

  const visibleRecommendations = useMemo(() => {
    const base =
      activeRole === "All"
        ? allRecommendations
        : (roleRecommendations[activeRole] || []).slice();

    const cue = branchCue.trim();
    if (!cue) {
      return base;
    }

    return [...base].sort((a, b) => {
      const aBoost = branchBoost(a, cue);
      const bBoost = branchBoost(b, cue);
      return recommendationScore(b) + bBoost - (recommendationScore(a) + aBoost);
    });
  }, [activeRole, allRecommendations, branchCue, roleRecommendations]);

  const shortlistProfiles = useMemo(() => {
    if (!project) return [];
    return project.shortlistedTalentIds
      .map((id) => getTalentById(id, talent))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  }, [project, talent]);

  const handleBranchFromSelection = (talentIds: string[]) => {
    if (!project) return;

    const selectedProfiles = talentIds
      .map((id) => getTalentById(id, talent))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

    if (!selectedProfiles.length) return;

    const cue = [...new Set(
      selectedProfiles.flatMap((profile) => [
        profile.roles[0],
        ...profile.tags.slice(0, 2),
        ...profile.credits.slice(0, 1),
      ])
    )]
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");

    if (cue) {
      setBranchCue(cue);
      setBranchInput(cue);
    }

    const matchingRole = project.requiredRoles.find((role) =>
      selectedProfiles.some((profile) =>
        profile.roles.some((talentRole) => talentRole.toLowerCase() === role.name.toLowerCase())
      )
    );

    if (matchingRole) {
      setActiveRole(matchingRole.name);
    }
  };

  if (!project) return null;

  const liveBriefPanel = (
    <section
      className={`rounded-[28px] p-5 ${
        isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Live brief</p>
          <h2 className="mt-2 text-[2rem] font-semibold leading-[1.08] tracking-tight">{project.title}</h2>
        </div>
        <span
          className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
            isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink"
          }`}
        >
          {project.bookedTalentIds.length} locked
        </span>
      </div>

      <div className={`mt-5 grid gap-3 text-sm ${isDark ? "text-white/76" : "text-ink"}`}>
        <SidebarLine label="Location" value={project.city} dark={isDark} />
        <SidebarLine label="Budget" value={project.budgetRange} dark={isDark} />
        <SidebarLine label="Timeline" value={project.dateLabel} dark={isDark} />
        <SidebarLine label="Roles" value={summarizeRoles(project.requiredRoles.map((role) => role.name))} dark={isDark} />
        {branchCue ? <SidebarLine label="Branch cue" value={branchCue} dark={isDark} /> : null}
      </div>
    </section>
  );

  const shortlistPanel = (
    <section
      className={`rounded-[28px] p-5 ${
        isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Short list</p>
          <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/64" : "text-ink-light"}`}>
            Drag profiles in here mentally while you branch across roles and taste pockets.
          </p>
        </div>
        <span
          className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
            isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink"
          }`}
        >
          {shortlistProfiles.length}/8
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {shortlistProfiles.length ? (
          shortlistProfiles.map((profile) => (
            <div
              key={profile?.id}
              className={`flex items-center justify-between gap-3 rounded-[22px] px-4 py-3 ${
                isDark ? "bg-white/[0.05]" : "bg-canvas"
              }`}
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium tracking-tight ${isDark ? "text-white" : "text-ink"}`}>{profile?.name}</p>
                <p className={`mt-1 text-[11px] uppercase tracking-[0.18em] ${isDark ? "text-white/48" : "text-ink-light"}`}>
                  {profile?.roles[0]} · {profile?.city}
                </p>
              </div>
              <button
                onClick={() => profile && removeTalentFromShortlist(project.id, profile.id)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium shadow-sm ${
                  isDark ? "bg-white text-ink" : "bg-[#7bc6ff] text-[#0b1423]"
                }`}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div
            className={`rounded-[24px] border border-dashed px-4 py-6 text-center text-sm leading-6 ${
              isDark
                ? "border-white/15 bg-white/[0.04] text-white/52"
                : "border-black/10 bg-canvas text-ink-light"
            }`}
          >
            Add talent from the canvas to prep the crew board before outreach.
          </div>
        )}
      </div>
    </section>
  );

  const roleBar = (
    <div className={`overflow-x-auto rounded-[28px] p-2 ${isDark ? "brand-surface-deep" : "brand-surface-strong"}`}>
      <div className="flex min-w-max items-center gap-2">
        <RolePill
          label="All"
          count={allRecommendations.length}
          active={activeRole === "All"}
          dark={isDark}
          onClick={() => setActiveRole("All")}
        />
        {project.requiredRoles.map((role) => (
          <RolePill
            key={role.id}
            label={role.name}
            count={(roleRecommendations[role.name] || []).length}
            active={activeRole === role.name}
            dark={isDark}
            onClick={() => setActiveRole(role.name)}
          />
        ))}
      </div>
    </div>
  );

  const roleActions = (
    <div className="flex items-center justify-end gap-3">
      <div
        className={`rounded-pill px-4 py-2 text-xs font-medium ${isDark ? "brand-surface-deep text-white/72" : "brand-surface-strong text-ink"}`}
      >
        {visibleRecommendations.length} surfaced
      </div>
      <button
        onClick={() => openProject(project.id)}
        className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
      >
        Crew Board
      </button>
    </div>
  );

  const branchForm = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBranchCue(branchInput.trim());
      }}
      className={`flex w-full max-w-[540px] items-center gap-3 rounded-[28px] border px-4 py-4 shadow-[0_22px_60px_rgba(6,10,18,0.14)] ${
        isDark
          ? "border-white/10 bg-[#11192b]/94 backdrop-blur-xl"
          : "border-black/8 bg-white/88 backdrop-blur-xl"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={isDark ? "text-white/40" : "text-ink-light"}>
        <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] uppercase tracking-[0.24em] ${isDark ? "text-white/36" : "text-ink-light"}`}>Branch off</p>
        <input
          value={branchInput}
          onChange={(event) => setBranchInput(event.target.value)}
          placeholder="Branch off with another cue..."
          className={`mt-1 w-full bg-transparent text-sm outline-none ${
            isDark ? "text-white placeholder:text-white/28" : "text-ink placeholder:text-ink-light"
          }`}
        />
      </div>
      <button
        type="submit"
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm ${
          isDark ? "bg-white text-ink" : "bg-[#7bc6ff] text-[#08111f]"
        }`}
        aria-label="Apply branch cue"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );

  const mobileBranchForm = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBranchCue(branchInput.trim());
      }}
      className={`flex items-center gap-3 rounded-[24px] border px-3 py-3 ${
        isDark ? "border-white/10 bg-[#101624]/92" : "border-black/8 bg-white/92"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className={isDark ? "text-white/40" : "text-ink-light"}>
        <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        value={branchInput}
        onChange={(event) => setBranchInput(event.target.value)}
        placeholder="Branch off with another cue..."
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
          isDark ? "text-white placeholder:text-white/28" : "text-ink placeholder:text-ink-light"
        }`}
      />
      <button
        type="submit"
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          isDark ? "bg-white text-ink" : "bg-[#7bc6ff] text-[#08111f]"
        }`}
        aria-label="Apply branch cue"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );

  const mobileActionTabs = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <MobileUtilityPill
        label="Roles"
        active={mobilePanel === "roles"}
        dark={isDark}
        onClick={() => setMobilePanel((current) => (current === "roles" ? null : "roles"))}
      />
      <MobileUtilityPill
        label="Live Brief"
        active={mobilePanel === "brief"}
        dark={isDark}
        onClick={() => setMobilePanel((current) => (current === "brief" ? null : "brief"))}
      />
      <MobileUtilityPill
        label="Short List"
        active={mobilePanel === "shortlist"}
        dark={isDark}
        onClick={() => setMobilePanel((current) => (current === "shortlist" ? null : "shortlist"))}
      />
      <button
        onClick={() => openProject(project.id)}
        className={`rounded-pill px-4 py-2.5 text-sm font-medium ${
          isDark ? "border border-white/10 bg-white/[0.04] text-white" : "border border-[#7bc6ff]/30 bg-white text-ink"
        }`}
      >
        Crew Board
      </button>
    </div>
  );

  const mobilePanelContent =
    mobilePanel === "roles" ? (
      <div className="space-y-3">
        {roleBar}
        <div className="flex justify-center">
          <div
            className={`rounded-pill border px-4 py-2 text-xs font-medium ${
              isDark ? "border-white/10 bg-[#101624]/92 text-white/72" : "border-black/8 bg-white/88 text-ink"
            }`}
          >
            {visibleRecommendations.length} surfaced
          </div>
        </div>
      </div>
    ) : mobilePanel === "brief" ? (
      liveBriefPanel
    ) : mobilePanel === "shortlist" ? (
      shortlistPanel
    ) : null;

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-40 pt-24 md:px-6 md:pt-28 lg:overflow-hidden lg:px-0 lg:pb-0">
      <div className="mx-auto max-w-[1440px] lg:hidden">
        <div className="space-y-3">
          <TalentReviewCanvas
            recommendations={visibleRecommendations}
            activeProject={project}
            shortlistTarget={project}
            focusLabel={`${branchCue || project.title} · ${visibleRecommendations.length} matches`}
            onOpenProfile={(talentId) => openTalentProfile(talentId, project.id)}
            onAddToShortlist={(talentId, roleName) => addTalentToShortlist(project.id, talentId, roleName)}
            onAskSagaToReachOut={(talentId) => {
              const conversationId = askSagaToReachOut(project.id, talentId);
              if (conversationId) {
                goRelay(project.id, conversationId);
              }
            }}
            onBranchFromSelection={handleBranchFromSelection}
            onOpenCrewBoard={() => openProject(project.id)}
            showCanvasHeader={false}
            canvasHeightClass="h-[calc(100svh-6.75rem)] min-h-[540px]"
            maxVisibleDesktop={activeRole === "All" ? 28 : 20}
            maxVisibleMobile={14}
            lightModeBoxes={!isDark}
          />
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(0.9rem+env(safe-area-inset-bottom))] z-30 space-y-2.5 lg:hidden">
        {mobilePanelContent ? (
          <div
            className={`max-h-[36svh] overflow-y-auto rounded-[26px] border p-3 shadow-[0_24px_60px_rgba(6,10,18,0.16)] backdrop-blur-xl ${
              isDark ? "border-white/10 bg-[#101624]/94" : "border-black/8 bg-white/94"
            }`}
          >
            {mobilePanelContent}
          </div>
        ) : null}

        <div
          className={`space-y-2.5 rounded-[26px] border p-2.5 shadow-[0_24px_60px_rgba(6,10,18,0.12)] backdrop-blur-xl ${
            isDark ? "border-white/10 bg-[#101624]/88" : "border-black/8 bg-white/88"
          }`}
        >
          {mobileActionTabs}
          {mobileBranchForm}
        </div>
      </div>

      <div className="relative hidden h-[calc(100vh-8rem)] lg:block">
        <div className="absolute inset-0">
          <TalentReviewCanvas
            recommendations={visibleRecommendations}
            activeProject={project}
            shortlistTarget={project}
            focusLabel={`${branchCue || project.title} · ${visibleRecommendations.length} matches`}
            onOpenProfile={(talentId) => openTalentProfile(talentId, project.id)}
            onAddToShortlist={(talentId, roleName) => addTalentToShortlist(project.id, talentId, roleName)}
            onAskSagaToReachOut={(talentId) => {
              const conversationId = askSagaToReachOut(project.id, talentId);
              if (conversationId) {
                goRelay(project.id, conversationId);
              }
            }}
            onBranchFromSelection={handleBranchFromSelection}
            onOpenCrewBoard={() => openProject(project.id)}
            showCanvasHeader={false}
            canvasHeightClass="h-full"
            maxVisibleDesktop={activeRole === "All" ? 28 : 20}
            maxVisibleMobile={12}
            lightModeBoxes={!isDark}
            fullBleedDesktop
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-20">
          <aside className="pointer-events-auto absolute left-8 top-6 z-20 w-[290px] space-y-4">
            {liveBriefPanel}
            {shortlistPanel}
          </aside>

          <div className="absolute left-[330px] right-8 top-6 flex items-start justify-between gap-4">
            <div className="pointer-events-auto min-w-0 flex-1">
              {roleBar}
            </div>
            <div className="pointer-events-auto flex shrink-0 items-center gap-3">
              {roleActions}
            </div>
          </div>

          <div className="pointer-events-auto absolute bottom-6 left-1/2 w-full max-w-[540px] -translate-x-1/2 px-4">
            {branchForm}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileUtilityPill({
  label,
  active,
  dark,
  onClick,
}: {
  label: string;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-4 py-2.5 text-sm font-medium ${
        active
          ? "bg-[#7bc6ff] text-ink"
          : dark
            ? "border border-white/10 bg-white/[0.04] text-white/76"
            : "border border-black/8 bg-white text-ink-light"
      }`}
    >
      {label}
    </button>
  );
}

function SidebarLine({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={dark ? "text-white/42" : "text-ink-light"}>{label}</span>
      <span className={`max-w-[160px] truncate text-right font-medium ${dark ? "text-white" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function RolePill({
  label,
  count,
  active,
  dark,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "bg-[#7bc6ff] text-ink"
          : dark
            ? "bg-white/[0.04] text-white/76 hover:bg-white/[0.08]"
            : "bg-canvas text-ink-light hover:bg-[#edf5ff]"
      }`}
    >
      {label} × {count}
    </button>
  );
}
