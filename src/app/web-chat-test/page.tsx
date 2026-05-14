import { ChatWidget } from "@/components/web-chat/ChatWidget";

export default function WebChatTestPage() {
  return (
    <main className="brand-page min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            Internal demo
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Web Chat Internal Test
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-light">
            This is an internal-only test of the web chat experience. Depending
            on configuration, replies may come from the autonomous engine or
            from a human-review queue.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink-light">
            <li>`mode: autonomous` means the engine replied directly.</li>
            <li>`mode: holding` means the message was logged for later review.</li>
          </ul>
        </div>
        <ChatWidget />
      </div>
    </main>
  );
}
