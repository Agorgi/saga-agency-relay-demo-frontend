# PR-I: Internal Demo

## Inventory

### 1. `find src/app/\(admin\) -maxdepth 4 -type d | sort 2>/dev/null`

```text
src/app/(admin)
src/app/(admin)/admin
src/app/(admin)/admin/(dashboard)
src/app/(admin)/admin/(dashboard)/access
src/app/(admin)/admin/(dashboard)/audit
src/app/(admin)/admin/(dashboard)/beta-simulations
src/app/(admin)/admin/(dashboard)/candidate-graph
src/app/(admin)/admin/(dashboard)/command-center
src/app/(admin)/admin/(dashboard)/contacts
src/app/(admin)/admin/(dashboard)/creator-profiles
src/app/(admin)/admin/(dashboard)/data-ops
src/app/(admin)/admin/(dashboard)/dev
src/app/(admin)/admin/(dashboard)/groupchats
src/app/(admin)/admin/(dashboard)/interest-checks
src/app/(admin)/admin/(dashboard)/launch-drill
src/app/(admin)/admin/(dashboard)/llm-review
src/app/(admin)/admin/(dashboard)/matching
src/app/(admin)/admin/(dashboard)/matching-evaluation
src/app/(admin)/admin/(dashboard)/needs-attention
src/app/(admin)/admin/(dashboard)/network-projects
src/app/(admin)/admin/(dashboard)/network-projects/[id]
src/app/(admin)/admin/(dashboard)/observability
src/app/(admin)/admin/(dashboard)/opportunities
src/app/(admin)/admin/(dashboard)/outbound-drafts
src/app/(admin)/admin/(dashboard)/outreach
src/app/(admin)/admin/(dashboard)/people
src/app/(admin)/admin/(dashboard)/pilot
src/app/(admin)/admin/(dashboard)/pilot-feedback
src/app/(admin)/admin/(dashboard)/pilot-participants
src/app/(admin)/admin/(dashboard)/pipeline
src/app/(admin)/admin/(dashboard)/projects
src/app/(admin)/admin/(dashboard)/projects/[id]
src/app/(admin)/admin/(dashboard)/public-beta
src/app/(admin)/admin/(dashboard)/recommendations
src/app/(admin)/admin/(dashboard)/relationships
src/app/(admin)/admin/(dashboard)/role-openings
src/app/(admin)/admin/(dashboard)/sourcing
src/app/(admin)/admin/(dashboard)/sourcing-quality
src/app/(admin)/admin/(dashboard)/sourcing/public-web
src/app/(admin)/admin/(dashboard)/sourcing/public-web-review
src/app/(admin)/admin/(dashboard)/tasks
src/app/(admin)/admin/(dashboard)/transcript-dry-runs
src/app/(admin)/beta
```

### 2. `ls src/app/\(admin\)/admin 2>/dev/null`

```text
(dashboard)
actions.ts
page.tsx
```

### 3. `cat src/app/\(admin\)/layout.tsx 2>/dev/null | head -60`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saga SMS Producer",
  description: "Public SMS AI producer intake and admin operations dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`admin-root ${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      {children}
    </div>
  );
}
```

### 4. `grep -rE "prisma\.|PrismaClient" src/app/\(admin\) src/lib 2>/dev/null | head -20`

```text
```

### 5. `cat src/components/web-chat/ChatWidget.tsx`

```tsx
"use client";

import { useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatEntry = {
  id: string;
  content: string;
  role: ChatRole;
};

type WebChatResponse = {
  conversationId: string;
  reply: string;
  turn: number;
};

const INITIAL_MESSAGES: ChatEntry[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content: "Stubbed web chat is ready. Send a message to test the endpoint.",
  },
];

export function ChatWidget() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(INITIAL_MESSAGES);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isSending) {
      return;
    }

    const userMessage: ChatEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setError(null);
    setDraft("");
    setIsSending(true);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/web-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | WebChatResponse
        | { error?: string }
        | null;

      if (!response.ok || !data || typeof data !== "object" || !("reply" in data)) {
        setError("Couldn't send - try again.");
        return;
      }

      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${data.turn}`,
          role: "assistant",
          content: data.reply,
        },
      ]);
    } catch {
      setError("Couldn't send - try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="brand-surface-strong rounded-[28px] p-4 shadow-[0_20px_60px_rgba(69,42,149,0.12)] sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--surface-border)] pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            Web chat
          </p>
          <p className="mt-1 text-sm text-ink-light">
            In-memory stub replies only for this test page.
          </p>
        </div>
        <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
          {conversationId ? "Live thread" : "New thread"}
        </span>
      </div>

      <div className="mt-4 space-y-3 rounded-[24px] bg-white/45 p-3 sm:p-4">
        <div className="flex max-h-[420px] min-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((entry) => (
            <div
              key={entry.id}
              className={entry.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  entry.role === "user"
                    ? "max-w-[85%] rounded-[22px] rounded-br-md bg-[color:var(--brand-indigo)] px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_28px_rgba(71,37,255,0.22)]"
                    : "brand-surface-inset max-w-[85%] rounded-[22px] rounded-bl-md px-4 py-3 text-sm leading-6 text-ink"
                }
              >
                {entry.content}
              </div>
            </div>
          ))}

          {isSending ? (
            <div className="flex justify-start">
              <div className="brand-surface-inset rounded-[22px] rounded-bl-md px-4 py-3 text-sm text-ink-light">
                Saga is typing...
              </div>
            </div>
          ) : null}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-ink" htmlFor="web-chat-message">
            Message
          </label>
          <textarea
            id="web-chat-message"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder="Type a message to test the stubbed chat endpoint..."
            disabled={isSending}
            rows={4}
            className="brand-surface-inset min-h-[112px] w-full rounded-[24px] px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-light" aria-live="polite">
              {error ?? "Press Enter to send. Use Shift+Enter for a new line."}
            </p>
            <button
              type="submit"
              disabled={isSending || draft.trim().length === 0}
              className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
```

