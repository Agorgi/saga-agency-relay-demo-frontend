"use client";

import { useEffect, useState } from "react";

export type ChatRole = "user" | "assistant";
export type ChatMode = "autonomous" | "holding";

export type ChatEntry = {
  id: string;
  content: string;
  role: ChatRole;
  mode?: ChatMode;
};

type WebChatResponse = {
  conversationId: string;
  reply: string;
  turn: number;
  mode: ChatMode;
};

type WebChatHistoryResponse = {
  conversationId: null | string;
  messages: Array<{
    id: string;
    role: ChatRole;
    content: string;
    mode: ChatMode | null;
    turn: number;
    createdAt: string;
  }>;
};

export const CONVERSATION_STORAGE_KEY = "saga-web-chat-conversation-id";
export const DEFAULT_CHAT_DESCRIPTION =
  "Tell Saga what you're producing, where it's happening, and the creative help you need.";
export const DEFAULT_CHAT_PLACEHOLDER =
  "Tell Saga what you're making, where it's happening, and the kind of help you need...";
export const DEFAULT_WELCOME_MESSAGE =
  "Hi - I'm Saga. Tell me what you're producing, where it's happening, and the kind of creative help you need.";

function createInitialMessages(welcomeMessage: string): ChatEntry[] {
  return [
    {
      id: "assistant-welcome",
      role: "assistant",
      content: welcomeMessage,
    },
  ];
}

export function useWebChat({
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
}: {
  welcomeMessage?: string;
} = {}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(() =>
    createInitialMessages(welcomeMessage),
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreConversation(preferredConversationId?: string | null) {
      const query = preferredConversationId
        ? `?conversationId=${encodeURIComponent(preferredConversationId)}`
        : "";
      const response = await fetch(`/api/web-chat${query}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | WebChatHistoryResponse
        | null;

      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.messages)
      ) {
        return false;
      }

      if (!cancelled) {
        if (data.conversationId) {
          window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
          setConversationId(data.conversationId);
        } else {
          window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
          setConversationId(null);
        }

        if (data.messages.length > 0) {
          setMessages(
            data.messages.map((message, index) => ({
              id: `${message.id}-${message.turn}-${message.role}-${index}`,
              role: message.role,
              content: message.content,
              mode: message.role === "assistant" ? message.mode ?? undefined : undefined,
            })),
          );
        } else {
          setMessages(createInitialMessages(welcomeMessage));
        }
      }

      return data.messages.length > 0;
    }

    async function bootstrap() {
      try {
        const storedConversationId = window.localStorage.getItem(
          CONVERSATION_STORAGE_KEY,
        );
        const restoredStoredThread = storedConversationId
          ? await restoreConversation(storedConversationId)
          : false;

        if (!restoredStoredThread) {
          await restoreConversation();
        }
      } catch {
        if (!cancelled) {
          setMessages(createInitialMessages(welcomeMessage));
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [welcomeMessage]);

  async function submitCurrentDraft() {
    const message = draft.trim();
    if (!message || isSending || isRestoring) {
      return false;
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
        return false;
      }

      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${data.turn}-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          mode: data.mode,
        },
      ]);

      return true;
    } catch {
      setError("Couldn't send - try again.");
      return false;
    } finally {
      setIsSending(false);
    }
  }

  return {
    conversationId,
    draft,
    error,
    isRestoring,
    isSending,
    messages,
    setDraft,
    submitCurrentDraft,
  };
}
