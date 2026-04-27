"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useAppStore } from "@/store/useAppStore";

const EVENT_TYPES = [
  "Cup sleeve",
  "Cosplay meetup",
  "Art market",
  "Rave",
  "Screening",
  "Panel",
  "Photo walk",
  "Mini convention",
];

const STEP_LABELS = ["Basics", "Format & Audience", "Venue & Tickets", "Production Team"];
const ROLE_OPTIONS = [
  "Producer",
  "Photographer",
  "Videographer",
  "Social Manager",
  "Stylist",
  "DJ / Host",
  "Vendor Lead",
  "Volunteer Lead",
  "Cosplay Guest",
];

export function CreateProjectFlow() {
  const draftEvent = useAppStore((state) => state.draftEvent);
  const updateDraftEvent = useAppStore((state) => state.updateDraftEvent);
  const toggleDraftRole = useAppStore((state) => state.toggleDraftRole);
  const submitDraftEvent = useAppStore((state) => state.submitDraftEvent);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const { goHome, openWorkspace } = useSagaNavigation();
  const [step, setStep] = useState(0);

  const previewTags = useMemo(
    () =>
      draftEvent.audienceTags
        .split(/[,\n]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5),
    [draftEvent.audienceTags]
  );

  const canContinue =
    step === 0
      ? Boolean(draftEvent.title.trim() && draftEvent.description.trim() && draftEvent.city.trim())
      : step === 1
        ? Boolean(draftEvent.eventType && draftEvent.expectedAttendance.trim() && draftEvent.vibeNotes.trim())
        : step === 2
          ? Boolean(draftEvent.dateLabel.trim() && draftEvent.timeLabel.trim() && draftEvent.capacity.trim())
          : Boolean(draftEvent.budgetRange.trim() && draftEvent.requiredRoles.length);

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-28 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
      <div className="mx-auto grid max-w-[1380px] gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[30px] border border-white/10 bg-[#0f1420]/92 p-5 text-white shadow-[0_32px_80px_rgba(6,10,18,0.4)] backdrop-blur-xl sm:rounded-[34px] sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/48">Create Event</p>
              <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight sm:text-4xl">
                Turn an idea into a public event and a staffed production workspace.
              </h1>
              <p className="mt-4 max-w-[680px] text-sm leading-7 text-white/64">
                Idea to event, not idea to empty form. Build the public page, ticket setup,
                staffing priorities, and application flow in one pass.
              </p>
            </div>
            <button
              onClick={() => {
                if (selectedEventId) openWorkspace(selectedEventId);
                else goHome();
              }}
              className="rounded-pill border border-white/10 bg-white/8 px-4 py-2 text-sm font-medium text-white/78"
            >
              Close
            </button>
          </div>

          <div className="mt-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {STEP_LABELS.map((label, index) => (
              <div key={label} className="flex items-center gap-2 whitespace-nowrap">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium ${
                    index === step
                      ? "bg-[linear-gradient(90deg,#ff4f9e,#687dff)] text-white"
                      : index < step
                        ? "bg-white text-[#111827]"
                        : "bg-white/10 text-white/52"
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-white/78">{label}</span>
                {index < STEP_LABELS.length - 1 && <div className="h-px w-8 bg-white/10" />}
              </div>
            ))}
          </div>

          <div className="mt-8">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Event name"
                  placeholder="Court of Stars"
                  value={draftEvent.title}
                  onChange={(value) => updateDraftEvent({ title: value })}
                />
                <Field
                  label="Fandom / category"
                  placeholder="Love and Deepspace x Masquerade"
                  value={draftEvent.fandomCategory}
                  onChange={(value) => updateDraftEvent({ fandomCategory: value })}
                />
                <Field
                  label="City"
                  placeholder="Pasadena, CA"
                  value={draftEvent.city}
                  onChange={(value) => updateDraftEvent({ city: value })}
                />
                <Field
                  label="Expected attendance"
                  placeholder="250"
                  value={draftEvent.expectedAttendance}
                  onChange={(value) => updateDraftEvent({ expectedAttendance: value })}
                />
                <div className="md:col-span-2">
                  <TextArea
                    label="Description"
                    placeholder="Give the public page a strong one-paragraph event summary."
                    value={draftEvent.description}
                    onChange={(value) => updateDraftEvent({ description: value })}
                    minHeight="180px"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Event type</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EVENT_TYPES.map((type) => {
                        const active = draftEvent.eventType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => updateDraftEvent({ eventType: type })}
                            className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
                              active
                                ? "bg-[linear-gradient(90deg,#ff4f9e,#687dff)] text-white"
                                : "bg-white/8 text-white/72"
                            }`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <TextArea
                    label="Vibe / reference notes"
                    placeholder="What should the event feel like? What fandom energy, visuals, and references matter?"
                    value={draftEvent.vibeNotes}
                    onChange={(value) => updateDraftEvent({ vibeNotes: value })}
                    minHeight="220px"
                  />
                </div>

                <div className="space-y-4">
                  <TextArea
                    label="Audience / fandom tags"
                    placeholder="anime, mecha, cup sleeve, cosplay, streetwear"
                    value={draftEvent.audienceTags}
                    onChange={(value) => updateDraftEvent({ audienceTags: value })}
                    minHeight="120px"
                  />
                  <div className="rounded-[26px] border border-white/10 bg-white/6 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Live audience tags</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewTags.length ? (
                        previewTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-pill border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/78"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-white/45">Your tags will shape the public page and fandom-fit scoring.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Date"
                  placeholder="Jul 18 - 19"
                  value={draftEvent.dateLabel}
                  onChange={(value) => updateDraftEvent({ dateLabel: value })}
                />
                <Field
                  label="Time"
                  placeholder="7:30 PM"
                  value={draftEvent.timeLabel}
                  onChange={(value) => updateDraftEvent({ timeLabel: value })}
                />
                <Field
                  label="Venue preference"
                  placeholder="Castle venue, cafe buyout, warehouse hold"
                  value={draftEvent.venuePreference}
                  onChange={(value) => updateDraftEvent({ venuePreference: value })}
                />
                <Field
                  label="Capacity"
                  placeholder="250"
                  value={draftEvent.capacity}
                  onChange={(value) => updateDraftEvent({ capacity: value })}
                />
                <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
                  <ToggleCard
                    title="Paid event"
                    description="Sell public tickets and use demand to guide staffing."
                    active={draftEvent.isPaid}
                    onClick={() => updateDraftEvent({ isPaid: true })}
                  />
                  <ToggleCard
                    title="Free / RSVP"
                    description="Use RSVP and mutuals as your demand signal."
                    active={!draftEvent.isPaid}
                    onClick={() => updateDraftEvent({ isPaid: false })}
                  />
                  <div className="rounded-[26px] border border-white/10 bg-white/6 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Ticket tiers</p>
                    <div className="mt-3 space-y-3">
                      <Field
                        label="General"
                        placeholder="18"
                        value={draftEvent.generalTicketPrice}
                        onChange={(value) => updateDraftEvent({ generalTicketPrice: value })}
                        compact
                      />
                      <Field
                        label="VIP"
                        placeholder="45"
                        value={draftEvent.vipTicketPrice}
                        onChange={(value) => updateDraftEvent({ vipTicketPrice: value })}
                        compact
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-[1.02fr_0.98fr]">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Required roles</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ROLE_OPTIONS.map((role) => {
                        const active = draftEvent.requiredRoles.includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => toggleDraftRole(role)}
                            className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
                              active
                                ? "bg-[linear-gradient(90deg,#ff4f9e,#687dff)] text-white"
                                : "bg-white/8 text-white/72"
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Field
                    label="Budget range"
                    placeholder="$12K - $24K"
                    value={draftEvent.budgetRange}
                    onChange={(value) => updateDraftEvent({ budgetRange: value })}
                  />
                  <TextArea
                    label="Staffing priorities"
                    placeholder="What do you need Saga to solve first?"
                    value={draftEvent.staffingPriorities}
                    onChange={(value) => updateDraftEvent({ staffingPriorities: value })}
                    minHeight="160px"
                  />
                </div>

                <div className="space-y-4">
                  <ToggleCard
                    title="Public applications on"
                    description="Let vendors, cosplayers, crew, and co-hosts apply from the public page."
                    active={draftEvent.allowPublicApplications}
                    onClick={() =>
                      updateDraftEvent({ allowPublicApplications: !draftEvent.allowPublicApplications })
                    }
                  />
                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">What happens next</p>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-white/72">
                      <p>1. Saga creates the public event page and ticket setup.</p>
                      <p>2. Production workspace opens with demand, venue, roles, and applicant inbox.</p>
                      <p>3. Recommended candidates are scored for budget fit, fandom fit, and distribution score.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="rounded-pill border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-medium text-white/72 disabled:opacity-40"
              disabled={step === 0}
            >
              Back
            </button>
            {step < STEP_LABELS.length - 1 ? (
              <button
                onClick={() => canContinue && setStep((current) => current + 1)}
                disabled={!canContinue}
                className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(95,120,255,0.3)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => {
                  submitDraftEvent();
                  const nextEventId = useAppStore.getState().selectedEventId;
                  if (nextEventId) openWorkspace(nextEventId);
                }}
                disabled={!canContinue}
                className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_40px_rgba(95,120,255,0.3)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Open Production Workspace
              </button>
            )}
          </div>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-5 rounded-[30px] border border-white/60 bg-white/76 p-5 shadow-[0_24px_60px_rgba(17,17,17,0.08)] backdrop-blur-xl sm:rounded-[34px] sm:p-6"
        >
          <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,rgba(15,20,32,0.96),rgba(37,45,72,0.88),rgba(255,79,158,0.24))] p-5 text-white">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Public event preview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {draftEvent.title || "Untitled Saga Event"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {draftEvent.description || "Your public page will preview here as you build the event."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {(previewTags.length ? previewTags : [draftEvent.eventType, draftEvent.city]).slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/78"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PreviewMetric label="Date" value={draftEvent.dateLabel || "TBD"} />
              <PreviewMetric label="Venue" value={draftEvent.venuePreference || draftEvent.city || "Scouting"} />
              <PreviewMetric label="Capacity" value={draftEvent.capacity || "150"} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <PreviewCard
              label="Ticketing"
              title={draftEvent.isPaid ? `GA $${draftEvent.generalTicketPrice || "18"} / VIP $${draftEvent.vipTicketPrice || "45"}` : "Free RSVP + optional supporter tier"}
              body="Public ticket demand flows directly into staffing and launch readiness."
            />
            <PreviewCard
              label="Backstage production"
              title={`${draftEvent.requiredRoles.length || 0} priority roles`}
              body="Crew is distribution. Saga scores every candidate for fandom fit, budget fit, and audience reach."
            />
            <PreviewCard
              label="Applications"
              title={draftEvent.allowPublicApplications ? "Vendor / Cosplayer / Crew / Co-host" : "Applications off"}
              body="Public Apply and production inbox stay attached to the same event object."
            />
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-3 w-full rounded-[22px] border border-white/10 bg-white/8 px-4 text-white outline-none placeholder:text-white/28 ${
          compact ? "h-12" : "h-14"
        }`}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  placeholder,
  onChange,
  minHeight,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ minHeight }}
        className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/8 px-4 py-4 text-white outline-none placeholder:text-white/28"
      />
    </label>
  );
}

function ToggleCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[26px] border p-4 text-left transition-colors ${
        active ? "border-white/20 bg-white/10" : "border-white/10 bg-white/6"
      }`}
    >
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
    </button>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white/8 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-medium text-white/82">{value}</p>
    </div>
  );
}

function PreviewCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/60 bg-white/86 p-5 shadow-[0_18px_40px_rgba(17,17,17,0.05)]">
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink-light">{label}</p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink-light">{body}</p>
    </div>
  );
}
