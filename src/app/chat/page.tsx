import { ChatWidget } from "@/components/web-chat/ChatWidget";

export default function ChatPage() {
  return (
    <main className="brand-page min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            Talk to Saga
          </p>
          <h1
            data-copy-lint="header"
            className="mt-2 text-3xl font-medium tracking-tight text-ink sm:text-4xl"
          >
            Start with Sagasan.
          </h1>
          <p
            data-copy-lint="subhead"
            className="mt-3 max-w-2xl text-sm leading-6 text-ink-light"
          >
            One turn at once.
          </p>
        </div>
        <ChatWidget />
      </div>
    </main>
  );
}
