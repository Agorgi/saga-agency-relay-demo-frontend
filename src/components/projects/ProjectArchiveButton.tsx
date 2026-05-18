"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ArchiveState = "idle" | "confirming" | "pending" | "error";

/**
 * Client island for the brief-review "Discard and start over" button.
 *
 * POSTs to /api/projects/[id]/archive. On success, redirects to /chat
 * — the server-side archive helper has already cleared the cookie
 * session's project binding, so the next chat turn opens a fresh
 * brief intake instead of editing the archived project.
 *
 * UX:
 *   1. First click flips the button into a "confirming" state with a
 *      destructive label. A second click runs the archive.
 *   2. While pending, the button shows a spinner-style label.
 *   3. On error, surfaces the message under the button so the user
 *      knows the archive didn't land. They can retry.
 *
 * This is the only destructive control on /projects/[id], so it
 * intentionally requires two clicks. The action is reversible at
 * the data level (Project + journey rows persist; only journey.step
 * flips to archived), but the user-visible effect — "this project
 * disappears from /projects and I start fresh" — should not happen
 * by accident.
 */
export function ProjectArchiveButton({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ArchiveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function performArchive() {
    setState("pending");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body?.error || `HTTP ${response.status}`);
      }
      // Server cleared WebSession.projectId; sending the user to /chat
      // gives them a fresh intake surface.
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "unknown error");
    }
  }

  function onClick() {
    if (state === "idle" || state === "error") {
      setState("confirming");
      return;
    }
    if (state === "confirming") {
      void performArchive();
    }
  }

  function onCancel() {
    setState("idle");
    setError(null);
  }

  const label =
    state === "pending"
      ? "Discarding…"
      : state === "confirming"
        ? "Yes, discard and start over"
        : "Discard this brief and start over";

  const isPending = state === "pending";
  const isConfirming = state === "confirming";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={isPending}
          data-project-id={projectId}
          data-action="archive"
          data-archive-state={state}
          className={
            isConfirming
              ? "inline-flex items-center justify-center rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              : "inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {label}
        </button>
        {isConfirming ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {isConfirming ? (
        <p className="text-xs text-zinc-500">
          The brief, roles, and any candidates stay in your history. You&apos;ll
          land back in chat to start fresh.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-700" role="alert">
          Couldn&apos;t discard the brief: {error}. Try again.
        </p>
      ) : null}
    </div>
  );
}
