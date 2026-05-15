"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";
import type { CreativeProject, ProjectRole } from "@/types/sagaAgency";

const ROLE_SCOPE_HINTS: Record<string, string> = {
  Producer: "Own the schedule, approvals, crew coordination, and day-of execution rhythm.",
  Photographer: "Lead hero capture, selects, and stills that carry the visual world.",
  Videographer: "Capture moving footage, BTS, and cut-friendly coverage blocks.",
  Director: "Shape the narrative language, set tone, and align performance with the brief.",
  DP: "Own camera language, movement, exposure, and cinematic consistency.",
  Editor: "Turn selects into polished finals, cutdowns, and delivery-ready assets.",
  Stylist: "Build pulls, looks, fittings, and silhouette continuity across the shoot.",
  HMUA: "Design hair and makeup that reads cleanly on set and in post.",
  "Art Director": "Translate references into a visual system across props, frame, and styling.",
  "Creative Director": "Hold the taste level and guide the whole creative world across disciplines.",
  "Social Producer": "Plan capture for social, creator-friendly edits, and rollout timing.",
  "Social Manager": "Run live posts, community comms, and recap publishing.",
  Host: "Carry the room, guest energy, intros, and run-of-show timing.",
  Vendor: "Operate approved booths, merch flow, and on-site vendor presence.",
  Cosplayer: "Anchor fandom-facing talent moments and character credibility.",
  "Set Designer": "Turn the world into physical space, prop moments, and install logic.",
  "Vendor Lead": "Recruit vendors, manage placement, and keep the floor mix intentional.",
  Performer: "Deliver the live moment and help carry audience energy on-site.",
  "Talent / Creator": "Front the content, connect with the audience, and bring distribution value.",
  "Production Assistant": "Support logistics, resets, runs, and crew flow throughout the day.",
};

function parseMoneyRange(input: string) {
  const normalized = input.replace(/[–—]/g, "-").toLowerCase();
  const matches = [...normalized.matchAll(/\$?(\d+(?:\.\d+)?)\s*(k)?/g)].map((match) => {
    const base = Number(match[1]);
    return match[2] ? base * 1000 : base;
  });

  if (!matches.length) return { low: 0, high: 0 };
  if (matches.length === 1) return { low: matches[0], high: matches[0] };
  return { low: Math.min(...matches), high: Math.max(...matches) };
}

function roleWeight(roleName: string) {
  const weights: Record<string, number> = {
    Producer: 1.3,
    Photographer: 1.25,
    Videographer: 1.15,
    Director: 1.28,
    DP: 1.22,
    Editor: 0.95,
    Stylist: 0.92,
    HMUA: 0.82,
    "Art Director": 1.12,
    "Creative Director": 1.18,
    "Social Producer": 0.96,
    "Social Manager": 0.88,
    Host: 0.8,
    Vendor: 0.72,
    Cosplayer: 0.76,
    "Set Designer": 1.02,
    "Vendor Lead": 0.82,
    Performer: 0.9,
    "Talent / Creator": 0.98,
    "Production Assistant": 0.62,
  };

  return weights[roleName] || 0.9;
}

