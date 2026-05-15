"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { scoreTalentForProject } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function ExploreTalentView() {
  const searchParams = useSearchParams();
  const projects = useAgencyStore((state) => state.projects);
  const talent = useAgencyStore((state) => state.talent);
  const selectedProjectId = useAgencyStore((state) => state.selectedProjectId);
  const talentSearchQuery = useAgencyStore((state) => state.talentSearchQuery);
  const talentFilters = useAgencyStore((state) => state.talentFilters);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const setTalentSearchQuery = useAgencyStore((state) => state.setTalentSearchQuery);
  const updateTalentFilters = useAgencyStore((state) => state.updateTalentFilters);
  const resetTalentFilters = useAgencyStore((state) => state.resetTalentFilters);
  const addTalentToShortlist = useAgencyStore((state) => state.addTalentToShortlist);
  const { openTalentProfile, openPostProject, openProject } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const projectSlug = searchParams.get("project");
  const roleParam = searchParams.get("role");

  useEffect(() => {
    if (projectSlug) selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  useEffect(() => {
    if (roleParam) {
      updateTalentFilters({ role: roleParam });
    }
  }, [roleParam, updateTalentFilters]);

  const activeProject =
    projects.find((project) => project.slug === projectSlug) ||
    projects.find((project) => project.id === selectedProjectId) ||
    null;

  const derivedCards = useMemo(() => {
    const search = talentSearchQuery.toLowerCase().trim();

    return talent
      .filter((profile) => {
        const searchMatch =
          !search ||
          `${profile.name} ${profile.roles.join(" ")} ${profile.city} ${profile.tags.join(" ")} ${profile.credits.join(" ")}`.toLowerCase().includes(search);
        const roleMatch =
          talentFilters.role === "All roles" ||
          profile.roles.some((role) => role.toLowerCase() === talentFilters.role.toLowerCase());
        const cityMatch =
          talentFilters.city === "All cities" ||
          profile.city.toLowerCase().includes(talentFilters.city.toLowerCase());
        const projectTypeMatch =
          talentFilters.projectType === "All" ||
          profile.projectTypes.includes(talentFilters.projectType);
        const tagMatch =
          talentFilters.tag === "All tags" ||
          profile.tags.some((tag) => tag.toLowerCase().includes(talentFilters.tag.toLowerCase()));
        const availabilityMatch =
          talentFilters.availability === "all" ||
          profile.availabilitySignal === talentFilters.availability;
        const budgetMatch =
          talentFilters.budget === "All budgets" ||
          profile.rateRange.toLowerCase().includes(talentFilters.budget.toLowerCase());

        return searchMatch && roleMatch && cityMatch && projectTypeMatch && tagMatch && availabilityMatch && budgetMatch;
      })
      .map((profile) => {
        if (!activeProject) {
          return {
            ...profile,
            primaryRole: profile.roles[0],
            portfolioFitScore: profile.portfolioFitScore || 72,
            styleFitScore: profile.styleFitScore || 70,
            categoryExperienceScore: 68,
            locationFitScore: 72,
            budgetFitScore: profile.budgetFitScore || 70,
            distributionScore: profile.distributionScore || 68,
            availabilityLikelihood:
              profile.availabilitySignal === "available"
                ? 92
                : profile.availabilitySignal === "maybe"
                  ? 72
                : profile.availabilitySignal === "busy"
                  ? 34
                  : 58,
            priorProjectRelevance: 66,
            whySagaMatched: [
              `Strong fit for ${profile.roles[0].toLowerCase()} work.`,
              profile.tags[0] ? `Portfolio leans ${profile.tags[0].toLowerCase()}.` : "Culturally fluent portfolio.",
            ],
            candidateStatus: "suggested" as const,
          };
        }

        const fallbackRole =
          talentFilters.role !== "All roles"
            ? talentFilters.role
            : activeProject.requiredRoles.find((role) =>
                profile.roles.some((talentRole) => talentRole.toLowerCase() === role.name.toLowerCase())
              )?.name || profile.roles[0];

        return scoreTalentForProject(activeProject, profile, fallbackRole);
      })
      .sort((a, b) => {
        const aScore =
          a.portfolioFitScore * 0.34 +
          a.budgetFitScore * 0.16 +
          a.distributionScore * 0.16 +
          a.availabilityLikelihood * 0.14;
        const bScore =
          b.portfolioFitScore * 0.34 +
          b.budgetFitScore * 0.16 +
          b.distributionScore * 0.16 +
          b.availabilityLikelihood * 0.14;
        return bScore - aScore;
      });
  }, [activeProject, talent, talentFilters, talentSearchQuery]);

  const roleOptions = useMemo(
    () =>
      ["All roles", ...new Set(talent.flatMap((profile) => profile.roles))]
        .slice(0, 16),
    [talent]
  );
  const cityOptions = useMemo(
    () => ["All cities", ...new Set(talent.map((profile) => profile.city))].slice(0, 12),
    [talent]
  );
  const tagOptions = useMemo(
    () => ["All tags", ...new Set(talent.flatMap((profile) => profile.tags))].slice(0, 14),
    [talent]
  );

  const shortlistTarget = activeProject || projects.find((project) => project.id === selectedProjectId) || null;
  const gridCards = derivedCards.slice(0, 18);

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1260px] space-y-6">
        <div className="space-y-4 lg:hidden">
          <section
            className={`rounded-[28px] p-4 ${
              isDark ? "brand-surface-deep" : "brand-surface-strong"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
              {activeProject ? "Matched to your brief" : "Explore talent"}
            </p>
            <p className={`mt-2 text-sm leading-6 ${isDark ? "text-white/68" : "text-ink-light"}`}>
              Search, narrow, and shortlist in a standard browse view without leaving the page.
            </p>

            {shortlistTarget ? (
              <div className={`mt-4 inline-flex items-center gap-2 rounded-pill border px-3 py-2 text-xs ${
                isDark ? "border-white/10 bg-white/8 text-white/78" : "border-[#7bc6ff]/24 bg-[#edf5ff] text-[#173250]"
              }`}>
                <span className="font-medium">Shortlisting into</span>
                <span>{shortlistTarget.title}</span>
              </div>
            ) : null}

            <label className={`mt-4 flex items-center gap-3 rounded-[20px] border px-4 py-3 ${
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
              <button
                onClick={resetTalentFilters}
                className={`rounded-pill border px-4 py-3 text-sm font-medium ${
                  isDark ? "border-white/10 bg-white/8 text-white/70" : "border-black/8 bg-white text-ink"
                }`}
              >
                Reset
              </button>
            </div>
          </section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`hidden overflow-hidden rounded-[32px] p-5 sm:p-7 lg:block ${
            isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
          }`}
        >
          <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                {activeProject ? "Matched to your brief" : "Explore talent"}
              </p>
              <h1 className="mt-3 text-[2.3rem] font-semibold leading-[0.96] tracking-tight sm:text-5xl">
                Find photographers, producers, stylists, videographers, creators, vendors, and fandom-native talent.
              </h1>
              <p className={`mt-4 max-w-[720px] text-sm leading-7 sm:text-base ${isDark ? "text-white/64" : "text-ink-light"}`}>
                Saga ranks talent by portfolio fit, style fit, category experience, location, budget, availability, and distribution value in a cleaner browse-first layout.
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
              <InfoChip label="Portfolio fit" value="Visual quality + style overlap" dark={isDark} />
              <InfoChip label="Budget fit" value="Range and scope alignment" dark={isDark} />
              <InfoChip label="Distribution score" value="Audience, trust, cultural pull" dark={isDark} />
              <InfoChip label="Availability" value="Likelihood to book quickly" dark={isDark} />
            </div>
          </div>

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

            <div className="flex flex-wrap gap-2">
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
              {shortlistTarget ? (
                <button
                  onClick={() => openProject(shortlistTarget.id)}
                  className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-3 text-sm font-medium text-white"
                >
                  Open Workspace
                </button>
              ) : (
                <button
                  onClick={openPostProject}
                  className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-3 text-sm font-medium text-white"
                >
                  Post a Project
                </button>
              )}
            </div>
          </div>
        </motion.section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-ink-light">Top matches</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                Browse talent in a standard card layout.
              </h2>
            </div>
            <div className="rounded-pill border border-black/8 bg-white/70 px-4 py-2 text-xs font-medium text-ink-light shadow-sm">
              {gridCards.length} surfaced
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gridCards.map((card, index) => (
            <motion.article
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.02 }}
              className="overflow-hidden rounded-[28px] border border-white/8 bg-white/78 shadow-[0_16px_40px_rgba(17,17,17,0.06)] backdrop-blur-xl"
            >
              <div className="relative h-[250px]">
                <Image src={card.portfolioImages[0]} alt={card.name} fill sizes="(max-width: 1200px) 50vw, 33vw" className="object-cover" />
                <div className="absolute left-4 top-4 rounded-pill bg-white/92 px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
                  {card.primaryRole}
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-ink">{card.name}</h3>
                    <p className="mt-1 text-sm text-ink-light">{card.city}</p>
                  </div>
                  <div className="rounded-pill bg-canvas px-3 py-1.5 text-xs font-medium text-ink">
                    {card.availabilitySignal}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {card.credits.slice(0, 2).map((credit) => (
                    <span key={credit} className="rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-medium text-ink-light">
                      {credit}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <ScorePill label="Portfolio" value={card.portfolioFitScore} compact />
                  <ScorePill label="Budget" value={card.budgetFitScore} compact />
                  <ScorePill label="Audience" value={card.distributionScore} compact />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openTalentProfile(card.id, shortlistTarget?.id)}
                    className="rounded-pill border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm"
                  >
                    View Profile
                  </button>
                  {shortlistTarget ? (
                    <button
                      onClick={() => addTalentToShortlist(shortlistTarget.id, card.id, card.primaryRole)}
                      className="rounded-pill bg-accent px-4 py-2.5 text-sm font-medium text-ink"
                    >
                      Add to Shortlist
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.article>
          ))}
          </div>
        </section>
      </div>
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

function ScorePill({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[18px] ${compact ? "bg-canvas" : "bg-white/[0.06]"} px-3 py-2`}>
      <p className={`text-[10px] uppercase tracking-[0.18em] ${compact ? "text-ink-light" : "text-white/34"}`}>
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${compact ? "text-ink" : "text-white"}`}>{Math.round(value)}</p>
    </div>
  );
}
