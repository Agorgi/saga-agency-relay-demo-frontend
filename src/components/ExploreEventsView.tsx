"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { PublicTicketCard } from "@/components/PublicTicketCard";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useAppStore } from "@/store/useAppStore";

export function ExploreEventsView() {
  const events = useAppStore((state) => state.events);
  const eventSearchQuery = useAppStore((state) => state.eventSearchQuery);
  const setEventSearchQuery = useAppStore((state) => state.setEventSearchQuery);
  const { openEvent, openCreate, goFeed } = useSagaNavigation();

  const filteredEvents = useMemo(() => {
    const needle = eventSearchQuery.toLowerCase().trim();
    if (!needle) return events;
    return events.filter((event) => {
      const haystack = `${event.title} ${event.tags.join(" ")} ${event.city} ${event.eventType}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [eventSearchQuery, events]);

  const spotlight = filteredEvents[0];
  const quickList = filteredEvents.slice(1, 5);
  const recommended = filteredEvents.slice(1);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,#101624,#1a2140,#101624)] p-5 text-white shadow-[0_32px_80px_rgba(6,10,18,0.45)] sm:p-7"
        >
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/44">Find your fandom IRL</p>
              <h1 className="mt-3 text-[2.4rem] font-semibold leading-[0.95] tracking-tight sm:text-5xl">
                Fan events near you, with polished public pages from the start.
              </h1>
              <p className="mt-4 max-w-[660px] text-sm leading-7 text-white/66 sm:text-base">
                Browse by fandom, see scarcity and mutuals at a glance, and open the same event
                backstage when it is time to staff, sell, and launch.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoChip label="Find your fandom IRL" />
              <InfoChip label="Tickets, tailored" />
              <InfoChip label="Be part of the production" />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 items-center gap-3 rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white/40">
                <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                value={eventSearchQuery}
                onChange={(event) => setEventSearchQuery(event.target.value)}
                placeholder="Search by title, fandom, city, or format"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/32"
              />
            </label>

            <div className="flex gap-2">
              <button
                onClick={openCreate}
                className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-3 text-sm font-medium text-white"
              >
                Create Event
              </button>
              <button
                onClick={goFeed}
                className="rounded-pill border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white/74"
              >
                Explore Feed
              </button>
            </div>
          </div>
        </motion.section>

        {spotlight ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <motion.button
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openEvent(spotlight.id)}
              className="overflow-hidden rounded-[32px] border border-white/8 bg-[#111624]/92 text-left text-white shadow-[0_28px_80px_rgba(6,10,18,0.34)]"
            >
              <div
                className="relative min-h-[320px] overflow-hidden p-5 sm:min-h-[360px] sm:p-6"
                style={{ backgroundImage: `linear-gradient(135deg, ${spotlight.heroGradient[0]}, ${spotlight.heroGradient[1]})` }}
              >
                {spotlight.heroImage ? (
                  <Image
                    src={spotlight.heroImage}
                    alt={spotlight.title}
                    fill
                    sizes="(max-width: 1280px) 100vw, 70vw"
                    className="absolute inset-0 object-cover opacity-28 mix-blend-screen"
                  />
                ) : null}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,22,0.05),rgba(9,13,22,0.62),rgba(9,13,22,0.9))]" />

                <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                  <div className="flex flex-wrap gap-2">
                    {spotlight.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-pill border border-white/12 bg-black/16 px-3 py-1.5 text-[11px] font-medium text-white/82"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="max-w-[720px]">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/44">Featured this week</p>
                    <h2 className="mt-3 text-[2.4rem] font-semibold leading-[0.94] tracking-tight sm:text-6xl">
                      {spotlight.title}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-white/68 sm:text-base">
                      {spotlight.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-4 text-sm text-white/72">
                      <span>{spotlight.dateLabel}</span>
                      <span className="text-white/28">•</span>
                      <span>{spotlight.city}</span>
                      <span className="text-white/28">•</span>
                      <span>{spotlight.eventType}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.button>

            <section className="rounded-[32px] border border-white/8 bg-[#111624]/92 p-4 text-white shadow-[0_24px_70px_rgba(6,10,18,0.28)]">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/40">Tonight / soon</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Quick opens</h2>
                </div>
                <span className="rounded-pill bg-white/8 px-3 py-1.5 text-xs font-medium text-white/66">
                  {filteredEvents.length} events
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {quickList.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => openEvent(event.id)}
                    className="flex w-full items-center justify-between rounded-[24px] bg-white/[0.04] px-4 py-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-white/86">{event.title}</p>
                      <p className="mt-1 text-xs text-white/48">
                        {event.dateLabel} · {event.city}
                      </p>
                    </div>
                    <span
                      className="rounded-pill px-3 py-1.5 text-xs font-medium text-white"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${event.heroGradient[0]}, ${event.heroGradient[1]})`,
                      }}
                    >
                      +{event.mutualCount}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.26em] text-ink-light">Recommended</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                Ticket-native cards with the important stuff up front
              </h2>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {recommended.map((event, index) => (
              <PublicTicketCard
                key={event.id}
                event={event}
                index={index}
                onClick={() => openEvent(event.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 text-sm font-medium text-white/74">
      {label}
    </div>
  );
}
