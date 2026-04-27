"use client";

import { motion } from "framer-motion";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useAppStore } from "@/store/useAppStore";

export function OutreachView({ eventSlug }: { eventSlug?: string }) {
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const event =
    events.find((item) => item.id === selectedEventId) ||
    (eventSlug ? events.find((item) => item.slug === eventSlug) : undefined);
  const outreachThreads = useAppStore((state) => state.outreachThreads);
  const outreachReady = useAppStore((state) => state.outreachReady);
  const groupChat = useAppStore((state) => state.groupChat);
  const advanceOutreach = useAppStore((state) => state.advanceOutreach);
  const publishProject = useAppStore((state) => state.publishProject);
  const openAssembly = useAppStore((state) => state.openAssembly);
  const { openWorkspace, openEvent } = useSagaNavigation();

  if (!event) return null;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#090d16] px-4 pb-32 pt-24 text-white md:px-6 md:pb-16 md:pt-28">
      <div className="mx-auto max-w-[1320px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,#121828,#1a2140,#101624)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.32)] sm:rounded-[34px] sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/42">Preview staffing flow</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Outreach drafts ready</h1>
              <p className="mt-4 max-w-[720px] text-sm leading-7 text-white/62">
                Saga drafts creator outreach, simulates acceptances, and opens a shared group chat once the team is confirmed.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  openAssembly();
                  openWorkspace(event.id);
                }}
                className="rounded-pill border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/72"
              >
                Back to crew board
              </button>
              <button
                onClick={() => {
                  if (outreachReady) {
                    publishProject();
                    openEvent(event.id);
                  } else {
                    advanceOutreach();
                  }
                }}
                className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-2.5 text-sm font-medium text-white"
              >
                {outreachReady ? "Publish Event Page" : "Advance Outreach"}
              </button>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[30px] border border-white/8 bg-white/[0.04] p-5">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">Text drafts</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {outreachThreads.length ? (
                outreachThreads.map((thread) => (
                  <div key={thread.id} className="rounded-[28px] border border-white/8 bg-[#121827] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold tracking-tight">{thread.creatorName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/42">
                          {thread.role} · {thread.city}
                        </p>
                      </div>
                      <span className={`rounded-pill px-3 py-1 text-xs font-medium ${
                        thread.status === "accepted"
                          ? "bg-[#2c466a] text-[#8fd6ff]"
                          : thread.status === "sent"
                            ? "bg-[#3b345c] text-[#c0b4ff]"
                            : "bg-white/8 text-white/58"
                      }`}>
                        {thread.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {thread.messages.map((message) => (
                        <div key={message} className="rounded-[18px] bg-[#4e76f3] px-4 py-3 text-sm leading-6 text-white">
                          {message}
                        </div>
                      ))}
                      {thread.status === "accepted" && (
                        <div className="rounded-[18px] bg-white/6 px-4 py-3 text-sm leading-6 text-white/74">
                          {thread.reply}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-white/52">
                  Lock a few team members first and Saga will stage the outreach preview automatically.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">Readiness</p>
              <div className="mt-5 space-y-3">
                <SummaryRow label="Queued or sent" value={`${outreachThreads.filter((thread) => thread.status !== "accepted").length}`} />
                <SummaryRow label="Accepted" value={`${outreachThreads.filter((thread) => thread.status === "accepted").length}`} />
                <SummaryRow label="Launch readiness" value={`${event.productionPlan.launchReadiness}%`} />
              </div>
            </div>

            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-5">
              <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">Saga PM group chat</p>
              {groupChat ? (
                <div className="mt-5 space-y-3">
                  {groupChat.messages.map((message) => (
                    <div key={`${message.sender}-${message.time}-${message.text}`} className="rounded-[22px] bg-white/[0.05] p-4">
                      <p className="text-sm font-medium text-white/82">{message.sender}</p>
                      <p className="mt-2 text-sm leading-6 text-white/62">{message.text}</p>
                      <p className="mt-3 text-xs text-white/34">{message.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-white/52">
                  The PM thread opens as soon as outreach is staged.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-white/46">{label}</span>
      <span className="font-medium text-white/82">{value}</span>
    </div>
  );
}
