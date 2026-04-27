"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { PublicTicketCard } from "@/components/PublicTicketCard";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAppStore } from "@/store/useAppStore";

export function MyEventsView() {
  const events = useAppStore((state) => state.events);
  const ownedTickets = useAppStore((state) => state.ownedTickets);
  const activeTicketId = useAppStore((state) => state.activeTicketId);
  const viewerProfile = useAppStore((state) => state.viewerProfile);
  const openTicketModal = useAppStore((state) => state.openTicketModal);
  const closeTicketModal = useAppStore((state) => state.closeTicketModal);
  const cancelTicket = useAppStore((state) => state.cancelTicket);
  const { openEvent } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const ticketCards = useMemo(() => {
    return ownedTickets
      .map((ticket) => {
        const event = events.find((entry) => entry.id === ticket.eventId);
        const tier = event?.ticketTiers.find((entry) => entry.id === ticket.tierId);
        if (!event || !tier) return null;
        return { ticket, event, tier };
      })
      .filter(Boolean) as Array<{
      ticket: (typeof ownedTickets)[number];
      event: (typeof events)[number];
      tier: (typeof events)[number]["ticketTiers"][number];
    }>;
  }, [events, ownedTickets]);

  const activeTicket = ticketCards.find((entry) => entry.ticket.id === activeTicketId) || null;
  const rsvpEvents = events.filter(
    (event) =>
      viewerProfile.attendingEventIds.includes(event.id) &&
      !ownedTickets.some((ticket) => ticket.eventId === event.id)
  );
  const workingEvents = events.filter((event) => viewerProfile.workingEventIds.includes(event.id));
  const hostingEvents = events.filter((event) => viewerProfile.hostingEventIds.includes(event.id));

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto max-w-[1180px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>My Events</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Tickets, RSVPs, working, and hosting in one clean wallet.
              </h1>
              <p className={`mt-4 max-w-[680px] text-sm leading-7 sm:text-base ${isDark ? "text-white/62" : "text-ink-light"}`}>
                Your saved tickets live next to RSVP-only plans, backstage commitments, and hosted
                events so the public side of Saga feels as polished as the production side.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <WalletStat label="Tickets" value={`${ticketCards.length}`} dark={isDark} />
              <WalletStat label="RSVPs" value={`${rsvpEvents.length}`} dark={isDark} />
              <WalletStat label="Working" value={`${workingEvents.length}`} dark={isDark} />
              <WalletStat label="Hosting" value={`${hostingEvents.length}`} dark={isDark} />
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <SectionTitle title="Tickets I Own" count={ticketCards.length} dark={isDark} />
            <div className="space-y-4">
              {ticketCards.length ? (
                ticketCards.map(({ ticket, event, tier }, index) => (
                  <PublicTicketCard
                    key={ticket.id}
                    event={event}
                    ticket={ticket}
                    tier={tier}
                    mode="wallet"
                    index={index}
                    onClick={() => openTicketModal(ticket.id)}
                  />
                ))
              ) : (
                <EmptyState message="No tickets yet. Buy one from Explore and it will land here." dark={isDark} />
              )}
            </div>
          </section>

          <div className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <MiniEventList title="RSVPs" events={rsvpEvents} onOpen={openEvent} empty="No RSVP-only events yet." dark={isDark} />
            <MiniEventList title="Working / Applied" events={workingEvents} onOpen={openEvent} empty="Your backstage work will appear here." dark={isDark} />
            <MiniEventList title="Hosting" events={hostingEvents} onOpen={openEvent} empty="Create an event to seed a hosting workspace." dark={isDark} />
          </div>
        </div>
      </div>

      {activeTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4">
          <div className={`relative w-full max-w-[430px] rounded-[34px] p-5 ${isDark ? "brand-surface-deep" : "brand-surface-strong"}`}>
            <button
              onClick={closeTicketModal}
              className={`absolute right-4 top-4 rounded-full p-2 ${isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink-light"}`}
              aria-label="Close ticket"
            >
              ×
            </button>

            <div className={`mx-auto h-1.5 w-14 rounded-full ${isDark ? "bg-white/10" : "bg-[#d7d0eb]"}`} />
            <div className={`mt-5 rounded-[26px] border p-4 ${isDark ? "border-white/8 bg-[#f7f4ee] text-[#151923]" : "border-black/8 bg-white text-[#151923]"}`}>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#6f7683]">Ticket wallet</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{activeTicket.event.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#626a79]">
                {activeTicket.event.dateLabel} · {activeTicket.event.timeLabel}
                <br />
                {activeTicket.event.venueName}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-pill bg-[#eef1ff] px-3 py-1.5 text-xs font-medium text-[#4756d6]">
                  {activeTicket.tier.name}
                </span>
                <span className="rounded-pill bg-[#141826] px-3 py-1.5 text-xs font-medium text-white">
                  {activeTicket.ticket.quantity} ticket{activeTicket.ticket.quantity > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className={`mt-5 flex items-center justify-center rounded-[28px] px-5 py-5 ${isDark ? "bg-white" : "brand-surface-inset"}`}>
              <QrPattern value={activeTicket.ticket.id} />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5d68ff]" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/16" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/16" />
            </div>

            <p className={`mt-4 text-center text-sm ${isDark ? "text-white/42" : "text-ink-light"}`}>Show this at the door</p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  closeTicketModal();
                  openEvent(activeTicket.event.id);
                }}
                className={`w-full rounded-pill border px-4 py-3 text-sm font-medium ${isDark ? "border-[#5d68ff]/50 text-white" : "border-[var(--surface-border-strong)] text-ink"}`}
              >
                View Event Details
              </button>
              <button
                onClick={() => cancelTicket(activeTicket.ticket.id)}
                className={`w-full rounded-pill px-4 py-3 text-sm font-medium ${isDark ? "text-white/38" : "text-ink-light"}`}
              >
                Cancel This Ticket
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ title, count, dark }: { title: string; count: number; dark: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-[10px] uppercase tracking-[0.26em] ${dark ? "text-white/42" : "text-ink-light"}`}>{title}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <span className={`rounded-pill px-3 py-1.5 text-xs font-medium ${dark ? "bg-white/8 text-white/62" : "brand-chip-signal"}`}>
        {count}
      </span>
    </div>
  );
}

function WalletStat({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`rounded-[24px] border p-4 ${dark ? "border-white/10 bg-white/[0.05]" : "border-black/8 bg-white/84"}`}>
      <p className={`text-[10px] uppercase tracking-[0.22em] ${dark ? "text-white/40" : "text-ink-light"}`}>{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function EmptyState({ message, dark }: { message: string; dark: boolean }) {
  return (
    <div className={`rounded-[28px] border p-6 text-sm leading-7 ${dark ? "border-white/8 bg-[#111624]/88 text-white/48" : "border-black/8 bg-white/88 text-ink-light"}`}>
      {message}
    </div>
  );
}

function MiniEventList({
  title,
  events,
  onOpen,
  empty,
  dark,
}: {
  title: string;
  events: ReturnType<typeof useAppStore.getState>["events"];
  onOpen: (eventId: string) => void;
  empty: string;
  dark: boolean;
}) {
  return (
    <section className={`rounded-[28px] border p-5 ${dark ? "border-white/8 bg-[#111624]/92" : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"}`}>
      <p className={`text-[10px] uppercase tracking-[0.26em] ${dark ? "text-white/42" : "text-ink-light"}`}>{title}</p>
      <div className="mt-4 space-y-3">
        {events.length ? (
          events.map((event) => (
            <button
              key={event.id}
              onClick={() => onOpen(event.id)}
              className={`flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left ${dark ? "bg-white/[0.04]" : "bg-canvas"}`}
            >
              <div>
                <p className={`text-sm font-medium ${dark ? "text-white/84" : "text-ink"}`}>{event.title}</p>
                <p className={`mt-1 text-xs ${dark ? "text-white/46" : "text-ink-light"}`}>{event.dateLabel} · {event.city}</p>
              </div>
              <span className={`text-xs ${dark ? "text-white/34" : "text-ink-light"}`}>Open</span>
            </button>
          ))
        ) : (
          <p className={`text-sm leading-6 ${dark ? "text-white/44" : "text-ink-light"}`}>{empty}</p>
        )}
      </div>
    </section>
  );
}

function QrPattern({ value }: { value: string }) {
  const blocks = Array.from({ length: 121 }).map((_, index) => {
    const code = value.charCodeAt(index % value.length) + index * 13;
    return code % 3 === 0;
  });

  return (
    <div className="grid grid-cols-11 gap-1 rounded-[20px] bg-white p-4">
      {blocks.map((filled, index) => (
        <div
          key={index}
          className={`h-3 w-3 rounded-[2px] ${filled ? "bg-black" : "bg-white"}`}
        />
      ))}
    </div>
  );
}
