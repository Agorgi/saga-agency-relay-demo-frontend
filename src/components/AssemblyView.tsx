"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CREATORS, matchCreatorToQuery } from "@/data/talentData";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useAppStore } from "@/store/useAppStore";

export function AssemblyView({ eventSlug }: { eventSlug?: string }) {
  const events = useAppStore((state) => state.events);
  const selectedEventId = useAppStore((state) => state.selectedEventId);
  const event =
    events.find((item) => item.id === selectedEventId) ||
    (eventSlug ? events.find((item) => item.slug === eventSlug) : undefined);
  const query = useAppStore((state) => state.query);
  const teamSlots = useAppStore((state) => state.teamSlots);
  const assignCreatorToRole = useAppStore((state) => state.assignCreatorToRole);
  const removeCreatorFromRole = useAppStore((state) => state.removeCreatorFromRole);
  const returnToCanvas = useAppStore((state) => state.returnToCanvas);
  const launchProject = useAppStore((state) => state.launchProject);
  const reviewApplication = useAppStore((state) => state.reviewApplication);
  const { openDiscover, openOutreach, openEvent } = useSagaNavigation();

  if (!event) return null;

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 lg:px-8">
      <div className="mx-auto max-w-[1380px] space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_60px_rgba(17,17,17,0.08)] backdrop-blur-xl sm:rounded-[34px] sm:p-7"
        >
          <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr] xl:items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-ink-light">Backstage production</p>
              <h1 className="mt-3 text-[2.2rem] font-semibold tracking-tight text-ink sm:text-5xl">
                {event.title}
              </h1>
              <p className="mt-4 max-w-[720px] text-sm leading-7 text-ink-light">
                Public event and staffing live together here. Ticket demand, venue fit, community applications, and role selection all update the same launch readiness model.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-pill bg-accent/18 px-3 py-1.5 text-xs font-medium text-ink">
                  Launch readiness {event.productionPlan.launchReadiness}%
                </span>
                <span className="rounded-pill bg-canvas px-3 py-1.5 text-xs font-medium text-ink-light">
                  Estimated reach {event.productionPlan.estimatedReach.toLocaleString()}
                </span>
                {/*
                  Removed "Crew is distribution" pill — it sat between
                  concrete metric chips ("Launch readiness 67%",
                  "Estimated reach 12,400") and read as jargon without
                  context. The same phrase remains in the Role board
                  panel below, where it carries a one-line gloss.
                */}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Tickets sold" value={`${event.productionPlan.ticketsSold}`} />
              <MetricCard label="Remaining" value={`${event.productionPlan.remainingTickets}`} />
              <MetricCard label="RSVPs" value={`${event.rsvpCount}`} />
              <MetricCard label="Break-even" value={`${event.productionPlan.breakEven} tickets`} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                returnToCanvas(null);
                openDiscover(event.id);
              }}
              className="rounded-pill bg-[linear-gradient(90deg,#ff4f9e,#687dff)] px-5 py-3 text-sm font-medium text-white"
            >
              Open Talent Canvas
            </button>
            <button
              onClick={() => {
                launchProject();
                openOutreach(event.id);
              }}
              className="rounded-pill bg-ink px-5 py-3 text-sm font-medium text-white"
            >
              Preview Staffing Flow
            </button>
            <button
              onClick={() => openEvent(event.id)}
              className="rounded-pill bg-white px-5 py-3 text-sm font-medium text-ink shadow-sm"
            >
              View Public Event
            </button>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
          <div className="space-y-6">
            <Panel title="Public event preview" eyebrow="Live surface">
              <div className="rounded-[28px] border border-white/60 bg-canvas/82 p-4">
                <div className="flex flex-wrap gap-2">
                  {event.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-pill bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{event.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-light">{event.description}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SummaryPill label="Date" value={`${event.dateLabel} · ${event.timeLabel}`} />
                  <SummaryPill label="Venue" value={event.venueName} />
                </div>
              </div>
            </Panel>

            <Panel title="Demand + venue" eyebrow="Signals">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-canvas/82 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-ink-light">Demand panel</p>
                  <div className="mt-4 space-y-3">
                    <SummaryLine label="Mutuals" value={`+${event.mutualCount}`} />
                    <SummaryLine label="Public applications" value={`${event.applications.length}`} />
                    <SummaryLine label="Budget range" value={event.productionPlan.budgetRange} />
                  </div>
                </div>
                {event.productionPlan.venueRecommendation && (
                  <div className="rounded-[24px] bg-canvas/82 p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-ink-light">Venue recommendation</p>
                    <p className="mt-3 text-xl font-semibold tracking-tight text-ink">
                      {event.productionPlan.venueRecommendation.name}
                    </p>
                    <p className="mt-2 text-sm text-ink-light">
                      {event.productionPlan.venueRecommendation.area} · {event.productionPlan.venueRecommendation.fitScore}% fit
                    </p>
                    <p className="mt-3 text-sm leading-6 text-ink-light">
                      {event.productionPlan.venueRecommendation.note}
                    </p>
                  </div>
                )}
              </div>
            </Panel>

            <Panel title="Applications from the public event" eyebrow="Inbox">
              <div className="space-y-3">
                {event.applications.length ? (
                  event.applications.map((application) => (
                    <div key={application.id} className="rounded-[24px] bg-canvas/82 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-ink">{application.applicantName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-light">
                            {application.roleType}
                          </p>
                        </div>
                        <span className="rounded-pill bg-white px-3 py-1 text-xs font-medium text-ink shadow-sm">
                          {application.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-ink-light">{application.contribution}</p>
                      <p className="mt-2 text-sm leading-6 text-ink-light">{application.note}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => reviewApplication(event.id, application.id, "accepted")}
                          className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-ink"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => reviewApplication(event.id, application.id, "declined")}
                          className="rounded-pill bg-white px-4 py-2 text-sm font-medium text-ink-light"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-ink-light">
                    No applications yet. Public Apply will route vendor, cosplayer, crew, and co-host submissions here.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          <Panel
            title="Role board"
            eyebrow="Crew is distribution"
            description="The crew Saga books is your audience reach — every role doubles as a distribution channel into the fandom they bring."
          >
            <div className="space-y-4">
              {event.productionPlan.roles.map((role) => {
                const assigned = teamSlots[role.name];
                const firstCandidate = role.candidates[0];
                return (
                  <div key={role.id} className="rounded-[26px] border border-white/60 bg-canvas/82 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-semibold tracking-tight text-ink">{role.name}</h3>
                          <span className={`rounded-pill px-3 py-1 text-xs font-medium ${
                            assigned ? "bg-accent/18 text-ink" : "bg-white text-ink-light"
                          }`}>
                            {assigned ? "Confirmed" : role.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-ink-light">
                          {role.rationale}
                        </p>

                        {assigned ? (
                          <div className="mt-4 flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 shadow-sm">
                            <Image
                              src={assigned.imageUrl}
                              alt={assigned.name}
                              width={64}
                              height={72}
                              sizes="64px"
                              className="h-[72px] w-16 rounded-[30%_70%_46%_54%/48%_40%_60%_52%] object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-ink">{assigned.name}</p>
                              <p className="mt-1 text-xs text-ink-light">
                                Fandom fit {role.candidates.find((candidate) => candidate.sourceCreatorId === assigned.id)?.fandomFit || assigned.overallScore}
                                {" · "}
                                Distribution score {role.candidates.find((candidate) => candidate.sourceCreatorId === assigned.id)?.distributionScore || 72}
                              </p>
                              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-light">
                                {assigned.clients.slice(0, 2).join(" · ")}
                              </p>
                            </div>
                            <button
                              onClick={() => removeCreatorFromRole(role.name)}
                              className="rounded-pill bg-canvas px-4 py-2 text-sm font-medium text-ink"
                            >
                              Remove
                            </button>
                          </div>
                        ) : firstCandidate ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-[0.98fr_1.02fr]">
                            <div className="overflow-hidden rounded-[22px] bg-white shadow-sm">
                              <div className="relative h-[180px]">
                                <Image
                                  src={firstCandidate.portfolioImages[0]}
                                  alt={firstCandidate.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, 260px"
                                  className="object-cover"
                                />
                              </div>
                              <div className="p-4">
                                <p className="text-lg font-semibold tracking-tight text-ink">{firstCandidate.name}</p>
                                <p className="mt-2 text-sm leading-6 text-ink-light">{firstCandidate.bio}</p>
                                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                  <MiniMetric label="Budget fit" value={`${firstCandidate.budgetFit}`} />
                                  <MiniMetric label="Fandom fit" value={`${firstCandidate.fandomFit}`} />
                                  <MiniMetric label="Distribution" value={`${firstCandidate.distributionScore}`} />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3 rounded-[22px] bg-white p-4 shadow-sm">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-ink-light">Suggested candidate</p>
                              <p className="text-sm text-ink-light">
                                Audience reach {firstCandidate.audienceReach.toLocaleString()} · {firstCandidate.city}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {firstCandidate.fandomTags.slice(0, 4).map((tag) => (
                                  <span key={tag} className="rounded-pill bg-canvas px-3 py-1.5 text-xs font-medium text-ink-light">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <p className="text-sm leading-6 text-ink-light">
                                {firstCandidate.credits.join(" · ")}
                              </p>
                              <div className="mt-auto flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    const currentCanvasCreator = useAppStore
                                      .getState()
                                      .canvasCreators.find((item) => item.id === firstCandidate.sourceCreatorId);
                                    if (currentCanvasCreator) {
                                      assignCreatorToRole(role.name, currentCanvasCreator);
                                      return;
                                    }

                                    const baseCreator = CREATORS.find((creator) => creator.id === firstCandidate.sourceCreatorId);
                                    if (!baseCreator) return;

                                    assignCreatorToRole(
                                      role.name,
                                      matchCreatorToQuery(
                                        baseCreator,
                                        `${query} ${event.tags.join(" ")} ${role.name}`,
                                        [role.name, ...event.tags]
                                      )
                                    );
                                  }}
                                  className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-ink"
                                >
                                  Add to team
                                </button>
                                <button
                                  onClick={() => {
                                    returnToCanvas(role.name);
                                    openDiscover(event.id, role.name);
                                  }}
                                  className="rounded-pill bg-canvas px-4 py-2 text-sm font-medium text-ink"
                                >
                                  Contact / Replace
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              returnToCanvas(role.name);
                              openDiscover(event.id, role.name);
                            }}
                            className="mt-4 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-ink"
                          >
                            Find talent
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  /**
   * Optional one-line gloss that renders between the title and the
   * panel body. Use this to explain a jargon-y eyebrow on first
   * use (e.g. "Crew is distribution") so users don't have to infer
   * meaning from the pill alone.
   */
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_20px_50px_rgba(17,17,17,0.06)] backdrop-blur-xl"
    >
      <p className="text-[10px] uppercase tracking-[0.26em] text-ink-light">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-ink-light">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-canvas/82 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink-light">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink-light">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/70 pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-ink-light">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-light">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
