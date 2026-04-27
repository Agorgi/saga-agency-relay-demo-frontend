"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getTalentById } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function ProfileView() {
  const viewerProfile = useAgencyStore((state) => state.viewerProfile);
  const projects = useAgencyStore((state) => state.projects);
  const conversations = useAgencyStore((state) => state.conversations);
  const talent = useAgencyStore((state) => state.talent);
  const { openProject, openTalentProfile, goRelay } = useSagaNavigation();

  const activeProjects = projects.filter((project) => viewerProfile.activeProjectIds.includes(project.id));
  const savedTalent = viewerProfile.savedTalentIds
    .map((id) => getTalentById(id, talent))
    .filter(Boolean);
  const inboundOpportunities = conversations.filter((conversation) =>
    viewerProfile.inboundOpportunityIds.includes(conversation.id)
  );
  const isDark = useThemeMode() === "dark";

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[1260px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="flex items-start gap-4">
              <div className={`relative h-24 w-24 overflow-hidden rounded-full border ${isDark ? "border-white/12" : "border-black/8"}`}>
                <Image src={viewerProfile.avatar || "/branding/saga-mark-cobalt.png"} alt={viewerProfile.name} fill sizes="96px" className="object-cover" />
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-[0.28em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Unified profile</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{viewerProfile.name}</h1>
                <p className={`mt-2 text-sm ${isDark ? "text-white/52" : "text-ink-light"}`}>{viewerProfile.company} · {viewerProfile.city}</p>
                <p className={`mt-3 max-w-[560px] text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>{viewerProfile.bio}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {viewerProfile.roles.map((role) => (
                    <span
                      key={role}
                      className={`rounded-pill border px-3 py-1.5 text-xs font-medium ${
                        isDark ? "border-white/10 bg-white/8 text-white/76" : "border-[#7bc6ff]/30 bg-[#edf5ff] text-[#173250]"
                      }`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ProfileStat label="Active projects" value={`${activeProjects.length}`} dark={isDark} />
              <ProfileStat label="Saved talent" value={`${savedTalent.length}`} dark={isDark} />
              <ProfileStat label="Inbound opportunities" value={`${inboundOpportunities.length}`} dark={isDark} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {viewerProfile.tags.map((tag) => (
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
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <section className="space-y-6">
            <ProfilePanel eyebrow="Client side" title="Active projects" dark={isDark}>
              <div className="space-y-3">
                {activeProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => openProject(project.id)}
                    className={`flex w-full items-center justify-between rounded-[24px] px-4 py-4 text-left ${
                      isDark ? "bg-white/[0.05]" : "bg-canvas shadow-sm"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{project.title}</p>
                      <p className={`mt-1 text-xs ${isDark ? "text-white/46" : "text-ink-light"}`}>
                        {project.projectType} · {project.city}
                      </p>
                    </div>
                    <span className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                      isDark ? "bg-white/8 text-white/62" : "bg-white text-ink shadow-sm"
                    }`}>
                      {project.status}
                    </span>
                  </button>
                ))}
              </div>
            </ProfilePanel>

            <ProfilePanel eyebrow="Talent side" title="Saved talent roster" dark={isDark}>
              <div className="grid gap-4 sm:grid-cols-2">
                {savedTalent.map((profile) => (
                  <button
                    key={profile?.id}
                    onClick={() => profile && openTalentProfile(profile.id, activeProjects[0]?.id)}
                    className={`overflow-hidden rounded-[24px] text-left ${
                      isDark ? "bg-white/[0.05]" : "bg-white shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
                    }`}
                  >
                    <div className="relative h-[220px]">
                      <Image src={profile?.portfolioImages[0] || ""} alt={profile?.name || ""} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    </div>
                    <div className="p-4">
                      <p className={`text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{profile?.name}</p>
                      <p className={`mt-1 text-xs ${isDark ? "text-white/46" : "text-ink-light"}`}>{profile?.roles.join(" · ")}</p>
                      <p className={`mt-3 text-xs uppercase tracking-[0.18em] ${isDark ? "text-white/34" : "text-ink-light"}`}>
                        {profile?.availabilitySignal} · {profile?.rateRange}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </ProfilePanel>
          </section>

          <div className="space-y-6">
            <ProfilePanel eyebrow="Protected talent perspective" title="Incoming Saga opportunities" dark={isDark}>
              <p className={`text-sm leading-7 ${isDark ? "text-white/58" : "text-ink-light"}`}>
                Saga screens opportunities before they reach talent. Reply by text. Saga handles the client details and keeps contact info private.
              </p>
              <div className="mt-4 space-y-3">
                {inboundOpportunities.map((conversation) => {
                  const profile = getTalentById(conversation.talentId, talent);
                  const project = projects.find((entry) => entry.id === conversation.projectId);
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => goRelay(project?.id, conversation.id)}
                      className={`w-full rounded-[24px] px-4 py-4 text-left ${
                        isDark ? "bg-white/[0.05]" : "bg-canvas shadow-sm"
                      }`}
                    >
                      <p className={`text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{project?.title}</p>
                      <p className={`mt-1 text-xs ${isDark ? "text-white/46" : "text-ink-light"}`}>
                        {profile?.name} · {conversation.status}
                      </p>
                      <p className={`mt-3 text-sm leading-6 ${isDark ? "text-white/58" : "text-ink-light"}`}>{conversation.sagaSummary}</p>
                    </button>
                  );
                })}
              </div>
            </ProfilePanel>

            <ProfilePanel eyebrow="Credits" title="Signals Saga uses" dark={isDark}>
              <div className="grid gap-3">
                {viewerProfile.credits.map((credit) => (
                  <div
                    key={credit}
                    className={`rounded-[22px] px-4 py-3 text-sm font-medium ${
                      isDark ? "bg-white/[0.05] text-white/76" : "bg-canvas text-ink"
                    }`}
                  >
                    {credit}
                  </div>
                ))}
              </div>
            </ProfilePanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-[24px] border p-4 ${
      dark ? "border-white/10 bg-white/[0.05]" : "border-black/8 bg-[#edf5ff]"
    }`}>
      <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/40" : "text-ink-light"}`}>{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function ProfilePanel({
  eyebrow,
  title,
  children,
  dark,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  dark: boolean;
}) {
  return (
    <section className={`rounded-[28px] border p-5 ${
      dark ? "border-white/8 bg-white/[0.04]" : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
    }`}>
      <p className={`text-[10px] uppercase tracking-[0.26em] ${dark ? "text-white/42" : "text-ink-light"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
