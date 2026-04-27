"use client";

import { motion } from "framer-motion";
import { getNextProjectAction } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function ProjectsDashboardView() {
  const projects = useAgencyStore((state) => state.projects);
  const conversations = useAgencyStore((state) => state.conversations);
  const { openProject, openPostProject, goRelay } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1240px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
          }`}
        >
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-end">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Client dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Every active project, relay thread, shortlist, and booking step in one view.
              </h1>
              <p className={`mt-4 max-w-[720px] text-sm leading-7 ${isDark ? "text-white/64" : "text-ink-light"}`}>
                Saga keeps the entire production pipeline in one place: brief, match, relay, terms, and booked talent.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button
                onClick={openPostProject}
                className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Post a Project
              </button>
              <button
                onClick={() => goRelay(projects[0]?.id)}
                className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Coordinate
              </button>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-2">
          {projects.map((project, index) => {
            const activeConversations = conversations.filter((conversation) => conversation.projectId === project.id);
            const openRoles = project.requiredRoles.filter((role) => role.status !== "booked").length;

            return (
              <motion.button
                key={project.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => openProject(project.id)}
                className={`overflow-hidden rounded-[30px] border text-left shadow-[0_16px_40px_rgba(17,17,17,0.06)] backdrop-blur-xl ${
                  isDark ? "border-white/8 bg-[#101624]/92" : "border-black/8 bg-white/80"
                }`}
              >
                <div className={`px-5 py-5 ${isDark ? "bg-[linear-gradient(135deg,#101624,#1b2240,#101624)] text-white" : "bg-[linear-gradient(180deg,#eef6ff,#f8fafc)] text-ink"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/40" : "text-ink-light"}`}>{project.projectType}</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{project.title}</h2>
                    </div>
                    <span className={`rounded-pill border px-3 py-1.5 text-xs font-medium ${
                      isDark ? "border-white/10 bg-white/8 text-white/76" : "border-[#7bc6ff]/24 bg-white text-ink"
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>{project.description}</p>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-3">
                  <ProjectStat label="Open roles" value={`${openRoles}`} />
                  <ProjectStat label="Active relay" value={`${activeConversations.length}`} />
                  <ProjectStat label="Booked" value={`${project.bookedTalentIds.length}`} />
                </div>

                <div className="border-t border-black/8 px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-ink-light">Next action</p>
                  <p className="mt-2 text-sm font-medium text-ink">{getNextProjectAction(project, conversations)}</p>
                </div>
              </motion.button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function ProjectStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-canvas px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-light">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
