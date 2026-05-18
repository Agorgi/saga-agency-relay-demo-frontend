"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApprovalState = "idle" | "pending" | "error";

/**
 * Client island for the outreach-page "Approve all drafts" button.
 *
 * POSTs to /api/projects/[id]/outreach/approve with action="approve_all"
 * and refreshes the page on success so the server-rendered view
 * re-loads with the post-approval state (status pills flipped,
 * journey CTA switched to the gated "Send outreach" form). Surfaces
 * a pending state during the request and an error if the call fails.
 *
 * This is the only interactive piece on /projects/[id]/outreach in
 * v1 — the rest of the page is server-rendered.
 */
export function OutreachApproveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ApprovalState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setState("pending");
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/outreach/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve_all" }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
      }
      router.refresh();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "unknown error");
    }
  }

  const isPending = state === "pending";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        data-project-id={projectId}
        data-action="approve_all"
        className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isPending ? "Approving…" : "Approve all drafts"}
      </button>
      <p className="text-xs text-zinc-500">
        Approval queues the drafts for sending. Sending itself is held
        until Saga&apos;s A2P approval and Twilio kill switch are lifted.
      </p>
      {error ? (
        <p className="text-xs text-rose-700" role="alert">
          Couldn&apos;t approve drafts: {error}. Try again.
        </p>
      ) : null}
    </div>
  );
}
