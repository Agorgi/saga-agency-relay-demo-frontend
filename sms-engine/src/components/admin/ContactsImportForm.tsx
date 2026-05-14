"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { parseContactCsv } from "@/sms-engine/contactCsv";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40";

export function ContactsImportForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [csv, setCsv] = useState("");
  const parsed = useMemo(() => parseContactCsv(csv), [csv]);
  const hasInput = csv.trim().length > 0;
  const hasErrors = hasInput && parsed.errors.length > 0;

  return (
    <form action={action} className="rounded-lg border border-zinc-800 bg-black p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Import CSV</h3>
          {hasInput ? (
            <p className="mt-1 text-xs text-zinc-500">
              {parsed.contacts.length} valid rows
            </p>
          ) : null}
        </div>
        <button className={buttonClass} disabled={!hasInput || hasErrors}>
          <Upload aria-hidden className="h-4 w-4" />
          Import
        </button>
      </div>
      <textarea
        name="csv"
        rows={12}
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        className={`${inputClass} font-mono text-xs`}
        placeholder={`name,phone,email,city,roles,tags,portfolioUrl,instagramUrl,notes
Maya,+14155550111,maya@example.com,Los Angeles,"photographer,content","events,photo",https://example.com,,Notes`}
      />
      {hasErrors ? (
        <div className="mt-3 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-100">
          {parsed.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
    </form>
  );
}
