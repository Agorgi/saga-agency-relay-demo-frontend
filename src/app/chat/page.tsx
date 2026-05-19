import { ChatWidget } from "@/components/web-chat/ChatWidget";
import { SagaShell } from "@/components/saga/SagaShell";

export default function ChatPage() {
  return (
    <SagaShell state="CHAT">
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.24em]"
            style={{ color: "var(--saga-fg-tertiary)" }}
          >
            Talk to Saga
          </p>
          <h1
            data-copy-lint="header"
            className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl"
            style={{ color: "var(--saga-fg-primary)" }}
          >
            Start with Sagasan.
          </h1>
          <p
            data-copy-lint="subhead"
            className="mt-3 max-w-2xl text-sm leading-6"
            style={{ color: "var(--saga-fg-secondary)" }}
          >
            One turn at once.
          </p>
        </div>
        <ChatWidget />
      </main>
    </SagaShell>
  );
}
