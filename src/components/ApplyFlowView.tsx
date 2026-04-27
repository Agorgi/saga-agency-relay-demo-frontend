"use client";

import { motion } from "framer-motion";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAppStore } from "@/store/useAppStore";

const ROLE_TYPES = ["Vendor", "Cosplayer", "Crew", "Co-host"] as const;

export function ApplyFlowView({ eventSlug }: { eventSlug?: string }) {
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const event =
    events.find((item) => item.id === selectedEventId) ||
    (eventSlug ? events.find((item) => item.slug === eventSlug) : undefined);
  const applyDraft = useAppStore((state) => state.applyDraft);
  const setApplyDraft = useAppStore((state) => state.setApplyDraft);
  const submitApplication = useAppStore((state) => state.submitApplication);
  const { openEvent } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  if (!event) return null;

  return (
    <div className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-28 pt-24 md:px-6 md:pb-16 md:pt-28 ${
      isDark ? "text-white" : "text-ink"
    }`}>
      <div className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[0.96fr_1.04fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[30px] p-5 sm:rounded-[34px] sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Be part of the production</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Apply to {event.title}
              </h1>
              <p className={`mt-4 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}>
                Public Apply is a sibling CTA to Get Tickets, and every submission lands directly in the host&apos;s production workspace inbox.
              </p>
            </div>
            <button
              onClick={() => openEvent(event.id)}
              className="brand-button-secondary rounded-pill px-4 py-2 text-sm font-medium"
            >
              Close
            </button>
          </div>

          <div className="mt-7">
            <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Role</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLE_TYPES.map((roleType) => (
                <button
                  key={roleType}
                  onClick={() => setApplyDraft({ roleType })}
                  className={`rounded-pill px-4 py-2 text-sm font-medium ${
                    applyDraft.roleType === roleType
                      ? "brand-button-primary"
                      : isDark
                        ? "brand-chip text-white/72"
                        : "brand-chip text-ink"
                  }`}
                >
                  {roleType}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <FormField
              label={
                applyDraft.roleType === "Vendor"
                  ? "What do you sell?"
                  : applyDraft.roleType === "Cosplayer"
                    ? "What do you perform?"
                    : "What do you contribute?"
              }
              value={applyDraft.contribution}
              onChange={(value) => setApplyDraft({ contribution: value })}
              placeholder="Link your socials, explain the fit, and tell Saga how you show up."
              multiline
              dark={isDark}
            />

            <FormField
              label="Socials / portfolio link"
              value={applyDraft.portfolioUrl}
              onChange={(value) => setApplyDraft({ portfolioUrl: value })}
              placeholder="https://instagram.com/..."
              dark={isDark}
            />

            <FormField
              label="Short note"
              value={applyDraft.note}
              onChange={(value) => setApplyDraft({ note: value })}
              placeholder="Anything the host should know about your availability or setup?"
              multiline
              dark={isDark}
            />

            <label className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 ${
              isDark ? "border-white/10 bg-white/[0.05]" : "border-black/8 bg-white"
            }`}>
              <input
                type="checkbox"
                checked={applyDraft.availabilityConfirmed}
                onChange={(event) => setApplyDraft({ availabilityConfirmed: event.target.checked })}
                className="h-4 w-4 accent-[#687dff]"
              />
              <span className={`text-sm ${isDark ? "text-white/74" : "text-ink"}`}>
                I can commit to the date, call times, and production expectations listed for this event.
              </span>
            </label>
          </div>

          <button
            onClick={() => {
              submitApplication();
              openEvent(event.id);
            }}
            className="brand-button-primary mt-6 w-full rounded-pill px-4 py-3 text-sm font-medium"
          >
            Submit Application
          </button>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className={`space-y-5 rounded-[30px] p-5 sm:rounded-[34px] sm:p-6 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <div className={`rounded-[28px] p-5 ${isDark ? "bg-[linear-gradient(135deg,rgba(255,79,158,0.18),rgba(95,120,255,0.2))]" : "bg-[linear-gradient(135deg,rgba(255,79,158,0.08),rgba(126,164,255,0.16))]"}`}>
            <p className={`text-[10px] uppercase tracking-[0.28em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Why this matters</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Public event and backstage production stay connected.</h2>
            <p className={`mt-4 text-sm leading-6 ${isDark ? "text-white/68" : "text-ink-light"}`}>
              Accepted vendor and cosplay applications show up publicly, while crew and co-host submissions help the host fill the role board and boost launch readiness.
            </p>
          </div>

          <div className={`rounded-[28px] border p-5 ${isDark ? "border-white/8 bg-[#111624]" : "border-black/8 bg-white"}`}>
            <p className={`text-[10px] uppercase tracking-[0.24em] ${isDark ? "text-white/42" : "text-ink-light"}`}>Current vendors & cosplayers</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {event.vendorsAndCosplayers.slice(0, 4).map((participant) => (
                <div key={participant.id} className={`rounded-[22px] p-4 ${isDark ? "bg-white/[0.04]" : "bg-canvas"}`}>
                  <p className={`text-sm font-medium ${isDark ? "text-white/84" : "text-ink"}`}>{participant.name}</p>
                  <p className={`mt-1 text-xs ${isDark ? "text-white/46" : "text-ink-light"}`}>{participant.roleLabel}</p>
                  <p className={`mt-2 text-xs leading-5 ${isDark ? "text-white/54" : "text-ink-light"}`}>{participant.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  dark = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  dark?: boolean;
}) {
  return (
    <label className="block">
      <span className={`text-[10px] uppercase tracking-[0.24em] ${dark ? "text-white/42" : "text-ink-light"}`}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`mt-3 min-h-[130px] w-full rounded-[24px] border px-4 py-4 outline-none ${
            dark
              ? "border-white/10 bg-white/[0.05] text-white placeholder:text-white/28"
              : "border-black/8 bg-white text-ink placeholder:text-ink-light"
          }`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`mt-3 h-14 w-full rounded-[22px] border px-4 outline-none ${
            dark
              ? "border-white/10 bg-white/[0.05] text-white placeholder:text-white/28"
              : "border-black/8 bg-white text-ink placeholder:text-ink-light"
          }`}
        />
      )}
    </label>
  );
}
