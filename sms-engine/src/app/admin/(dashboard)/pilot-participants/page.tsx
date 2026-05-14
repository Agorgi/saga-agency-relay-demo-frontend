import Link from "next/link";
import { Save } from "lucide-react";
import {
  createPilotParticipantAction,
  updatePilotParticipantConversationAutonomyAction,
} from "@/app/admin/(dashboard)/actions";
import {
  adminContactLabel,
  redactPhoneForDisplay,
  redactSensitiveTextForDisplay,
} from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import {
  conversationAutonomyModeLabel,
  conversationAutonomyModes,
  serializeConversationAutonomySettingForAdmin,
} from "@/sms-engine/conversation/conversationAutonomy";
import {
  PILOT_COHORTS,
  pilotParticipantRoleOptions,
  pilotParticipantStatusOptions,
} from "@/sms-engine/pilotReadiness";
import { briefTitle } from "@/sms-engine/workflow";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function PilotParticipantsPage() {
  const db = getDb();
  const [participants, people, projectBriefs] = await Promise.all([
    db.pilotParticipant.findMany({
      include: {
        person: true,
        projectBrief: { include: { user: true } },
        conversationAutonomySettings: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    db.person.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.projectBrief.findMany({
      include: { user: true },
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
        <h2 className="mt-2 text-2xl font-semibold">Pilot participants</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Admin-only list for future invite-only design-partner and private beta
          testing. Raw phone numbers are not stored here; use a hash and
          redacted display only.
        </p>
      </div>

      <form
        action={createPilotParticipantAction}
        className="rounded-lg border border-zinc-800 bg-black p-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Name
            <input
              name="name"
              className={inputClass}
              placeholder="Optional display name"
            />
          </label>
          <label className={labelClass}>
            Phone for hash/redaction only
            <input
              name="phone"
              className={inputClass}
              placeholder="+15551234567"
            />
          </label>
          <label className={labelClass}>
            Email
            <input
              name="email"
              className={inputClass}
              placeholder="Optional; admin-only"
            />
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
            Role
            <select name="role" className={inputClass} defaultValue="INTERNAL_TEST">
              {pilotParticipantRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Cohort
            <select name="cohort" className={inputClass} defaultValue="internal">
              {PILOT_COHORTS.map((cohort) => (
                <option key={cohort} value={cohort}>
                  {cohort.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Status
            <select name="status" className={inputClass} defaultValue="INVITED">
              {pilotParticipantStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Consent source
            <input
              name="consentSource"
              className={inputClass}
              placeholder="Private invite, email, call, etc."
            />
          </label>
          <label className={labelClass}>
            Consent timestamp
            <input name="consentTimestamp" type="datetime-local" className={inputClass} />
          </label>
        </div>
        <label className={`${labelClass} mt-4`}>
          Notes
          <textarea
            name="notes"
            rows={3}
            className={inputClass}
            placeholder="Admin-only pilot notes. Do not store production Saga app data."
          />
        </label>
        <button className={`${buttonClass} mt-4`}>Add participant</button>
      </form>

      <section className="space-y-3">
        {participants.map((participant) => {
          const autonomy =
            serializeConversationAutonomySettingForAdmin(
              participant.conversationAutonomySettings[0],
            );
          const autonomyAction =
            updatePilotParticipantConversationAutonomyAction.bind(
              null,
              participant.id,
            );

          return (
            <article
              key={participant.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {participant.cohort} | {participant.role} | {participant.status}
                </p>
                <h3 className="mt-1 text-base font-semibold">
                  {participant.name ||
                    participant.redactedPhone ||
                    participant.person?.name ||
                    participant.id}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Phone: {participant.redactedPhone || "[not provided]"}
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {participant.updatedAt.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
              <p>Consent: {participant.consentTimestamp ? "recorded" : "not recorded"}</p>
              <p>Source: {participant.consentSource || "none"}</p>
              {participant.person ? (
                <p>Person: {participant.person.name || participant.person.id}</p>
              ) : null}
              {participant.projectBrief ? (
                <p>
                  Project:{" "}
                  <Link
                    href={`/admin/projects/${participant.projectBrief.id}`}
                    className="text-zinc-300 hover:text-white"
                  >
                    {briefTitle(participant.projectBrief)}
                  </Link>
                </p>
              ) : null}
            </div>
            {participant.notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                {redactSensitiveTextForDisplay(participant.notes)}
              </p>
            ) : null}
            {participant.phoneHash && participant.redactedPhone ? (
              <form
                action={autonomyAction}
                className="mt-4 rounded-md border border-zinc-900 bg-zinc-950/60 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">
                      Autonomous SMS replies
                    </h4>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                      ON lets Saga continue normal conversation only. It stops
                      before candidate outreach, shortlists, group chats, or
                      external actions, and it never overrides SMS safety gates.
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                    {autonomy.label}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,260px)_1fr_auto]">
                  <label className={labelClass}>
                    Mode
                    <select
                      name="mode"
                      defaultValue={autonomy.mode}
                      className={inputClass}
                    >
                      {conversationAutonomyModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {conversationAutonomyModeLabel(mode)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Reason
                    <input
                      name="reason"
                      defaultValue={autonomy.reason || ""}
                      className={inputClass}
                      placeholder="Optional admin-only reason"
                    />
                  </label>
                  <div className="flex items-end">
                    <button className={buttonClass}>
                      <Save aria-hidden className="h-4 w-4" />
                      Save autonomy
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="mt-4 rounded-md border border-zinc-900 bg-zinc-950/60 p-3 text-xs text-zinc-500">
                Add a phone hash/redacted phone before setting autonomy for this
                pilot participant.
              </p>
            )}
          </article>
          );
        })}
        {participants.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-black p-8 text-center text-sm text-zinc-500">
            No pilot participants captured yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
