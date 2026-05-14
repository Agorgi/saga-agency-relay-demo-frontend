import { ChatWidget } from "@/components/web-chat/ChatWidget";

export default function WebChatTestPage() {
  return (
    <main className="brand-page min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">Internal test</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink sm:text-4xl">Web chat widget</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-light">Internal test page for the web chat widget. Stubbed replies for now.</p>
        </div>
        <ChatWidget />
      </div>
    </main>
  );
}
