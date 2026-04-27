"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useAppStore } from "@/store/useAppStore";

export function ProjectDetailView({ eventSlug }: { eventSlug?: string }) {
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const viewerProfile = useAppStore((state) => state.viewerProfile);
  const toggleRsvp = useAppStore((state) => state.toggleRsvp);
  const openComposer = useAppStore((state) => state.openComposer);
  const { openTickets, openApply, openWorkspace } = useSagaNavigation();

  const event =
    events.find((item) => item.id === selectedEventId) ||
    (eventSlug ? events.find((item) => item.slug === eventSlug) : undefined);

  if (!event) return null;

  const isRsvped = viewerProfile.attendingEventIds.includes(event.id);
  const lowestRemaining = Math.min(...event.ticketTiers.map((tier) => tier.remaining));
  const pricingLabel = event.ticketTiers.some((tier) => tier.price > 0)
    ? `From $${Math.min(...event.ticketTiers.filter((tier) => tier.price > 0).map((tier) => tier.price))}`
    : "Free RSVP";

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#090d16] px-4 pb-32 pt-24 text-white md:px-6 md:pb-16 md:pt-28">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[32px] border border-white/8 bg-[#0f1420] shadow-[0_32px_90px_rgba(0,0,0,0.38)]"
        >
          <div
            className="relative min-h-[300px] overflow-hidden px-5 pb-6 pt-5 sm:min-h-[420px] sm:px-7 sm:pb-7 sm:pt-6"
            style={{ backgroundImage: `linear-gradient(135deg, ${event.heroGradient[0]}, ${event.heroGradient[1]})` }}
          >
            {event.heroImage ? (
              <Image
                src={event.heroImage}
                alt={event.title}
                fill
                sizes="100vw"
                className="absolute inset-0 object-cover opacity-35 mix-blend-screen"
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,22,0.08),rgba(9,13,22,0.72),rgba(9,13,22,0.95))]" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-10">
              <div className="flex flex-wrap items-center gap-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill border border-white/12 bg-black/18 px-3 py-1.5 text-[11px] font-medium text-white/82"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-end">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-white/46">Public event</p>
                  <h1 className="mt-3 max-w-[760px] text-[2.3rem] font-semibold leading-[0.94] tracking-tight sm:text-6xl">
                    {event.title}
                  </h1>
                  <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/72">
                    <span>{event.dateLabel}</span>
                    <span className="text-white/28">•</span>
                    <span>{event.timeLabel}</span>
                    <span className="text-white/28">•</span>
                    <span>{event.venueName}</span>
                    <span className="text-white/28">•</span>
                    <span>{event.city}</span>
                  </div>
                  <p className="mt-5 max-w-[700px] text-sm leading-7 text-white/68 sm:text-base">
                    {event.longDescription || event.description}
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#0c111c]/74 p-4 backdrop-blur-xl">
                  <StatRow label="Tickets" value={`${lowestRemaining} left`} />
                  <StatRow label="Mutuals" value={`+${event.mutualCount}`} />
                  <StatRow label="RSVPs" value={`${event.rsvpCount}`} />
                  <StatRow label="Pricing" value={pricingLabel} />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <DarkSection title="About" eyebrow="Event details">
              <p className="text-sm leading-7 text-white/68">{event.description}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DetailCard label="Date" value={event.dateLabel} />
                <DetailCard label="Time" value={event.timeLabel} />
                <DetailCard label="Venue" value={event.venueName} />
                <DetailCard label="Status" value={event.status} />
              </div>
            </DarkSection>

            <DarkSection title="Guest list" eyebrow="People going">
              <div className="flex flex-wrap gap-3">
                {event.guestList.map((guest) => (
                  <div key={guest.id} className="flex items-center gap-3 rounded-[22px] bg-white/[0.04] px-4 py-3">
                    <div className="relative h-11 w-11 overflow-hidden rounded-full bg-white/8">
                      {guest.avatar ? (
                        <Image src={guest.avatar} alt={guest.name} fill sizes="44px" className="object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/84">{guest.name}</p>
                      <p className="text-xs text-white/42">{guest.handle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DarkSection>

            <DarkSection
              title="Vendors & Cosplayers"
              eyebrow="Be part of the production"
              action={
                <OutlineButton onClick={() => openApply(event.id)} label="Apply" />
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {event.vendorsAndCosplayers.map((participant) => (
                  <div key={participant.id} className="rounded-[24px] bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 overflow-hidden rounded-full bg-white/8">
                        {participant.avatar ? (
                          <Image src={participant.avatar} alt={participant.name} fill sizes="56px" className="object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/84">{participant.name}</p>
                        <p className="mt-1 text-xs text-white/42">{participant.roleLabel}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/58">{participant.tag || participant.note}</p>
                  </div>
                ))}
              </div>
            </DarkSection>

            <DarkSection
              title="Posts"
              eyebrow="Community layer"
              action={
                <OutlineButton onClick={() => openComposer(event.id)} label="New Post" />
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {event.posts.map((post) => (
                  <div key={post.id} className="overflow-hidden rounded-[24px] bg-white/[0.04]">
                    <div className="relative aspect-[0.95]">
                      <Image
                        src={post.imageUrl}
                        alt={post.caption}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-white/84">{post.authorName}</p>
                      <p className="mt-3 text-sm leading-6 text-white/62">{post.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </DarkSection>
          </div>

          <div className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <DarkSection title="Get Tickets" eyebrow="Tickets, tailored" compact>
              <div className="space-y-3">
                {event.ticketTiers.map((tier) => (
                  <div key={tier.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-white">{tier.name}</p>
                        <p className="mt-1 text-sm leading-6 text-white/54">{tier.description}</p>
                      </div>
                      <span className="rounded-pill bg-[#252c48] px-3 py-1 text-xs font-medium text-[#aeb8ff]">
                        {tier.remaining} left
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <span className="text-2xl font-semibold tracking-tight text-white">
                        {tier.price > 0 ? `$${tier.price}` : "Free"}
                      </span>
                      <span className="text-xs uppercase tracking-[0.22em] text-white/34">
                        Max {tier.maxPerPerson || 4}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                <PrimaryButton onClick={() => openTickets(event.id)} label="Get Tickets" />
                <OutlineButton onClick={() => openApply(event.id)} label="Apply" fullWidth />
                <button
                  onClick={() => toggleRsvp(event.id)}
                  className="w-full rounded-pill border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/74"
                >
                  {isRsvped ? "RSVP'd" : "RSVP"}
                </button>
              </div>
            </DarkSection>

            <DarkSection title="Backstage production" eyebrow="Host demo" compact>
              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <StatRow label="Launch readiness" value={`${event.productionPlan.launchReadiness}%`} />
                <StatRow label="Estimated reach" value={event.productionPlan.estimatedReach.toLocaleString()} />
                <StatRow label="Tickets sold" value={`${event.productionPlan.ticketsSold}`} />
                <StatRow label="Applications" value={`${event.applications.length}`} />
              </div>
              <p className="mt-4 text-sm leading-6 text-white/58">
                Crew is distribution. Ticket demand, mutuals, and public applications all feed the staffing view.
              </p>
              <div className="mt-5">
                <PrimaryButton onClick={() => openWorkspace(event.id)} label="Open Production Workspace" />
              </div>
            </DarkSection>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100vw-1rem)] max-w-[460px] -translate-x-1/2 md:hidden">
        <div className="rounded-[28px] border border-white/8 bg-[#111624]/92 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <PrimaryButton onClick={() => openTickets(event.id)} label="Get Tickets" />
        </div>
      </div>
    </div>
  );
}

function DarkSection({
  eyebrow,
  title,
  children,
  action,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[30px] border border-white/8 bg-[#111624]/88 shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${compact ? "p-5" : "p-5 sm:p-6"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/36">{label}</p>
      <p className="mt-2 text-sm font-medium text-white/76">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-white/42">{label}</span>
      <span className="font-medium text-white/84">{value}</span>
    </div>
  );
}

function PrimaryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_40px_rgba(95,120,255,0.24)]"
    >
      {label}
    </button>
  );
}

function OutlineButton({
  onClick,
  label,
  fullWidth = false,
}: {
  onClick: () => void;
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border border-[#5d68ff]/42 bg-transparent px-4 py-2.5 text-sm font-medium text-white ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {label}
    </button>
  );
}
