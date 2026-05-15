"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getTalentById } from "@/data/sagaAgencyData";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import { useSessionPersona } from "@/lib/useSessionPersona";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function RelayInboxView() {
  const searchParams = useSearchParams();
  const { persona } = useSessionPersona();
  const projects = useAgencyStore((state) => state.projects);
  const talent = useAgencyStore((state) => state.talent);
  const conversations = useAgencyStore((state) => state.conversations);
  const selectedProjectId = useAgencyStore((state) => state.selectedProjectId);
  const selectedConversationId = useAgencyStore((state) => state.selectedConversationId);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const selectConversation = useAgencyStore((state) => state.selectConversation);
  const sendRelayMessage = useAgencyStore((state) => state.sendRelayMessage);
  const simulateTalentReply = useAgencyStore((state) => state.simulateTalentReply);
  const generateTerms = useAgencyStore((state) => state.generateTerms);
  const sendTerms = useAgencyStore((state) => state.sendTerms);
  const talentAcceptTerms = useAgencyStore((state) => state.talentAcceptTerms);
  const approveTerms = useAgencyStore((state) => state.approveTerms);
  const { goExplore, goHome, goMe, openProject } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const [draft, setDraft] = useState("");

  const projectSlug = searchParams.get("project");
  const conversationParam = searchParams.get("conversation");

  useEffect(() => {
    if (projectSlug) {
      selectProjectBySlug(projectSlug);
    }
  }, [projectSlug, selectProjectBySlug]);

  useEffect(() => {
    if (conversationParam) {
      selectConversation(conversationParam);
    }
  }, [conversationParam, selectConversation]);

  const project =
    projects.find((entry) => entry.slug === projectSlug) ||
    projects.find((entry) => entry.id === selectedProjectId) ||
    null;
  const projectConversations = conversations.filter(
    (conversation) => conversation.projectId === project?.id,
  );
  const conversation =
    projectConversations.find((entry) => entry.id === selectedConversationId) ||
    projectConversations.find((entry) => entry.id === conversationParam) ||
    projectConversations[0] ||
    null;
  const talentProfile = conversation ? getTalentById(conversation.talentId, talent) : null;

  const clientMessages = useMemo(
    () =>
      conversation?.messages.filter(
        (message) => message.visibleTo === "client" || message.visibleTo === "both",
      ) || [],
    [conversation],
  );
  const talentMessages = useMemo(
    () =>
      conversation?.messages.filter(
        (message) => message.visibleTo === "talent" || message.visibleTo === "both",
      ) || [],
    [conversation],
  );

  const isHostView = persona === "host";
  const isCreativeView = persona === "creative";

  if (!isHostView && !isCreativeView) {
    return (
      <RelayEmptyState
        dark={isDark}
        onOpenChat={() => {
          requestWebChatReset();
          goHome();
        }}
      />
    );
  }

  if (!conversation || !project || !talentProfile) {
    return (
      <RelayEmptyState
        dark={isDark}
        message="Relay opens once you've got someone to talk to."
        ctaLabel={isHostView ? "Find my crew" : "See my feed"}
        onOpenChat={isHostView ? goExplore : goMe}
      />
    );
  }

  const primaryMessages = isHostView ? clientMessages : talentMessages;
  const shadowMessages = isHostView ? talentMessages : clientMessages;
  const shadowLabel = isHostView ? "What the talent sees" : "What the client sees";

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[980px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
                Saga Relay
              </p>
              <h1
                data-copy-lint="header"
                className={`mt-3 text-3xl font-semibold tracking-tight sm:text-5xl ${
                  isDark ? "text-white" : "text-ink"
                }`}
              >
                Outreach in motion.
              </h1>
              <p
                data-copy-lint="subhead"
                className={`mt-4 max-w-[760px] text-sm leading-7 ${
                  isDark ? "text-white/64" : "text-ink-light"
                }`}
              >
                We text. They reply. Done.
              </p>
            </div>

            <button
              onClick={() => openProject(project.id)}
              className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
            >
              Back to project
            </button>
          </div>
        </motion.section>

        <section
          className={`rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${
            isDark ? "border-white/8 bg-[#101624]/92" : "border-black/8 bg-white/92"
          }`}
        >
          <div className="flex flex-wrap gap-2">
            {projectConversations.map((entry) => {
              const profile = getTalentById(entry.talentId, talent);
              return (
                <button
                  key={entry.id}
                  onClick={() => selectConversation(entry.id)}
                  className={`rounded-pill px-4 py-2 text-sm font-medium ${
                    entry.id === conversation.id
                      ? "brand-button-primary text-white"
                      : isDark
                        ? "border border-white/10 bg-white/8 text-white/74"
                        : "border border-black/8 bg-canvas text-ink"
                  }`}
                >
                  {profile?.name || "Relay thread"}
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={`rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${
            isDark ? "border-white/8 bg-white/78" : "border-black/8 bg-white/92"
          }`}
        >
          <div className="flex items-center gap-3 rounded-[22px] bg-canvas px-4 py-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full">
              <Image
                src={talentProfile.avatar || talentProfile.portfolioImages[0]}
                alt={talentProfile.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{talentProfile.name}</p>
              <p className="mt-1 text-xs text-ink-light">
                {talentProfile.roles[0]} · {talentProfile.phoneMasked} · private relay only
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {primaryMessages.map((message) => (
              <RelayBubble
                key={message.id}
                sender={message.sender}
                body={message.body}
                timestamp={message.timestamp}
                dark={isDark}
                currentPersona={persona}
              />
            ))}
          </div>

          <div className={`mt-5 rounded-[24px] border p-4 ${
            isDark ? "border-white/10 bg-white/[0.04]" : "border-black/8 bg-white"
          }`}>
            <label className={`text-[10px] uppercase tracking-[0.22em] ${
              isDark ? "text-white/42" : "text-ink-light"
            }`}>
              {isHostView ? "Your message" : "Your reply"}
            </label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isHostView
                  ? "Ask about rate, timing, or scope..."
                  : "Reply as the creative..."
              }
              className={`mt-3 min-h-[120px] w-full resize-none rounded-[20px] px-4 py-3 text-sm leading-6 outline-none ${
                isDark ? "bg-[#0c1018] text-white" : "bg-canvas text-ink"
              }`}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  if (!draft.trim()) {
                    return;
                  }

                  if (isHostView) {
                    sendRelayMessage(conversation.id, draft);
                  } else {
                    simulateTalentReply(conversation.id, draft);
                  }
                  setDraft("");
                }}
                className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium"
              >
                {isHostView ? "Relay message" : "Send reply"}
              </button>

              {isHostView ? (
                <>
                  <button
                    onClick={() => generateTerms(conversation.id)}
                    className="brand-button-secondary rounded-pill px-4 py-2.5 text-sm font-medium"
                  >
                    Generate terms
                  </button>
                  <button
                    onClick={() => sendTerms(conversation.id)}
                    className="brand-button-secondary rounded-pill px-4 py-2.5 text-sm font-medium"
                  >
                    Send terms
                  </button>
                  <button
                    onClick={() => approveTerms(conversation.id)}
                    className="brand-button-secondary rounded-pill px-4 py-2.5 text-sm font-medium"
                  >
                    Approve booking
                  </button>
                </>
              ) : (
                <button
                  onClick={() => talentAcceptTerms(conversation.id)}
                  className="brand-button-secondary rounded-pill px-4 py-2.5 text-sm font-medium"
                >
                  Accept terms
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div
            className={`rounded-[26px] border p-5 ${
              isDark ? "border-white/8 bg-white/[0.04]" : "border-black/8 bg-white/88"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.22em] ${
              isDark ? "text-white/42" : "text-ink-light"
            }`}>
              Saga summary
            </p>
            <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/70" : "text-ink-light"}`}>
              {conversation.sagaSummary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {conversation.nextActions.map((action) => (
                <span
                  key={action}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                    isDark ? "bg-white/8 text-white/70" : "bg-canvas text-ink-light"
                  }`}
                >
                  {action}
                </span>
              ))}
            </div>
          </div>

          <div
            className={`rounded-[26px] border p-5 ${
              isDark ? "border-white/8 bg-white/[0.04]" : "border-black/8 bg-white/88"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.22em] ${
              isDark ? "text-white/42" : "text-ink-light"
            }`}>
              Extracted terms
            </p>
            <div className="mt-4 space-y-3">
              <RelayLine label="Availability" value={conversation.extractedTerms.dateTime || "TBD"} dark={isDark} />
              <RelayLine label="Rate" value={conversation.extractedTerms.rate || "TBD"} dark={isDark} />
              <RelayLine label="Scope" value={conversation.extractedTerms.scope || "TBD"} dark={isDark} />
              <RelayLine label="Expenses" value={conversation.extractedTerms.expenses || "TBD"} dark={isDark} />
              <RelayLine label="Status" value={conversation.extractedTerms.status} dark={isDark} />
            </div>
          </div>
        </section>

        <details
          className={`rounded-[26px] border p-5 ${
            isDark ? "border-white/8 bg-white/[0.04]" : "border-black/8 bg-white/88"
          }`}
        >
          <summary className={`cursor-pointer list-none text-sm font-medium ${
            isDark ? "text-white/80" : "text-ink"
          }`}>
            {shadowLabel}
          </summary>
          <div className="mt-4 space-y-3">
            {shadowMessages.map((message) => (
              <RelayBubble
                key={message.id}
                sender={message.sender}
                body={message.body}
                timestamp={message.timestamp}
                dark={isDark}
                currentPersona={isHostView ? "creative" : "host"}
              />
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function RelayBubble({
  sender,
  body,
  timestamp,
  dark,
  currentPersona,
}: {
  sender: "client" | "saga" | "talent";
  body: string;
  timestamp: string;
  dark: boolean;
  currentPersona: "host" | "creative" | "venue" | "fan" | null;
}) {
  const isComposerSide =
    (currentPersona === "host" && sender === "client") ||
    (currentPersona === "creative" && sender === "talent");

  return (
    <div className={`flex ${isComposerSide ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-[22px] px-4 py-3 ${
          isComposerSide
            ? "bg-[linear-gradient(135deg,#5f45ff,#6ea4ff)] text-white"
            : dark
              ? "bg-white/[0.08] text-white/84"
              : "bg-canvas text-ink"
        }`}
      >
        <p className="text-sm leading-6">{body}</p>
        <p
          className={`mt-2 text-[11px] ${
            isComposerSide
              ? "text-white/48"
              : dark
                ? "text-white/36"
                : "text-ink-light"
          }`}
        >
          {timestamp}
        </p>
      </div>
    </div>
  );
}

function RelayLine({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0 ${
        dark ? "border-white/8" : "border-black/8"
      }`}
    >
      <span className={dark ? "text-white/46" : "text-ink-light"}>{label}</span>
      <span className={`max-w-[70%] text-right font-medium ${
        dark ? "text-white/84" : "text-ink"
      }`}>
        {value}
      </span>
    </div>
  );
}

function RelayEmptyState({
  dark,
  message = "Relay opens once you've got someone to talk to.",
  ctaLabel = "Talk to Sagasan",
  onOpenChat,
}: {
  dark: boolean;
  message?: string;
  ctaLabel?: string;
  onOpenChat: () => void;
}) {
  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        dark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[760px] space-y-6">
        <section
          className={`rounded-[32px] p-5 sm:p-7 ${
            dark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.3em] ${dark ? "text-white/42" : "text-ink-light"}`}>
            Saga Relay
          </p>
          <h1
            data-copy-lint="header"
            className={`mt-3 text-3xl font-semibold tracking-tight sm:text-5xl ${
              dark ? "text-white" : "text-ink"
            }`}
          >
            Outreach in motion.
          </h1>
          <p
            data-copy-lint="subhead"
            className={`mt-4 text-sm leading-7 ${dark ? "text-white/64" : "text-ink-light"}`}
          >
            We text. They reply. Done.
          </p>
        </section>

        <section
          className={`rounded-[26px] border p-6 ${
            dark
              ? "border-white/8 bg-white/[0.04]"
              : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
          }`}
        >
          <p className={`text-sm leading-7 ${dark ? "text-white/60" : "text-ink-light"}`}>
            {message}
          </p>
          <button
            onClick={onOpenChat}
            className="brand-button-primary mt-4 rounded-pill px-4 py-2.5 text-sm font-medium"
          >
            {ctaLabel}
          </button>
        </section>
      </div>
    </div>
  );
}
