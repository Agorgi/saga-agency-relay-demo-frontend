import Link from "next/link";
import { createPilotFeedbackAction } from "@/app/(admin)/admin/(dashboard)/actions";
import {
  adminContactLabel,
  redactPhoneForDisplay,
  redactSensitiveTextForDisplay,
} from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import {
  normalizePilotFeedbackCategory,
  PILOT_FEEDBACK_CATEGORIES,
} from "@/sms-engine/pilotReadiness";
import { briefTitle } from "@/sms-engine/workflow";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function PilotFeedbackPage() {
  const db = getDb();
  const [feedback, projectBriefs, people, participants] = await Promise.all([
    db.pilotFeedback.findMany({
      include: {
        projectBrief: { include: { user: true } },
        person: true,
        pilotParticipant: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.projectBrief.findMany({
      include: { user: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.person.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.pilotParticipant.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Design partner pilot
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Pilot feedback</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Private admin-only notes from design-partner rehearsals and operator
          review. Do not use this for production Saga app data.
        </p>
      </div>

      <form
        action={createPilotFeedbackAction}
        className="rounded-lg border border-zinc-800 bg-black p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Project brief
            <select name="projectBriefId" className={inputClass} defaultValue="">
              <option value="">No project link</option>
              {projectBriefs.map((project) => (
                <option key={project.id} value={project.id}>
                  {briefTitle(project)} | {redactPhoneForDisplay(project.user.phone)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Person
            <select name="personId" className={inputClass} defaultValue="">
              <option value="">No person link</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {adminContactLabel({
                    name: person.name,
                    phone: person.phone,
                    email: person.email,
                    fallback: person.id,
                  })}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Pilot participant
            <select
              name="pilotParticipantId"
              className={inputClass}
              defaultValue=""
            >
              <option value="">No participant link</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name ||
                    participant.redactedPhone ||
                    participant.id}{" "}
                  | {participant.role} | {participant.status}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Category
            <select name="category" defaultValue="other" className={inputClass}>
              {PILOT_FEEDBACK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Rating
            <select name="rating" className={inputClass} defaultValue="">
              <option value="">None</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
        </div>
        <label className={`${labelClass} mt-4`}>
          Notes
          <textarea
            name="notes"
            required
            rows={4}
            className={inputClass}
            placeholder="Capture private pilot feedback..."
          />
        </label>
        <button className={`${buttonClass} mt-4`}>Add feedback</button>
      </form>

      <section className="space-y-3">
        {feedback.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {item.category}
                  {normalizePilotFeedbackCategory(item.category) !==
                  item.category
                    ? " / other"
                    : ""}
                </p>
                <h3 className="mt-1 text-base font-semibold">
                  {item.projectBrief ? (
                    <Link
                      href={`/admin/projects/${item.projectBrief.id}`}
                      className="hover:text-white"
                    >
                      {briefTitle(item.projectBrief)}
                    </Link>
                  ) : (
                    "General pilot note"
                  )}
                </h3>
              </div>
              <span className="text-xs text-zinc-500">
                {item.rating ? `${item.rating}/5` : "unrated"} |{" "}
                {item.createdAt.toLocaleString()}
              </span>
            </div>
            {item.person ? (
              <p className="mt-2 text-xs text-zinc-500">
                Person: {item.person.name || item.person.id}
              </p>
            ) : null}
            {item.pilotParticipant ? (
              <p className="mt-2 text-xs text-zinc-500">
                Participant:{" "}
                {item.pilotParticipant.name ||
                  item.pilotParticipant.redactedPhone ||
                  item.pilotParticipant.id}{" "}
                | {item.pilotParticipant.role} | {item.pilotParticipant.status}
              </p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
              {redactSensitiveTextForDisplay(item.notes)}
            </p>
          </article>
        ))}
        {feedback.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-black p-8 text-center text-sm text-zinc-500">
            No pilot feedback captured yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
