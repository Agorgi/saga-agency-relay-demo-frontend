"use client";

import { Clipboard } from "lucide-react";

export function DemoSummaryButton({ summary }: { summary: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(summary)}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
    >
      <Clipboard aria-hidden className="h-4 w-4" />
      Copy demo summary
    </button>
  );
}
