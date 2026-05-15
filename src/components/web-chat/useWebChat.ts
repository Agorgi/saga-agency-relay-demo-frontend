"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizePersona, type Persona } from "@/lib/sagasanPersonas";
import { useSessionPersona, writeSessionPersona } from "@/lib/useSessionPersona";
import { type WebChatNextStep } from "@/lib/webChatNextStep";

export type ChatRole = "user" | "assistant";
export type ChatMode = "autonomous" | "holding";

export type ChatEntry = {
  id: string;
  content: string;
  role: ChatRole;
  mode?: ChatMode;
  nextStep?: WebChatNextStep | null;
};

type WebChatResponse = {
  conversationId: string;
  persona: Persona | null;
  reply: string;
  turn: number;
  mode: ChatMode;
  nextStep?: WebChatNextStep | null;
};

type WebChatHistoryResponse = {
  conversationId: null | string;
  persona: Persona | null;
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
export const CONVERSATION_CACHE_PREFIX = "saga-web-chat-cache:";
export const WEB_CHAT_RESET_EVENT = "saga:web-chat-reset";
export const WEB_CHAT_RESET_REQUEST_KEY = "saga-web-chat-reset-requested";
export const WEB_CHAT_SUPPRESS_RESTORE_KEY = "saga-web-chat-suppress-restore";
export const SAGASAN_DISPLAY_NAME = "Sagasan";
export const SAGASAN_AVATAR_SRC = "/branding/sagasan-contact.png";
export const DEFAULT_CHAT_DESCRIPTION = "";
export const DEFAULT_CHAT_PLACEHOLDER = "Message Sagasan...";
export const DEFAULT_WELCOME_MESSAGE = "";

type CachedConversation = {
  persona: Persona | null;
  messages: ChatEntry[];
};

function conversationCacheKey(conversationId: string) {
  return `${CONVERSATION_CACHE_PREFIX}${conversationId}`;
}

function readConversationCache(conversationId: string): CachedConversation | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(conversationCacheKey(conversationId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedConversation;
    return {
      persona: normalizePersona(parsed.persona),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return null;
  }
}

function persistConversationCache(
  conversationId: string,
  persona: Persona | null,
  messages: ChatEntry[],
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    conversationCacheKey(conversationId),
    JSON.stringify({
      persona,
      messages,
    }),
  );
}

export function requestWebChatReset(nextPersona?: Persona | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  window.sessionStorage.setItem(WEB_CHAT_SUPPRESS_RESTORE_KEY, "1");
  window.sessionStorage.setItem(WEB_CHAT_RESET_REQUEST_KEY, `${Date.now()}`);
  writeSessionPersona(normalizePersona(nextPersona));
  window.dispatchEvent(new CustomEvent(WEB_CHAT_RESET_EVENT));
}

function createInitialMessages(welcomeMessage: string): ChatEntry[] {
  if (!welcomeMessage.trim()) {
    return [];
  }

  return [
    {
      id: "assistant-welcome",
      role: "assistant",
      content: welcomeMessage,
      nextStep: null,
    },
  ];
}

export function useWebChat({
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  fallbackPersona = null,
}: {
  welcomeMessage?: string;
  fallbackPersona?: Persona | null;
} = {}) {
  const { persona, setPersona } = useSessionPersona();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(() =>
    createInitialMessages(welcomeMessage),
  );

  const messagesRef = useRef<ChatEntry[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetChatState = useCallback(() => {
    setConversationId(null);
    setDraft("");
    setError(null);
    setIsSending(false);
    setMessages(createInitialMessages(welcomeMessage));
  }, [welcomeMessage]);

  useEffect(() => {
    if (fallbackPersona && !persona) {
      setPersona(fallbackPersona);
    }
  }, [fallbackPersona, persona, setPersona]);

  useEffect(() => {
    function handleReset() {
      resetChatState();
      setIsRestoring(false);
    }

    window.addEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    };
  }, [resetChatState]);

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
        const restoredPersona = data.persona ?? fallbackPersona ?? null;
        if (restoredPersona) {
          setPersona(restoredPersona);
        }

        if (data.conversationId) {
          window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
          setConversationId(data.conversationId);
        } else {
          window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
          setConversationId(null);
        }

        if (data.messages.length > 0) {
          const restoredMessages = data.messages.map((message, index) => ({
            id: `${message.id}-${message.turn}-${message.role}-${index}`,
            role: message.role,
            content: message.content,
            mode: message.role === "assistant" ? message.mode ?? undefined : undefined,
            nextStep: null,
          })) satisfies ChatEntry[];

          const cached = data.conversationId
            ? readConversationCache(data.conversationId)
            : null;
          const hydratedMessages = restoredMessages.map((message, index) => ({
            ...message,
            nextStep:
              message.role === "assistant" &&
              cached?.messages[index]?.role === "assistant" &&
              cached.messages[index]?.content === message.content
                ? cached.messages[index]?.nextStep ?? null
                : null,
          }));

          setMessages(hydratedMessages);

          if (data.conversationId) {
            persistConversationCache(
              data.conversationId,
              restoredPersona ?? cached?.persona ?? null,
              hydratedMessages,
            );
          }
        } else {
          setMessages(createInitialMessages(welcomeMessage));
        }
      }

      return data.messages.length > 0;
    }

    async function bootstrap() {
      try {
        if (window.sessionStorage.getItem(WEB_CHAT_SUPPRESS_RESTORE_KEY) === "1") {
          if (!cancelled) {
            resetChatState();
          }
          return;
        }

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
          resetChatState();
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
  }, [fallbackPersona, resetChatState, setPersona, welcomeMessage]);

  async function submitCurrentDraft(options?: {
    message?: string;
    persona?: Persona | null;
  }) {
    const message = (options?.message ?? draft).trim();
    if (!message || isSending || isRestoring) {
      return false;
    }

    const nextPersona =
      normalizePersona(options?.persona) ?? persona ?? fallbackPersona;

    const userMessage: ChatEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      nextStep: null,
    };

    const optimisticMessages = [...messagesRef.current, userMessage];

    setError(null);
    setDraft("");
    setIsSending(true);
    setMessages(optimisticMessages);

    try {
      const response = await fetch("/api/web-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message,
          persona: nextPersona,
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

      const resolvedPersona = data.persona ?? nextPersona ?? null;

      window.sessionStorage.removeItem(WEB_CHAT_SUPPRESS_RESTORE_KEY);
      window.sessionStorage.removeItem(WEB_CHAT_RESET_REQUEST_KEY);
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
      if (resolvedPersona) {
        setPersona(resolvedPersona);
      }
      setConversationId(data.conversationId);

      const nextMessages = [
        ...optimisticMessages,
        {
          id: `assistant-${data.turn}-${Date.now()}`,
          role: "assistant" as const,
          content: data.reply,
          mode: data.mode,
          nextStep: data.nextStep ?? null,
        },
      ];

      setMessages(nextMessages);
      persistConversationCache(data.conversationId, resolvedPersona, nextMessages);

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
    persona: persona ?? fallbackPersona,
    setDraft,
    setPersona,
    submitCurrentDraft,
  };
}