### 6. `cat src/app/web-chat-test/page.tsx 2>/dev/null`

```tsx
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
```

### 7. `cat src/lib/webChatSessionStore.ts`

```ts
import type { NextRequest } from "next/server";
import { getDb } from "@/sms-engine/db";

export const WEB_SESSION_COOKIE_NAME = "web_session_id";
export const WEB_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type ReplyMode = "autonomous" | "holding";

function normalizedUserAgent(req: NextRequest) {
  const value = req.headers.get("user-agent")?.trim();
  return value ? value.slice(0, 512) : null;
}

export async function getOrCreateSession(req: NextRequest) {
  const db = getDb();
  const cookieSessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  const userAgent = normalizedUserAgent(req);

  if (cookieSessionId) {
    const existing = await db.webSession.findUnique({
      where: { id: cookieSessionId },
    });
    if (existing) {
      const session = await db.webSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          userAgent: existing.userAgent ?? userAgent,
        },
      });
      return { session, isNew: false as const };
    }
  }

  const session = await db.webSession.create({
    data: {
      userAgent,
      ipHash: null,
    },
  });
  return { session, isNew: true as const };
}

export async function appendTurn({
  sessionId,
  conversationId,
  userMessage,
  assistantReply,
  mode,
}: {
  sessionId: string;
  conversationId: string;
  userMessage: string;
  assistantReply: string;
  mode: ReplyMode;
}) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const turn = await tx.webChatMessage.count({
      where: { sessionId, conversationId, role: "assistant" },
    });
    await tx.webChatMessage.createMany({
      data: [
        {
          sessionId,
          conversationId,
          role: "user",
          content: userMessage,
          mode: null,
          turn,
        },
        {
          sessionId,
          conversationId,
          role: "assistant",
          content: assistantReply,
          mode,
          turn,
        },
      ],
    });
    return turn;
  });
}
```

## File Map

### New

- `src/app/(admin)/admin/(dashboard)/web-chat-sessions/page.tsx` — 96 lines
- `src/app/(admin)/admin/(dashboard)/web-chat-sessions/[sessionId]/page.tsx` — 163 lines

### Modified

- `src/components/admin/adminNavigation.ts` — 573 lines
- `src/components/web-chat/ChatWidget.tsx` — 185 lines
- `src/app/web-chat-test/page.tsx` — 28 lines

## Mode Pill

Assistant messages now render a small rounded pill directly under the message bubble:

- `autonomous` uses the existing light surface styling
- `holding` uses a small amber-toned pill so it is visually distinct during demos

## Verification

### Build checks

- `npm run lint` — PASS
- `npm run build` — PASS

### Seeded web chat data

```text
{"conversationId":"4da5c9eb-152b-47fa-a315-407b8a72e085","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
{"conversationId":"693037fe-a6e6-4c27-a0a0-398c88697d54","reply":"Thanks - we've logged your message and will reply soon.","turn":1,"mode":"holding"}
sessionId=cmp5uxv340000lwwc08814j8j
```

### Admin viewer

Authenticated with the existing admin cookie/session mechanism using a temporary local `ADMIN_PASSWORD` for verification only.

```text
/admin/web-chat-sessions 200
/admin/web-chat-sessions/<id> 200
/admin/web-chat-sessions/notreal 404
list-title: Web Chat Sessions
detail-snippet: holding
```

### Route smoke

```text
/ 200
/explore 200
/feed 200
/my-events 200
/post-project 200
/profile 200
/projects 200
/relay 200
/talent 200
/web-chat-test 200
/admin 200
/admin/contacts 307
/beta 200
```

### Test page polish

`/web-chat-test` renders the updated internal-demo copy and mode explanation.

### Secret sweep

```text
OK_AC
OK_SK
```

## Deviations

- The new viewer pages were added under `src/app/(admin)/admin/(dashboard)/web-chat-sessions/**` instead of directly under `src/app/(admin)/admin/web-chat-sessions/**`.
  This preserves the existing `/admin/web-chat-sessions` URL while inheriting the current dashboard auth + shell automatically.
- The admin viewer remains behind the existing admin auth redirect from PR-D.
  This PR intentionally did not add or remove auth behavior.

## TODOs

- Add reply UI from the admin viewer in PR-J.
- Add pagination after the first 50 sessions.
- Add stronger auth/authorization review for the admin surface. This PR intentionally inherits the existing admin gate unchanged.
- Consider cleaning up the legacy stub wording still present inside the widget shell copy once a prompt explicitly allows broader widget text changes.
