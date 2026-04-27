"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { scoreTalentForProject } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function TalentProfileView({ talentSlug }: { talentSlug: string }) {
  const searchParams = useSearchParams();
  const projects = useAgencyStore((state) => state.projects);
  const talent = useAgencyStore((state) => state.talent);
  const selectedProjectId = useAgencyStore((state) => state.selectedProjectId);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const addTalentToShortlist = useAgencyStore((state) => state.addTalentToShortlist);
  const askSagaToReachOut = useAgencyStore((state) => state.askSagaToReachOut);
  const selectTalent = useAgencyStore((state) => state.selectTalent);
  const { goTalent, openProject, goRelay } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const projectSlug = searchParams.get("project");

  useEffect(() => {
    if (projectSlug) selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  const profile = talent.find((entry) => entry.id === talentSlug);
  const activeProject =
    projects.find((project) => project.slug === projectSlug) ||
    projects.find((project) => project.id === selectedProjectId) ||
    null;

  useEffect(() => {
    if (profile) selectTalent(profile.id);
  }, [profile, selectTalent]);

  const scoredProfile = useMemo(() => {
    if (!profile) return null;
    if (!activeProject) return null;

    const bestRole =
      activeProject.requiredRoles.find((role) =>
        profile.roles.some((talentRole) => talentRole.toLowerCase() === role.name.toLowerCase())
      )?.name || profile.roles[0];

    return scoreTalentForProject(activeProject, profile, bestRole);
  }, [activeProject, profile]);

  if (!profile) return null;

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
          <div className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:items-end">
            <div className="flex items-start gap-4">
              <div className={`relative h-24 w-24 overflow-hidden rounded-[34%_66%_52%_48%/42%_48%_52%_58%] border ${isDark ? "border-white/10" : "border-black/8"}`}>
                <Image src={profile.avatar || profile.portfolioImages[0]} alt={profile.name} fill sizes="96px" className="object-cover" />
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Talent profile</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{profile.name}</h1>
                <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>{profile.bio}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.roles.map((role) => (
                    <span
                      key={role}
                      className={`rounded-pill border px-3 py-1.5 text-xs font-medium ${
                        isDark ? "border-white/10 bg-white/8 text-white/78" : "border-[#7bc6ff]/30 bg-[#edf5ff] text-[#173250]"
                      }`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileMetric label="Location" value={profile.city} dark={isDark} />
              <ProfileMetric label="Rate range" value={profile.rateRange} dark={isDark} />
              <ProfileMetric label="Availability" value={profile.availabilitySignal} dark={isDark} />
              <ProfileMetric label="Audience" value={`${(profile.audienceReach || 0).toLocaleString()} est.`} dark={isDark} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {profile.tags.slice(0, 7).map((tag) => (
              <span
                key={tag}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                  isDark ? "bg-white/8 text-white/72" : "bg-[#edf5ff] text-[#173250]"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => addTalentToShortlist(activeProject?.id || projects[0].id, profile.id, scoredProfile?.primaryRole || profile.roles[0])}
              className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Add to Shortlist
            </button>
            <button
              onClick={() => {
                const conversationId = askSagaToReachOut(activeProject?.id || projects[0].id, profile.id);
                if (conversationId) goRelay(activeProject?.id || projects[0].id, conversationId);
              }}
              className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Ask Saga to Reach Out
            </button>
            <button
              onClick={() => (activeProject ? openProject(activeProject.id) : goTalent())}
              className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
            >
              {activeProject ? "Back to Workspace" : "Back to Talent"}
            </button>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.portfolioImages.slice(0, 4).map((image, index) => (
                <div
                  key={image}
                  className={`relative overflow-hidden rounded-[28px] border shadow-[0_16px_40px_rgba(17,17,17,0.06)] ${
                    index === 0 ? "sm:col-span-2" : ""
                  } ${isDark ? "border-white/10 bg-white/[0.06]" : "border-black/8 bg-white/84"}`}
                >
                  <div className={`${index === 0 ? "h-[360px]" : "h-[220px]"} relative`}>
                    <Image src={image} alt={`${profile.name} work ${index + 1}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  </div>
                </div>
              ))}
            </div>

            <section
              className={`rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)] ${
                isDark ? "border-white/10 bg-white/[0.04] text-white" : "border-black/8 bg-white/88 text-ink"
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Past work</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {profile.credits.map((credit) => (
                  <div
                    key={credit}
                    className={`rounded-[22px] px-4 py-3 text-sm font-medium ${
                      isDark ? "bg-white/[0.05] text-white/82" : "bg-canvas text-ink"
                    }`}
                  >
                    {credit}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <div className="space-y-6">
            <section className={`rounded-[28px] border p-5 shadow-[0_24px_70px_rgba(6,10,18,0.14)] ${
              isDark ? "border-white/8 bg-[#101624]/92 text-white" : "border-black/8 bg-white/88 text-ink"
            }`}>
              <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Why Saga matched them</p>
              <div className="mt-4 space-y-3">
                {(scoredProfile?.whySagaMatched || [
                  "Strong creative fit for fashion-forward, culture-native work.",
                  "Rate and audience reach make them a useful hybrid of labor and distribution.",
                ]).map((reason) => (
                  <div
                    key={reason}
                    className={`rounded-[22px] px-4 py-3 text-sm leading-6 ${
                      isDark ? "bg-white/[0.05] text-white/72" : "bg-canvas text-ink"
                    }`}
                  >
                    {reason}
                  </div>
                ))}
              </div>
            </section>

            <section className={`rounded-[28px] border p-5 shadow-[0_24px_70px_rgba(6,10,18,0.14)] ${
              isDark ? "border-white/8 bg-[#101624]/92 text-white" : "border-black/8 bg-white/88 text-ink"
            }`}>
              <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Portfolio analysis</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DarkMetric label="Portfolio fit" value={Math.round(scoredProfile?.portfolioFitScore || 74)} dark={isDark} />
                <DarkMetric label="Style fit" value={Math.round(scoredProfile?.styleFitScore || 71)} dark={isDark} />
                <DarkMetric label="Budget fit" value={Math.round(scoredProfile?.budgetFitScore || 69)} dark={isDark} />
                <DarkMetric label="Distribution" value={Math.round(scoredProfile?.distributionScore || profile.distributionScore || 68)} dark={isDark} />
              </div>
              <p className={`mt-4 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                Saga evaluates the actual portfolio, prior category work, local relevance, cultural fluency, and whether the talent can move the project forward as both maker and distribution channel.
              </p>
            </section>

            {activeProject ? (
              <section
                className={`rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)] ${
                  isDark ? "border-white/10 bg-white/[0.04] text-white" : "border-black/8 bg-white/88 text-ink"
                }`}
              >
                <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Matched project</p>
                <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>{activeProject.title}</h2>
                <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                  {activeProject.projectType} · {activeProject.city} · {activeProject.budgetRange}
                </p>
                <div className="mt-4 grid gap-2">
                  {activeProject.goals.slice(0, 3).map((goal) => (
                    <div
                      key={goal}
                      className={`rounded-[18px] px-4 py-3 text-sm leading-6 ${
                        isDark ? "bg-white/[0.05] text-white/82" : "bg-canvas text-ink"
                      }`}
                    >
                      {goal}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileMetric({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-[24px] border p-4 ${
      dark ? "border-white/10 bg-white/8" : "border-black/8 bg-[#edf5ff]"
    }`}>
      <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/40" : "text-ink-light"}`}>{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function DarkMetric({ label, value, dark }: { label: string; value: number; dark: boolean }) {
  return (
    <div className={`rounded-[22px] px-4 py-3 ${
      dark ? "bg-white/[0.05]" : "bg-canvas"
    }`}>
      <p className={`text-[10px] uppercase tracking-[0.18em] ${dark ? "text-white/34" : "text-ink-light"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{value}</p>
    </div>
  );
}
