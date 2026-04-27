"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRelayQuickReplyOptions, getTalentById } from "@/data/sagaAgencyData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

export function RelayInboxView() {
  const searchParams = useSearchParams();
  const projects = useAgencyStore((state) => state.projects);
  const talent = useAgencyStore((state) => state.talent);
  const conversations = useAgencyStore((state) => state.conversations);
  const selectedProjectId = useAgencyStore((state) => state.selectedProjectId);
  const selectedConversationId = useAgencyStore((state) => state.selectedConversationId);
  const relayPerspective = useAgencyStore((state) => state.relayPerspective);
  const selectProjectBySlug = useAgencyStore((state) => state.selectProjectBySlug);
  const selectConversation = useAgencyStore((state) => state.selectConversation);
  const setRelayPerspective = useAgencyStore((state) => state.setRelayPerspective);
  const sendRelayMessage = useAgencyStore((state) => state.sendRelayMessage);
  const simulateTalentQuickReply = useAgencyStore((state) => state.simulateTalentQuickReply);
  const simulateTalentReply = useAgencyStore((state) => state.simulateTalentReply);
  const generateTerms = useAgencyStore((state) => state.generateTerms);
  const sendTerms = useAgencyStore((state) => state.sendTerms);
  const talentAcceptTerms = useAgencyStore((state) => state.talentAcceptTerms);
  const approveTerms = useAgencyStore((state) => state.approveTerms);
  const { openProject } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const [clientDraft, setClientDraft] = useState("");
  const [talentDraft, setTalentDraft] = useState("");

  const projectSlug = searchParams.get("project");
  const conversationParam = searchParams.get("conversation");

  useEffect(() => {
    if (projectSlug) selectProjectBySlug(projectSlug);
  }, [projectSlug, selectProjectBySlug]);

  useEffect(() => {
    if (conversationParam) selectConversation(conversationParam);
  }, [conversationParam, selectConversation]);

  const project =
    projects.find((entry) => entry.slug === projectSlug) ||
    projects.find((entry) => entry.id === selectedProjectId) ||
    null;
  const projectConversations = conversations.filter((conversation) => conversation.projectId === project?.id);
  const conversation =
    projectConversations.find((entry) => entry.id === selectedConversationId) ||
    projectConversations.find((entry) => entry.id === conversationParam) ||
    projectConversations[0] ||
    null;
  const talentProfile = conversation ? getTalentById(conversation.talentId, talent) : null;

  const clientMessages = useMemo(
    () =>
      conversation?.messages.filter(
        (message) => message.visibleTo === "client" || message.visibleTo === "both"
      ) || [],
    [conversation]
  );
  const talentMessages = useMemo(
    () =>
      conversation?.messages.filter(
        (message) => message.visibleTo === "talent" || message.visibleTo === "both"
      ) || [],
    [conversation]
  );

  const quickReplies = getRelayQuickReplyOptions();

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1360px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Saga Relay</p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-5xl ${isDark ? "text-white" : "text-ink"}`}>
                Live text coordination without exchanging contact info.
              </h1>
              <p className={`mt-4 max-w-[760px] text-sm leading-7 ${isDark ? "text-white/64" : "text-ink-light"}`}>
                Saga reformats outreach, relays messages by text, extracts decisions, and turns messy replies into clear booking terms.
              </p>
            </div>
            {project ? (
              <button
                onClick={() => openProject(project.id)}
                className="brand-button-secondary rounded-pill px-5 py-3 text-sm font-medium"
              >
                Back to Workspace
              </button>
            ) : null}
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[320px_1.02fr_0.94fr]">
          <section className={`rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${
            isDark ? "border-white/8 bg-[#101624]/92" : "border-black/8 bg-white/92"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Inbox</p>
                <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>Relay threads</h2>
              </div>
              {project ? (
                <span className={`rounded-pill px-3 py-1.5 text-xs font-medium ${isDark ? "bg-white/8 text-white/66" : "bg-[#edf5ff] text-ink"}`}>
                  {projectConversations.length}
                </span>
              ) : null}
            </div>

            <p className={`mt-4 text-sm leading-6 ${isDark ? "text-white/52" : "text-ink-light"}`}>
              Saga relays messages by text. Contact details stay private.
            </p>

            <div className="mt-5 space-y-3">
              {projectConversations.length ? (
                projectConversations.map((entry) => {
                  const profile = getTalentById(entry.talentId, talent);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => selectConversation(entry.id)}
                      className={`w-full rounded-[24px] px-4 py-4 text-left transition-colors ${
                        entry.id === conversation?.id
                          ? isDark
                            ? "bg-white/10"
                            : "bg-[#edf5ff]"
                          : isDark
                            ? "bg-white/[0.04]"
                            : "bg-canvas/70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`relative h-11 w-11 overflow-hidden rounded-full ${isDark ? "bg-white/8" : "bg-[#edf5ff]"}`}>
                          {profile ? (
                            <Image src={profile.avatar || profile.portfolioImages[0]} alt={profile.name} fill sizes="44px" className="object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{profile?.name}</p>
                          <p className={`mt-1 truncate text-xs uppercase tracking-[0.18em] ${isDark ? "text-white/36" : "text-ink-light"}`}>
                            {entry.status}
                          </p>
                        </div>
                      </div>
                      <p className={`mt-3 text-sm leading-6 ${isDark ? "text-white/56" : "text-ink-light"}`}>{entry.sagaSummary}</p>
                    </button>
                  );
                })
              ) : (
                <p className={`text-sm leading-7 ${isDark ? "text-white/46" : "text-ink-light"}`}>
                  Start outreach from a project workspace or talent profile and the thread will appear here.
                </p>
              )}
            </div>
          </section>

          <section className={`rounded-[30px] border p-5 shadow-[0_18px_40px_rgba(17,17,17,0.06)] ${
            isDark ? "border-white/8 bg-white/78" : "border-black/8 bg-white/92"
          }`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.26em] text-ink-light">Hiring user view</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Saga Relay inbox</h2>
              </div>
              {talentProfile ? (
                <span className="rounded-pill bg-canvas px-3 py-1.5 text-xs font-medium text-ink">
                  Texting via Saga Relay
                </span>
              ) : null}
            </div>

            {conversation && talentProfile ? (
              <>
                <div className="mt-5 flex items-center gap-3 rounded-[22px] bg-canvas px-4 py-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full">
                    <Image src={talentProfile.avatar || talentProfile.portfolioImages[0]} alt={talentProfile.name} fill sizes="48px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{talentProfile.name}</p>
                    <p className="mt-1 text-xs text-ink-light">
                      {talentProfile.roles[0]} · {talentProfile.phoneMasked} · private relay only
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {clientMessages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      sender={message.sender}
                      body={message.body}
                      timestamp={message.timestamp}
                    />
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] bg-canvas p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-ink-light">Saga summary</p>
                  <p className="mt-3 text-sm leading-6 text-ink">{conversation.sagaSummary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {conversation.nextActions.map((action) => (
                      <span key={action} className="rounded-pill bg-white px-3 py-1.5 text-xs font-medium text-ink-light shadow-sm">
                        {action}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-black/8 bg-white p-4">
                  <label className="text-[10px] uppercase tracking-[0.22em] text-ink-light">Send through Saga</label>
                  <textarea
                    value={clientDraft}
                    onChange={(event) => setClientDraft(event.target.value)}
                    placeholder="Can you ask if the rate works for a 4-hour half-day and whether parking is needed?"
                    className="mt-3 min-h-[120px] w-full resize-none rounded-[20px] bg-canvas px-4 py-3 text-sm leading-6 text-ink outline-none"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        sendRelayMessage(conversation.id, clientDraft);
                        setClientDraft("");
                      }}
                      className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-2.5 text-sm font-medium text-white"
                    >
                      Relay message
                    </button>
                    <button
                      onClick={() => generateTerms(conversation.id)}
                      className="rounded-pill border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-ink"
                    >
                      Generate Terms
                    </button>
                    <button
                      onClick={() => sendTerms(conversation.id)}
                      className="rounded-pill border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-ink"
                    >
                      Send Terms
                    </button>
                    <button
                      onClick={() => approveTerms(conversation.id)}
                      className="rounded-pill border border-black/8 bg-white px-4 py-2.5 text-sm font-medium text-ink"
                    >
                      Approve + Book
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel message="No relay thread selected yet." />
            )}
          </section>

          <section className={`rounded-[30px] border p-5 shadow-[0_24px_70px_rgba(6,10,18,0.14)] ${
            isDark ? "border-white/8 bg-[#101624]/92 text-white" : "border-black/8 bg-white/92 text-ink"
          }`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Talent SMS view</p>
                <h2 className={`mt-2 text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>Protected talent perspective</h2>
              </div>
              <div className="flex gap-2">
                <PerspectiveTab
                  label="Client"
                  active={relayPerspective === "client"}
                  dark={isDark}
                  onClick={() => setRelayPerspective("client")}
                />
                <PerspectiveTab
                  label="Talent"
                  active={relayPerspective === "talent"}
                  dark={isDark}
                  onClick={() => setRelayPerspective("talent")}
                />
              </div>
            </div>

            {conversation && talentProfile ? (
              <>
                <div className={`mt-5 rounded-[28px] border p-4 shadow-[0_24px_60px_rgba(6,10,18,0.1)] ${
                  isDark ? "border-white/8 bg-[#0c1018]" : "border-black/8 bg-[#f9fbff]"
                }`}>
                  <div className={`mx-auto h-1.5 w-14 rounded-full ${isDark ? "bg-white/12" : "bg-[#d7e8ff]"}`} />
                  <div className="mt-5 text-center">
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-ink"}`}>Saga</p>
                    <p className={`mt-1 text-xs ${isDark ? "text-white/40" : "text-ink-light"}`}>{talentProfile.phoneMasked} · contact details stay private</p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {talentMessages.map((message) => (
                      <SmsBubble
                        key={message.id}
                        sender={message.sender}
                        body={message.body}
                        timestamp={message.timestamp}
                        dark={isDark}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Quick replies</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(quickReplies).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => simulateTalentQuickReply(conversation.id, key as keyof typeof quickReplies)}
                        className={`rounded-pill border px-3 py-2 text-xs font-medium ${
                          isDark ? "border-white/10 bg-white/8 text-white/74" : "border-[#7bc6ff]/30 bg-[#edf5ff] text-[#173250]"
                        }`}
                      >
                        {value.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`mt-5 rounded-[24px] p-4 ${isDark ? "bg-white/[0.05]" : "bg-[#edf5ff]"}`}>
                  <label className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Simulate freeform talent reply</label>
                  <textarea
                    value={talentDraft}
                    onChange={(event) => setTalentDraft(event.target.value)}
                    placeholder="I’m available after 1pm. $1800 is okay if the client covers parking."
                    className={`mt-3 min-h-[120px] w-full resize-none rounded-[20px] px-4 py-3 text-sm leading-6 outline-none ${
                      isDark ? "bg-[#0c1018] text-white" : "bg-white text-ink"
                    }`}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        simulateTalentReply(conversation.id, talentDraft);
                        setTalentDraft("");
                      }}
                      className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-2.5 text-sm font-medium text-white"
                    >
                      Send talent reply
                    </button>
                    <button
                      onClick={() => talentAcceptTerms(conversation.id)}
                      className={`rounded-pill border px-4 py-2.5 text-sm font-medium ${
                        isDark ? "border-white/10 bg-white/8 text-white/78" : "border-[#7bc6ff]/30 bg-white text-ink"
                      }`}
                    >
                      Accept Terms
                    </button>
                  </div>
                </div>

                <div className={`mt-5 rounded-[24px] p-4 ${isDark ? "bg-white/[0.05]" : "bg-[#edf5ff]"}`}>
                  <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Extracted terms</p>
                  <div className="mt-4 space-y-3">
                    <RelayLine label="Availability" value={conversation.extractedTerms.dateTime || "TBD"} dark={isDark} />
                    <RelayLine label="Rate" value={conversation.extractedTerms.rate || "TBD"} dark={isDark} />
                    <RelayLine label="Scope" value={conversation.extractedTerms.scope || "TBD"} dark={isDark} />
                    <RelayLine label="Expenses" value={conversation.extractedTerms.expenses || "TBD"} dark={isDark} />
                    <RelayLine label="Status" value={conversation.extractedTerms.status} dark={isDark} />
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel message="No talent thread selected yet." dark={isDark} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PerspectiveTab({
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
      className={`rounded-pill px-3 py-2 text-xs font-medium ${
        active
          ? dark
            ? "bg-white text-[#101624]"
            : "bg-[#7bc6ff] text-[#0b1423]"
          : dark
            ? "bg-white/8 text-white/72"
            : "bg-[#edf5ff] text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ChatBubble({
  sender,
  body,
  timestamp,
}: {
  sender: "client" | "saga" | "talent";
  body: string;
  timestamp: string;
}) {
  const isClient = sender === "client";
  return (
    <div className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-[22px] px-4 py-3 shadow-sm ${isClient ? "bg-[#101624] text-white" : "bg-canvas text-ink"}`}>
        <p className="text-sm leading-6">{body}</p>
        <p className={`mt-2 text-[11px] ${isClient ? "text-white/46" : "text-ink-light"}`}>{timestamp}</p>
      </div>
    </div>
  );
}

function SmsBubble({
  sender,
  body,
  timestamp,
  dark,
}: {
  sender: "client" | "saga" | "talent";
  body: string;
  timestamp: string;
  dark: boolean;
}) {
  const isTalent = sender === "talent";
  return (
    <div className={`flex ${isTalent ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-[22px] px-4 py-3 ${
        isTalent
          ? "bg-[#4f78f4] text-white"
          : dark
            ? "bg-white/[0.08] text-white/84"
            : "bg-[#edf5ff] text-ink"
      }`}>
        <p className="text-sm leading-6">{body}</p>
        <p className={`mt-2 text-[11px] ${
          isTalent ? "text-white/48" : dark ? "text-white/36" : "text-ink-light"
        }`}>{timestamp}</p>
      </div>
    </div>
  );
}

function RelayLine({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0 ${
      dark ? "border-white/8" : "border-black/8"
    }`}>
      <span className={dark ? "text-white/46" : "text-ink-light"}>{label}</span>
      <span className={`max-w-[70%] text-right font-medium ${dark ? "text-white/84" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function EmptyPanel({ message, dark = false }: { message: string; dark?: boolean }) {
  return (
    <div className={`rounded-[24px] ${dark ? "bg-white/[0.05] text-white/50" : "bg-canvas text-ink-light"} px-4 py-5 text-sm leading-7`}>
      {message}
    </div>
  );
}
