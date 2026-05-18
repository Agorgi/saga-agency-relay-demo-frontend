"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { getTalentById } from "@/data/sagaAgencyData";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import { decodePrefillPayload, readPendingNextStep } from "@/lib/webChatNextStep";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

type FeedItem = {
  id: string;
  title: string;
  detail: string;
  summary: string;
  actionLabel: string;
  onAction: () => void;
};

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export function ForMeView({
  legacyHeader = false,
  encodedPrefill = null,
}: {
  legacyHeader?: boolean;
  encodedPrefill?: string | null;
}) {
  const viewerProfile = useAgencyStore((state) => state.viewerProfile);
  const projects = useAgencyStore((state) => state.projects);
  const conversations = useAgencyStore((state) => state.conversations);
  const talent = useAgencyStore((state) => state.talent);
  const { goHome, goRelay, openProject } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";
  const handoffPrefill = useMemo(() => {
    const fromQuery = decodePrefillPayload(encodedPrefill);
    if (fromQuery) {
      return fromQuery;
    }

    return readPendingNextStep("/me")?.prefill ?? null;
  }, [encodedPrefill]);

  const projectItems: FeedItem[] = viewerProfile.activeProjectIds
    .map((projectId) => projects.find((project) => project.id === projectId) || null)
    .filter(isPresent)
    .map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      detail: "Project",
      summary: `Next move: ${project.staffingPlan.nextActions[0] || "Keep it moving."}`,
      actionLabel: "Open project",
      onAction: () => openProject(project.id),
    }));

  const relayItems: FeedItem[] = conversations
    .filter((conversation) => viewerProfile.activeProjectIds.includes(conversation.projectId))
    .slice(0, 4)
    .map((conversation) => {
      const project = projects.find((entry) => entry.id === conversation.projectId);
      const profile = getTalentById(conversation.talentId, talent);
      return {
        id: `relay-${conversation.id}`,
        title: profile?.name || "Outreach thread",
        // Was "Relay" — too gnomic for a feed eyebrow. The new label
        // makes the card-type self-explanatory: Saga is messaging a
        // candidate on the viewer's behalf. Closes P2-OI-23.
        detail: "Saga outreach",
        summary: conversation.sagaSummary,
        actionLabel: "Open thread",
        onAction: () => goRelay(project?.id, conversation.id),
      };
    });

  const inboundItems: FeedItem[] = viewerProfile.inboundOpportunityIds
    .map((conversationId) => conversations.find((conversation) => conversation.id === conversationId) || null)
    .filter(isPresent)
    .map((conversation) => {
      const project = projects.find((entry) => entry.id === conversation.projectId);
      return {
        id: `inbound-${conversation.id}`,
        title: project?.title || "New opportunity",
        detail: "Opportunity",
        summary: conversation.sagaSummary,
        actionLabel: "See thread",
        onAction: () => goRelay(project?.id, conversation.id),
      };
    });

  const items = [...inboundItems, ...relayItems, ...projectItems];

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[980px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[30px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
            {legacyHeader ? "Your Saga." : "For me"}
          </p>
          <h1
            data-copy-lint="header"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            Your next moves.
          </h1>
          <p
            data-copy-lint="subhead"
            className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}
          >
            Everything worth checking.
          </p>
        </motion.section>

        {handoffPrefill ? (
          <section
            className={`rounded-[26px] border p-5 ${
              isDark
                ? "border-white/8 bg-white/[0.04]"
                : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/40" : "text-ink-light"}`}>
              Sagasan handoff
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {typeof handoffPrefill.city === "string" ? (
                <ContextPill value={`City · ${handoffPrefill.city}`} dark={isDark} />
              ) : null}
              {Array.isArray(handoffPrefill.roles) && handoffPrefill.roles.length ? (
                <ContextPill value={`Roles · ${handoffPrefill.roles.join(", ")}`} dark={isDark} />
              ) : null}
              {typeof handoffPrefill.portfolio === "string" && handoffPrefill.portfolio ? (
                <ContextPill value="Portfolio attached" dark={isDark} />
              ) : null}
            </div>
          </section>
        ) : null}

        {items.length ? (
          <div className="space-y-4">
            {items.map((item, index) => (
              <motion.section
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-[26px] border p-5 ${
                  isDark
                    ? "border-white/8 bg-white/[0.04]"
                    : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/40" : "text-ink-light"}`}>
                      {item.detail}
                    </p>
                    <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
                      {item.title}
                    </h2>
                    <p className={`max-w-[640px] text-sm leading-7 ${isDark ? "text-white/60" : "text-ink-light"}`}>
                      {item.summary}
                    </p>
                  </div>

                  <button
                    onClick={item.onAction}
                    className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium"
                  >
                    {item.actionLabel}
                  </button>
                </div>
              </motion.section>
            ))}
          </div>
        ) : (
          <section
            className={`rounded-[26px] border p-6 ${
              isDark
                ? "border-white/8 bg-white/[0.04]"
                : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
            }`}
          >
            <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
              Nothing waiting yet.
            </h2>
            <button
              onClick={() => {
                requestWebChatReset();
                goHome();
              }}
              className="brand-button-primary mt-4 rounded-pill px-4 py-2.5 text-sm font-medium"
            >
              Talk to Sagasan
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function ContextPill({ value, dark }: { value: string; dark: boolean }) {
  return (
    <span
      className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
        dark ? "bg-white/8 text-white/72" : "bg-canvas text-ink-light"
      }`}
    >
      {value}
    </span>
  );
}
