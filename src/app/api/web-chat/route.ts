type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ConversationState = {
  messages: ChatMessage[];
};

const conversations = new Map<string, ConversationState>();

const STUB_REPLIES = [
  "Got it.",
  "Tell me more.",
  "Interesting - and what happened next?",
];

export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const { message, conversationId: rawConversationId } = body as {
    conversationId?: unknown;
    message?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return json({ error: "Message must be a non-empty string." }, { status: 400 });
  }

  const conversationId =
    typeof rawConversationId === "string" && rawConversationId.trim().length > 0
      ? rawConversationId.trim()
      : crypto.randomUUID();

  const state = conversations.get(conversationId) ?? { messages: [] };
  const assistantTurn = state.messages.filter((entry) => entry.role === "assistant").length;
  const reply = STUB_REPLIES[assistantTurn % STUB_REPLIES.length];

  state.messages.push(
    { role: "user", content: message.trim() },
    { role: "assistant", content: reply },
  );
  conversations.set(conversationId, state);

  return json({
    conversationId,
    reply,
    turn: assistantTurn,
  });
}
