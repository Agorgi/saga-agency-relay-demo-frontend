"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAppStore } from "@/store/useAppStore";

export function TicketCheckoutView({ eventSlug }: { eventSlug?: string }) {
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const ticketSelections = useAppStore((state) => state.ticketSelections);
  const updateTicketQuantity = useAppStore((state) => state.updateTicketQuantity);
  const purchaseTickets = useAppStore((state) => state.purchaseTickets);
  const { openEvent, goMyEvents } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const event =
    events.find((item) => item.id === selectedEventId) ||
    (eventSlug ? events.find((item) => item.slug === eventSlug) : undefined);

  const selections = useMemo(() => {
    if (!event) return [];
    return event.ticketTiers.map((tier) => ({
      tier,
      quantity: ticketSelections[`${event.id}:${tier.id}`] || 0,
    }));
  }, [event, ticketSelections]);

  const totalQuantity = selections.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = selections.reduce((sum, item) => sum + item.quantity * item.tier.price, 0);

  if (!event) return null;

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[1120px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[32px] p-5 sm:p-6 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/40" : "text-ink-light"}`}>Get Tickets</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
              <p className={`mt-3 text-sm leading-6 ${isDark ? "text-white/58" : "text-ink-light"}`}>
                Choose a tier, set your quantity, and drop a mock pass into My Events.
              </p>
              <p className={`mt-4 text-sm ${isDark ? "text-white/42" : "text-ink-light"}`}>
                {event.dateLabel} · {event.timeLabel} · {event.venueName}
              </p>
            </div>

            <button
              onClick={() => openEvent(event.id)}
              className="brand-button-secondary rounded-pill px-4 py-2.5 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </motion.section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {selections.map(({ tier, quantity }, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative overflow-hidden rounded-[28px] p-5 ${
                  isDark ? "brand-surface-deep" : "brand-surface-strong"
                }`}
              >
                <div className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-(--app-bg)" />
                <div className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-(--app-bg)" />

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight">{tier.name}</h2>
                      <span className={`rounded-pill px-3 py-1 text-xs font-medium ${
                        isDark ? "bg-[#252c48] text-[#aeb8ff]" : "brand-chip-signal"
                      }`}>
                        {tier.remaining} left
                      </span>
                    </div>
                    <p className={`mt-3 max-w-[480px] text-sm leading-6 ${isDark ? "text-white/58" : "text-ink-light"}`}>{tier.description}</p>
                  </div>
                  <span className="text-3xl font-semibold tracking-tight">
                    {tier.price > 0 ? `$${tier.price}` : "Free"}
                  </span>
                </div>

                <div className={`mt-5 flex items-center justify-between gap-4 border-t border-dashed pt-4 ${
                  isDark ? "border-white/10" : "border-black/10"
                }`}>
                  <div>
                    <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/34" : "text-ink-light"}`}>Max per person</p>
                    <p className={`mt-2 text-sm ${isDark ? "text-white/72" : "text-ink"}`}>{tier.maxPerPerson || 4}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <CounterButton onClick={() => updateTicketQuantity(tier.id, -1)} label={`Decrease ${tier.name}`} dark={isDark} />
                    <span className="w-8 text-center text-lg font-semibold">{quantity}</span>
                    <CounterButton onClick={() => updateTicketQuantity(tier.id, 1)} label={`Increase ${tier.name}`} positive dark={isDark} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-4 lg:sticky lg:top-28 lg:self-start"
          >
            <div className={`rounded-[28px] p-5 ${
              isDark ? "brand-surface-deep" : "brand-surface-strong"
            }`}>
              <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/38" : "text-ink-light"}`}>Checkout summary</p>
              <div className={`mt-5 space-y-3 rounded-[22px] border p-4 ${
                isDark ? "border-white/8 bg-white/[0.03]" : "border-black/8 bg-canvas"
              }`}>
                <SummaryRow label="Event" value={event.title} dark={isDark} />
                <SummaryRow label="Date" value={event.dateLabel} dark={isDark} />
                <SummaryRow label="Venue" value={event.venueName} dark={isDark} />
                <SummaryRow label="Quantity" value={`${totalQuantity}`} dark={isDark} />
              </div>

              <div className={`mt-4 rounded-[24px] border p-4 ${
                isDark
                  ? "border-[#5d68ff]/34 bg-[linear-gradient(135deg,rgba(255,79,158,0.08),rgba(95,120,255,0.16))]"
                  : "border-[#7bc6ff]/28 bg-[linear-gradient(135deg,rgba(255,79,158,0.05),rgba(123,198,255,0.18))]"
              }`}>
                <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Total</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">
                  {totalPrice > 0 ? `$${totalPrice}` : totalQuantity ? "Free" : "$0"}
                </p>
                <p className={`mt-3 text-sm leading-6 ${isDark ? "text-white/56" : "text-ink-light"}`}>
                  Mock purchase only. No real payments or external ticketing provider required.
                </p>
              </div>

              <button
                onClick={() => {
                  purchaseTickets();
                  goMyEvents();
                }}
                disabled={totalQuantity === 0}
                className="brand-button-primary mt-5 w-full rounded-pill px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                {totalQuantity === 0 ? "Select tickets" : `Purchase ${totalQuantity} ticket${totalQuantity > 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.aside>
        </div>
      </div>

      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100vw-1rem)] max-w-[460px] -translate-x-1/2 md:hidden">
        <div className={`rounded-[28px] p-3 ${isDark ? "brand-surface-deep" : "brand-surface-strong"}`}>
          <button
            onClick={() => {
              purchaseTickets();
              goMyEvents();
            }}
            disabled={totalQuantity === 0}
            className="brand-button-primary w-full rounded-pill px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            {totalQuantity === 0 ? "Select tickets" : `Purchase ${totalQuantity} ticket${totalQuantity > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CounterButton({
  onClick,
  label,
  positive = false,
  dark,
}: {
  onClick: () => void;
  label: string;
  positive?: boolean;
  dark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl ${
        positive
          ? dark
            ? "border-[#5d68ff]/34 bg-white/[0.08] text-white"
            : "border-[#7bc6ff]/30 bg-[#edf5ff] text-[#173250]"
          : dark
            ? "border-white/8 bg-white/[0.04] text-white/82"
            : "border-black/8 bg-white text-ink"
      }`}
    >
      {positive ? "+" : "−"}
    </button>
  );
}

function SummaryRow({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0 ${
      dark ? "border-white/8" : "border-black/8"
    }`}>
      <span className={dark ? "text-white/42" : "text-ink-light"}>{label}</span>
      <span className={`text-right font-medium ${dark ? "text-white/78" : "text-ink"}`}>{value}</span>
    </div>
  );
}
