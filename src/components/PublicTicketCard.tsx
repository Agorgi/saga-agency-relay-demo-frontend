"use client";

import { motion } from "framer-motion";
import type { EventProject, OwnedTicket, TicketTier } from "@/data/sagaPlatformData";
import { useThemeMode } from "@/lib/useThemeMode";

interface PublicTicketCardProps {
  event: EventProject;
  onClick: () => void;
  index?: number;
  mode?: "discovery" | "wallet";
  ticket?: OwnedTicket;
  tier?: TicketTier;
}

export function PublicTicketCard({
  event,
  onClick,
  index = 0,
  mode = "discovery",
  ticket,
  tier,
}: PublicTicketCardProps) {
  const isDark = useThemeMode() === "dark";
  const scarcity = event.ticketTiers.find((entry) => entry.remaining > 0)?.remaining || event.capacity;
  const ticketTier = tier || (ticket ? event.ticketTiers.find((entry) => entry.id === ticket.tierId) : undefined);
  const quantity = ticket?.quantity || 0;
  const isWallet = mode === "wallet";
  const footerLabel = isWallet
    ? ticketTier
      ? `${ticketTier.name} · ${quantity} ticket${quantity > 1 ? "s" : ""}`
      : "Owned ticket"
    : event.ticketTiers.some((entry) => entry.price > 0)
      ? "Tickets on sale"
      : "RSVP open";
  const sideLabel = isWallet ? event.timeLabel : `${scarcity} left`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-[30px] p-2 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
        isDark ? "brand-surface-deep" : "brand-surface-strong"
      }`}
    >
      <div className={`pointer-events-none absolute left-[88px] top-1/2 z-10 hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full sm:block ${isDark ? "bg-[var(--surface-deep)]" : "bg-[var(--app-bg)]"}`} />
      <div className={`pointer-events-none absolute left-[88px] top-1/2 z-10 hidden h-7 w-7 translate-x-[124px] -translate-y-1/2 rounded-full sm:block ${isDark ? "bg-[var(--surface-deep)]" : "bg-[var(--app-bg)]"}`} />

      <div className={`overflow-hidden rounded-[24px] sm:grid sm:grid-cols-[96px_1fr] ${isDark ? "bg-[#f6f4ee] text-[#131722]" : "bg-white text-[#131722]"}`}>
        <div
          className="flex min-h-[108px] flex-col items-center justify-center px-3 py-4 text-center text-white"
          style={{ backgroundImage: `linear-gradient(180deg, ${event.heroGradient[0]}, ${event.heroGradient[1]})` }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em] text-white/70">
            {event.dateLabel.split(" ")[0]}
          </span>
          <span className="mt-2 text-3xl font-semibold leading-none">
            {event.dateLabel.match(/\d+/)?.[0] || "?"}
          </span>
          <span className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/72">
            {sideLabel}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#677082]">
                {isWallet ? "Ticket wallet" : "Public event"}
              </p>
              <h3 className="mt-2 text-[1.7rem] font-semibold leading-[1.02] tracking-tight text-[#141826]">
                {event.title}
              </h3>
              <p className="mt-2 text-sm text-[#596173]">
                {event.timeLabel} · {event.venueName}
              </p>
              <p className="mt-1 text-sm text-[#7f8796]">{event.city}</p>
            </div>
            <span className={`rounded-pill px-3 py-1 text-xs font-medium ${isDark ? "bg-[#eef1ff] text-[#4756d6]" : "brand-chip-signal"}`}>
              {isWallet ? "Saved" : `+${event.mutualCount} mutuals`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-[#dfe3ee] bg-white/75 px-3 py-1.5 text-[11px] font-medium text-[#4c5567]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#d9dde7] pt-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#677082]">
              {footerLabel}
            </span>
            <span className="text-xs font-medium text-[#4756d6] transition-transform duration-200 group-hover:translate-x-0.5">
              Open
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
