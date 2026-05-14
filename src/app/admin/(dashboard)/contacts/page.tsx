import { Plus, Save, Trash2 } from "lucide-react";
import { ContactsImportForm } from "@/components/admin/ContactsImportForm";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import {
  createContactAction,
  deleteContactAction,
  importContactsCsvAction,
  updateContactConversationAutonomyAction,
  updateContactAction,
} from "@/app/admin/(dashboard)/actions";
import {
  conversationAutonomyModeLabel,
  conversationAutonomyModes,
  serializeConversationAutonomySettingForAdmin,
} from "@/lib/conversation/conversationAutonomy";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function ContactsPage() {
  const contacts = await getDb().contact.findMany({
    include: {
      conversationAutonomySettings: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Network
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Contacts</h2>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <form
          action={createContactAction}
          className="rounded-lg border border-zinc-800 bg-black p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Create contact</h3>
            <button className={buttonClass}>
              <Plus aria-hidden className="h-4 w-4" />
              Create
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Name
              <input name="name" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input name="phone" required className={inputClass} />
            </label>
            <label className={labelClass}>
              Email
              <input name="email" type="email" className={inputClass} />
            </label>
            <label className={labelClass}>
              City
              <input name="city" className={inputClass} />
            </label>
            <label className={labelClass}>
              Roles
              <input name="roles" className={inputClass} placeholder="DJ, producer" />
            </label>
            <label className={labelClass}>
              Tags
              <input name="tags" className={inputClass} placeholder="music, nightlife" />
            </label>
            <label className={labelClass}>
              Portfolio
              <input name="portfolioUrl" className={inputClass} />
            </label>
            <label className={labelClass}>
              Instagram
              <input name="instagramUrl" className={inputClass} />
            </label>
          </div>
          <label className={`${labelClass} mt-4`}>
            Notes
            <textarea name="notes" rows={3} className={inputClass} />
          </label>
        </form>

        <ContactsImportForm action={importContactsCsvAction} />
      </section>

      <section className="space-y-4">
        {contacts.map((contact) => {
          const updateAction = updateContactAction.bind(null, contact.id);
          const deleteAction = deleteContactAction.bind(null, contact.id);
          const autonomyAction =
            updateContactConversationAutonomyAction.bind(null, contact.id);
          const autonomy = serializeConversationAutonomySettingForAdmin(
            contact.conversationAutonomySettings[0],
          );

          return (
            <div
              key={contact.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{contact.name}</h3>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {redactPhoneForDisplay(contact.phone)}{" "}
                    {contact.smsOptedOutAt ? "| opted out" : ""}
                  </p>
                </div>
                <form action={deleteAction}>
                  <button className={buttonClass}>
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Delete
                  </button>
                </form>
              </div>
              <form action={updateAction}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className={labelClass}>
                    Name
                    <input
                      name="name"
                      defaultValue={contact.name}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Phone
                    <input
                      name="phone"
                      type="password"
                      autoComplete="off"
                      defaultValue={contact.phone}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Email
                    <input
                      name="email"
                      defaultValue={contact.email || ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    City
                    <input
                      name="city"
                      defaultValue={contact.city || ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Roles
                    <input
                      name="roles"
                      defaultValue={contact.roles.join(", ")}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Tags
                    <input
                      name="tags"
                      defaultValue={contact.tags.join(", ")}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Portfolio
                    <input
                      name="portfolioUrl"
                      defaultValue={contact.portfolioUrl || ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Instagram
                    <input
                      name="instagramUrl"
                      defaultValue={contact.instagramUrl || ""}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className={`${labelClass} mt-4`}>
                  Notes
                  <textarea
                    name="notes"
                    defaultValue={contact.notes || ""}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <div className="mt-4 flex justify-end">
                  <button className={buttonClass}>
                    <Save aria-hidden className="h-4 w-4" />
                    Save contact
                  </button>
                </div>
              </form>
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
                      When ON, Saga can automatically continue normal
                      conversation with this person, but stops before candidate
                      outreach, shortlists, or group chats. This does not
                      override SMS_SENDS_DISABLED, allowlist, opt-out, or
                      compliance gates.
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
            </div>
          );
        })}
        {contacts.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
            No contacts yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
