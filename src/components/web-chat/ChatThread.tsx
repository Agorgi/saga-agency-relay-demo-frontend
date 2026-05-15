"use client";

import { buildNextStepHref, type WebChatNextStep } from "@/lib/webChatNextStep";
import type { ChatEntry } from "@/components/web-chat/useWebChat";

export function ChatThread({
  messages,
  isSending,
  onNextStep,
}: {
  messages: ChatEntry[];
  isSending: boolean;
  onNextStep?: (nextStep: WebChatNextStep) => void;
}) {
  return (
    <>
      {messages.map((entry) => (
        <div
          key={entry.id}
          data-chat-entry={entry.role}
          className={entry.role === "user" ? "flex justify-end" : "flex justify-start"}
        >
          <div className="max-w-[82%] space-y-2">
            <div
              data-chat-message={entry.role}
              className={
                entry.role === "user"
                  ? "rounded-[22px] rounded-br-md bg-[linear-gradient(135deg,#5f45ff,#6ea4ff)] px-4 py-2.5 text-left text-[14px] leading-6 text-white shadow-[0_14px_28px_rgba(71,37,255,0.22)]"
                  : "rounded-[22px] rounded-bl-md border border-white/65 bg-white/88 px-4 py-2.5 text-left text-[14px] leading-6 text-ink shadow-[0_10px_20px_rgba(58,35,123,0.08)]"
              }
            >
              <div>{entry.content}</div>
            </div>

            {entry.role === "assistant" && entry.nextStep ? (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => onNextStep?.(entry.nextStep as WebChatNextStep)}
                  data-next-step-href={buildNextStepHref(entry.nextStep)}
                  className="brand-button-primary rounded-pill px-4 py-2 text-sm font-medium"
                >
                  {entry.nextStep.label}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {isSending ? (
        <div className="flex justify-start">
          <div className="max-w-[82%] rounded-[22px] rounded-bl-md border border-white/65 bg-white/88 px-4 py-2.5 text-left text-[14px] text-ink-light shadow-[0_10px_20px_rgba(58,35,123,0.08)]">
            Sagasan is typing…
          </div>
        </div>
      ) : null}
    </>
  );
}
