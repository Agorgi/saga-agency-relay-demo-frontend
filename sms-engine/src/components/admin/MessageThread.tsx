import type { Message } from "@prisma/client";
import { clsx } from "clsx";
import { RefreshCcw } from "lucide-react";
import { retryMessageAction } from "@/app/admin/(dashboard)/actions";
import { metadataObject } from "@/lib/messages";

export function MessageThread({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 p-6 text-sm text-zinc-500">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-black p-4">
      {messages.map((message) => {
        const metadata = metadataObject(message.metadata);
        const twilioStatus = String(metadata.twilioStatus || "").toLowerCase();
        const sendError =
          metadata.sendError ||
          (["failed", "undelivered"].includes(twilioStatus)
            ? `${metadata.twilioStatus || "failed"} ${
                metadata.twilioErrorCode || ""
              } ${metadata.twilioErrorMessage || ""}`.trim()
            : null);
        const canRetry =
          message.direction === "OUTBOUND" && message.channel === "SMS";

        return (
          <div
            key={message.id}
            className={clsx(
              "flex",
              message.direction === "OUTBOUND"
                ? "justify-end"
                : "justify-start",
            )}
          >
            <div
              className={clsx(
                "max-w-[82%] rounded-2xl px-4 py-2 text-sm leading-6 shadow-sm",
                message.direction === "OUTBOUND"
                  ? "rounded-br-md bg-zinc-100 text-zinc-950"
                  : "rounded-bl-md bg-zinc-900 text-zinc-100",
              )}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              {sendError ? (
                <div className="mt-2 rounded-md border border-red-800 bg-red-950/60 p-2 text-xs text-red-100">
                  <p>Send failed: {String(sendError)}</p>
                  {canRetry ? (
                    <form
                      action={retryMessageAction.bind(null, message.id)}
                      className="mt-2"
                    >
                      <button className="inline-flex items-center gap-1 rounded border border-red-700 px-2 py-1 text-[11px] font-medium text-red-100 transition hover:bg-red-900">
                        <RefreshCcw aria-hidden className="h-3 w-3" />
                        Retry send
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
              <p
                className={clsx(
                  "mt-1 font-mono text-[10px] uppercase",
                  message.direction === "OUTBOUND"
                    ? "text-zinc-500"
                    : "text-zinc-500",
                )}
              >
                {message.channel} | {message.createdAt.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