function formatMoney(value: number) {
  if (value >= 1000) {
    const rounded = Math.round((value / 1000) * 10) / 10;
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`;
  }

  return `$${Math.round(value)}`;
}

function formatMoneyRange(low: number, high: number) {
  if (!low && !high) return "TBD";
  if (Math.abs(low - high) < 80) return formatMoney(Math.max(low, high));
  return `${formatMoney(low)} - ${formatMoney(high)}`;
}

function buildRoleBudgetBreakdown(project: CreativeProject) {
  const totalBudget = parseMoneyRange(project.budgetRange);
  const weightedRoles = project.requiredRoles.map((role) => ({
    role,
    weight: roleWeight(role.name) * Math.max(1, role.quantity),
  }));
  const totalWeight = weightedRoles.reduce((sum, item) => sum + item.weight, 0) || 1;

  return weightedRoles.map(({ role, weight }) => {
    const low = Math.round((totalBudget.low * weight) / totalWeight / 50) * 50;
    const high = Math.round((totalBudget.high * weight) / totalWeight / 50) * 50;

    return {
      role,
      low,
      high,
      scope:
        ROLE_SCOPE_HINTS[role.name] ||
        `Own the ${role.name.toLowerCase()} slice of the project and keep delivery aligned with the brief.`,
    };
  });
}

function totalRoleBudget(breakdown: ReturnType<typeof buildRoleBudgetBreakdown>) {
  return breakdown.reduce(
    (sum, item) => ({ low: sum.low + item.low, high: sum.high + item.high }),
    { low: 0, high: 0 }
  );
}

export function ProjectWorkspaceView({ projectSlug }: { projectSlug: string }) {
  const projects = useAgencyStore((state) => state.projects);
  const conversations = useAgencyStore((state) => state.conversations);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const { openProjectDiscover, goRelay } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  useEffect(() => {
    selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  const project = projects.find((entry) => entry.slug === projectSlug) || null;
  const projectConversations = conversations.filter((conversation) => conversation.projectId === project?.id);

  const roleBudgetBreakdown = useMemo(
    () => (project ? buildRoleBudgetBreakdown(project) : []),
    [project]
  );
  const estimatedTotal = useMemo(
    () => totalRoleBudget(roleBudgetBreakdown),
    [roleBudgetBreakdown]
  );

  if (!project) return null;

  const primaryGoal = project.goals[0] || "Lock the right team quickly.";
  const secondaryGoals = project.goals.slice(1, 4);

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[1240px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep text-white" : "brand-surface-strong text-ink"
          }`}
        >
          <div>
            <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Project review</p>
            <h1 className="mt-3 text-[2.2rem] font-semibold leading-[0.96] tracking-tight sm:text-5xl">{project.title}</h1>
            <p className={`mt-4 max-w-[760px] text-sm leading-7 ${isDark ? "text-white/64" : "text-ink-light"}`}>
              {project.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <HeaderPill label={project.projectType} dark={isDark} />
              <HeaderPill label={project.city} dark={isDark} />
              <HeaderPill label={project.dateLabel} dark={isDark} />
              <HeaderPill label={project.budgetRange} dark={isDark} />
              <HeaderPill label={`${project.requiredRoles.length} roles scoped`} dark={isDark} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => openProjectDiscover(project.id)}
              className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium"
            >
              See picks
            </button>
            {projectConversations[0] ? (
              <button
                onClick={() => goRelay(project.id, projectConversations[0]?.id)}
                className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Open relay
              </button>
            ) : null}
          </div>
        </motion.section>

        <CardSection eyebrow="Expanded brief + staffing plan" title="Roles, scope, and rough budget" dark={isDark}>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div>
                <p className={`text-sm leading-7 ${isDark ? "text-white/68" : "text-ink-light"}`}>{project.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryLine label="Primary goal" value={primaryGoal} dark={isDark} />
                <SummaryLine label="Location mode" value={project.locationMode} dark={isDark} />
                <SummaryLine label="Timing" value={project.dateLabel} dark={isDark} />
                <SummaryLine label="Deliverables" value={`${project.deliverables.length} scoped`} dark={isDark} />
              </div>

              {secondaryGoals.length ? (
                <div className="grid gap-3">
                  {secondaryGoals.map((goal) => (
                    <div
                      key={goal}
                      className={`rounded-[20px] px-4 py-3 text-sm leading-6 ${
                        isDark ? "bg-white/[0.05] text-white/84" : "bg-canvas text-ink"
                      }`}
                    >
                      {goal}
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className={`rounded-[24px] border px-4 py-4 ${
                  isDark ? "border-white/10 bg-white/[0.05]" : "border-[#7bc6ff]/24 bg-[#edf5ff]"
                }`}
              >
                <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                  Saga staffing plan
                </p>
                <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/70" : "text-ink-light"}`}>
                  {project.staffingPlan.summary}
                </p>
                <div className="mt-4 grid gap-3">
                  {project.staffingPlan.risks.map((risk) => (
                    <div
                      key={risk}
                      className={`rounded-[18px] px-4 py-3 text-sm leading-6 ${
                        isDark ? "bg-[#0d1320] text-white/76" : "bg-white text-ink shadow-sm"
                      }`}
                    >
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="space-y-3">
                {roleBudgetBreakdown.map(({ role, scope, low, high }) => (
                  <RoleBudgetCard
                    key={role.id}
                    role={role}
                    scope={scope}
                    budgetLabel={formatMoneyRange(low, high)}
                    dark={isDark}
                  />
                ))}
              </div>

              <div
                className={`mt-4 rounded-[24px] border px-4 py-4 ${
                  isDark ? "border-white/10 bg-white/[0.05]" : "border-[#7bc6ff]/24 bg-[#edf5ff]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Total budget</p>
                    <p className={`mt-2 text-3xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                      {formatMoneyRange(estimatedTotal.low, estimatedTotal.high)}
                    </p>
                  </div>
                  <div className={`max-w-[220px] text-right text-sm leading-6 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                    Rough allocation only. Saga tightens this once talent starts replying and scope gets confirmed.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardSection>

        <CardSection eyebrow="Next move" title="Keep this moving" dark={isDark}>
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <p className={`text-sm leading-7 ${isDark ? "text-white/68" : "text-ink-light"}`}>
                Once this brief looks right, the fastest path is picks first, then Relay once the right people start replying.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryLine
                  label="Best next move"
                  value={projectConversations.length ? "Keep Relay moving" : "Start with picks"}
                  dark={isDark}
                />
                <SummaryLine
                  label="Why it matters"
                  value="The right people shape everything downstream."
                  dark={isDark}
                />
              </div>
            </div>

            <div
              className={`rounded-[24px] border p-4 ${
                isDark ? "border-white/10 bg-white/[0.05]" : "border-black/8 bg-white shadow-sm"
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Next move</p>
              <h3 className={`mt-3 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                {projectConversations.length ? "Open relay" : "See picks"}
              </h3>
              <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                {projectConversations.length
                  ? "Saga is already texting people. Open the thread and keep the conversation moving."
                  : "Saga already heard the brief. Move straight into the shortlist and start shaping the crew."}
              </p>
              <button
                onClick={() => {
                  if (projectConversations[0]) {
                    goRelay(project.id, projectConversations[0].id);
                    return;
                  }
                  openProjectDiscover(project.id);
                }}
                className="mt-4 rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-5 py-3 text-sm font-medium text-white"
              >
                {projectConversations.length ? "Open relay" : "See picks"}
              </button>
            </div>
          </div>
        </CardSection>
      </div>

      <div className="fixed bottom-[calc(0.9rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100vw-1.6rem)] max-w-[420px] -translate-x-1/2 md:hidden">
        <div className={`rounded-[26px] border p-2.5 shadow-[0_20px_60px_rgba(6,10,18,0.18)] backdrop-blur-xl ${
          isDark ? "border-white/10 bg-[#101624]/94" : "border-black/8 bg-white/92"
        }`}>
          <button
            onClick={() => openProjectDiscover(project.id)}
            className="w-full rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-2.5 text-sm font-medium text-white"
          >
            See picks
          </button>
        </div>
      </div>
    </div>
  );
}

function HeaderPill({ label, dark }: { label: string; dark: boolean }) {
  return (
    <span
      className={`rounded-pill border px-3 py-1.5 text-xs font-medium ${
        dark ? "border-white/10 bg-white/8 text-white/78" : "border-[#7bc6ff]/35 bg-white text-ink"
      }`}
    >
      {label}
    </span>
  );
}

function CardSection({
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
    <section
      className={`rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)] ${
        dark ? "border-white/8 bg-white/[0.04] text-white" : "border-black/8 bg-white/88 text-ink"
      }`}
    >
      <p className={`text-[10px] uppercase tracking-[0.26em] ${dark ? "text-white/42" : "text-ink-light"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryLine({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-[18px] px-4 py-3 text-sm ${
      dark ? "bg-white/[0.05]" : "bg-canvas"
    }`}>
      <span className={dark ? "text-white/48" : "text-ink-light"}>{label}</span>
      <span className={`max-w-[65%] text-right font-medium ${dark ? "text-white" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function RoleBudgetCard({
  role,
  scope,
  budgetLabel,
  dark,
}: {
  role: ProjectRole;
  scope: string;
  budgetLabel: string;
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 ${
        dark ? "border-white/10 bg-white/[0.05]" : "border-black/8 bg-canvas"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{role.name}</h3>
            <span
              className={`rounded-pill px-2.5 py-1 text-[11px] font-medium ${
                dark ? "bg-white/[0.08] text-white/72" : "bg-white text-ink-light shadow-sm"
              }`}
            >
              {role.quantity} needed
            </span>
          </div>
          <p className={`mt-2 text-sm leading-6 ${dark ? "text-white/62" : "text-ink-light"}`}>{scope}</p>
        </div>
        <div className="text-right">
          <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/42" : "text-ink-light"}`}>Rough cost</p>
          <p className={`mt-2 text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{budgetLabel}</p>
        </div>
      </div>
    </div>
  );
}
