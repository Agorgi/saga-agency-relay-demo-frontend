"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizePersona, type Persona } from "@/lib/sagasanPersonas";
import { useSessionPersona, writeSessionPersona } from "@/lib/useSessionPersona";
import {
  clearPendingNextStep,
  persistPendingNextStep,
  readPendingNextStep,
  sanitizeNextStepPayload,
  type WebChatNextStep,
} from "@/lib/webChatNextStep";

export type ChatRole = "user" | "assistant";
export type ChatMode = "autonomous" | "holding";

export type ChatEntry = {
  id: string;
  content: string;
  role: ChatRole;
  mode?: ChatMode;
  persona?: Persona | null;
  nextStep?: WebChatNextStep | null;
};

type WebChatResponse = {
  conversationId: string;
  persona: Persona | null;
  reply: string;
  turn: number;
  mode: ChatMode;
  selectedReplySource?: string | null;
  fallbackReason?: string | null;
  nextStep?: WebChatNextStep | null;
};

type WebChatHistoryResponse = {
  conversationId: null | string;
  persona: Persona | null;
  messages: Array<{
    id: string;
    role: ChatRole;
    content: string;
    persona: Persona | null;
    mode: ChatMode | null;
    nextStep: WebChatNextStep | null;
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

function isChatMode(value: unknown): value is ChatMode {
  return value === "autonomous" || value === "holding";
}

function extractReplyText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeChatEntry(entry: ChatEntry): ChatEntry {
  return {
    id: entry.id,
    role: entry.role,
    content: extractReplyText(entry.content) ?? "",
    persona: normalizePersona(entry.persona),
    mode: entry.role === "assistant" && isChatMode(entry.mode) ? entry.mode : undefined,
    nextStep:
      entry.role === "assistant" ? sanitizeNextStepPayload(entry.nextStep) : null,
  };
}

function extractConversationId(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;

  const conversationId =
    typeof record.conversationId === "string" && record.conversationId.trim().length > 0
      ? record.conversationId
      : typeof nested?.conversationId === "string" &&
          nested.conversationId.trim().length > 0
        ? nested.conversationId
        : null;

  return conversationId;
}

export function isUiChatFallbackReply(value: unknown) {
  return typeof value === "string" && /lost that turn for a second/i.test(value);
}

function getPersonaFromNextStep(nextStep: WebChatNextStep | null | undefined) {
  if (!nextStep) {
    return null;
  }

  if (nextStep.route === "/projects/new") {
    return "host" satisfies Persona;
  }

  if (nextStep.route === "/me") {
    return "creative" satisfies Persona;
  }

  if (nextStep.route === "/spaces") {
    return "venue" satisfies Persona;
  }

  if (nextStep.route === "/feed") {
    return "fan" satisfies Persona;
  }

  return null;
}

function getLatestAssistantNextStep(messages: ChatEntry[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.nextStep)?.nextStep;
}

function getLatestConversationPersona(messages: ChatEntry[]) {
  const latestMessagePersona = [...messages]
    .reverse()
    .map((message) => normalizePersona(message.persona))
    .find(Boolean);

  return latestMessagePersona ?? getPersonaFromNextStep(getLatestAssistantNextStep(messages));
}

function pickBestAssistantContent(
  restoredContent: string | null,
  cachedContent: string | null,
) {
  if (restoredContent && !isUiChatFallbackReply(restoredContent)) {
    return restoredContent;
  }

  if (cachedContent && !isUiChatFallbackReply(cachedContent)) {
    return cachedContent;
  }

  return restoredContent ?? cachedContent ?? "";
}

export function mergeRestoredMessages({
  restoredMessages,
  cachedMessages,
  pendingNextStep,
}: {
  restoredMessages: ChatEntry[];
  cachedMessages: ChatEntry[];
  pendingNextStep?: WebChatNextStep | null;
}) {
  const merged = restoredMessages.map((message, index) => {
    const cached = cachedMessages[index];
    const normalizedCached =
      cached && cached.role === message.role ? normalizeChatEntry(cached) : null;
    const restoredContent = extractReplyText(message.content);
    const cachedContent = extractReplyText(normalizedCached?.content);

    return {
      ...message,
      content:
        message.role === "assistant"
          ? pickBestAssistantContent(restoredContent, cachedContent)
          : restoredContent ?? cachedContent ?? "",
      persona: normalizePersona(message.persona) ?? normalizedCached?.persona ?? null,
      mode:
        message.role === "assistant"
          ? message.mode ?? normalizedCached?.mode
          : undefined,
      nextStep:
        message.role === "assistant"
          ? sanitizeNextStepPayload(message.nextStep) ??
            sanitizeNextStepPayload(normalizedCached?.nextStep) ??
            null
          : null,
    } satisfies ChatEntry;
  });

  const latestAssistantIndex = [...merged]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === "assistant")?.index;

  if (latestAssistantIndex === undefined || !pendingNextStep) {
    return merged;
  }

  const existingNextStep = merged[latestAssistantIndex]?.nextStep ?? null;
  if (existingNextStep) {
    return merged;
  }

  const conversationPersona = getLatestConversationPersona(merged);
  const pendingPersona = getPersonaFromNextStep(pendingNextStep);
  if (conversationPersona && pendingPersona && conversationPersona !== pendingPersona) {
    return merged;
  }

  const nextMessages = [...merged];
  nextMessages[latestAssistantIndex] = {
    ...nextMessages[latestAssistantIndex],
    nextStep: pendingNextStep,
    persona:
      nextMessages[latestAssistantIndex]?.persona ??
      pendingPersona ??
      conversationPersona,
  };
  return nextMessages;
}

export function parseWebChatHistoryResponse(value: unknown): WebChatHistoryResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return null;
  }

  const messages = record.messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const entry = message as Record<string, unknown>;
      const role = entry.role === "assistant" ? "assistant" : entry.role === "user" ? "user" : null;
      const content =
        extractReplyText(entry.content) ||
        extractReplyText(entry.reply) ||
        extractReplyText(entry.message);
      const turn = typeof entry.turn === "number" ? entry.turn : null;
      const createdAt =
        typeof entry.createdAt === "string" && entry.createdAt.trim().length > 0
          ? entry.createdAt
          : null;

      if (!role || !content || turn === null || !createdAt) {
        return null;
      }

      return {
        id:
          typeof entry.id === "string" && entry.id.trim().length > 0
            ? entry.id
            : `${role}-${turn}-${createdAt}`,
        role,
        content,
        persona:
          typeof entry.persona === "string"
            ? normalizePersona(entry.persona)
            : null,
        mode:
          role === "assistant" && isChatMode(entry.mode)
            ? entry.mode
            : null,
        nextStep:
          role === "assistant" ? sanitizeNextStepPayload(entry.nextStep) : null,
        turn,
        createdAt,
      };
    })
    .filter((message): message is WebChatHistoryResponse["messages"][number] => Boolean(message));

  return {
    conversationId:
      typeof record.conversationId === "string" && record.conversationId.trim().length > 0
        ? record.conversationId
        : null,
    persona:
      typeof record.persona === "string"
        ? normalizePersona(record.persona)
        : null,
    messages,
  };
}

export function resolveRestoredPersona({
  responsePersona,
  cachedPersona,
  mergedMessages,
  fallbackPersona,
}: {
  responsePersona: Persona | null;
  cachedPersona: Persona | null;
  mergedMessages: ChatEntry[];
  fallbackPersona: Persona | null;
}) {
  return (
    responsePersona ??
    getLatestConversationPersona(mergedMessages) ??
    cachedPersona ??
    fallbackPersona ??
    null
  );
}

export function parseWebChatResponse(value: unknown): WebChatResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;

  const conversationId =
    typeof record.conversationId === "string" && record.conversationId.trim().length > 0
      ? record.conversationId
      : typeof nested?.conversationId === "string" &&
          nested.conversationId.trim().length > 0
        ? nested.conversationId
        : null;
  const reply =
    extractReplyText(record.reply) ||
    extractReplyText(record.message) ||
    extractReplyText(nested?.reply) ||
    extractReplyText(nested?.message);
  const turnCandidate = typeof record.turn === "number" ? record.turn : nested?.turn;
  const modeCandidate = record.mode ?? nested?.mode;
  const nextStepCandidate = record.nextStep ?? nested?.nextStep;
  const personaCandidate = record.persona ?? nested?.persona;

  if (!conversationId || !reply || typeof turnCandidate !== "number") {
    return null;
  }

  return {
    conversationId,
    persona:
      typeof personaCandidate === "string"
        ? normalizePersona(personaCandidate)
        : null,
    reply,
    turn: turnCandidate,
    mode: isChatMode(modeCandidate) ? modeCandidate : "holding",
    nextStep: sanitizeNextStepPayload(nextStepCandidate),
  };
}

function getUiChatFallbackReply(persona: Persona | null) {
  if (persona === "host") {
    return "Got it. I lost that turn for a second — what city should I anchor this in?";
  }
  if (persona === "creative") {
    return "Got it — I lost that turn for a second. What city are you based in?";
  }
  if (persona === "venue") {
    return "Got it — I lost that turn for a second. What city is the space in?";
  }
  if (persona === "fan") {
    return "Got it. I lost that turn for a second — what city should I look around?";
  }
  return "Got it. I lost that turn for a second — are you here as a host, creative, venue, or fan?";
}

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
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((message) => normalizeChatEntry(message))
        : [],
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
      messages: messages.map((message) => normalizeChatEntry(message)),
    }),
  );
}

export function requestWebChatReset(nextPersona?: Persona | null) {
  if (typeof window === "undefined") {
    return;
  }

  clearPendingNextStep();
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
      persona: null,
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
  const isActiveRef = useRef(true);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

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

  const applyRestoredConversation = useCallback(
    (data: WebChatHistoryResponse) => {
      if (!isActiveRef.current) {
        return false;
      }

      const cached = data.conversationId
        ? readConversationCache(data.conversationId)
        : null;
      const pendingNextStep = readPendingNextStep();
      const restoredMessages = data.messages.map((message, index) => ({
        id: `${message.id}-${message.turn}-${message.role}-${index}`,
        role: message.role,
        content: message.content,
        persona: message.persona,
        mode: message.role === "assistant" ? message.mode ?? undefined : undefined,
        nextStep: message.role === "assistant" ? message.nextStep ?? null : null,
      })) satisfies ChatEntry[];
      const mergedMessages =
        data.messages.length > 0
          ? mergeRestoredMessages({
              restoredMessages,
              cachedMessages: cached?.messages ?? [],
              pendingNextStep,
            })
          : createInitialMessages(welcomeMessage);
      const restoredPersona = resolveRestoredPersona({
        responsePersona: data.persona,
        cachedPersona: cached?.persona ?? null,
        mergedMessages,
        fallbackPersona,
      });

      setError(null);
      setPersona(restoredPersona);

      if (data.conversationId) {
        window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
        setConversationId(data.conversationId);
      } else {
        window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
        setConversationId(null);
      }

      if (data.messages.length > 0) {
        const latestNextStep = getLatestAssistantNextStep(mergedMessages);
        if (latestNextStep) {
          persistPendingNextStep(latestNextStep);
        } else {
          clearPendingNextStep();
        }

        setMessages(mergedMessages);

        if (data.conversationId) {
          persistConversationCache(data.conversationId, restoredPersona, mergedMessages);
        }
      } else {
        clearPendingNextStep();
        setMessages(createInitialMessages(welcomeMessage));
      }

      return data.messages.length > 0;
    },
    [fallbackPersona, setPersona, welcomeMessage],
  );

  const restoreConversation = useCallback(
    async (preferredConversationId?: string | null) => {
      const query = preferredConversationId
        ? `?conversationId=${encodeURIComponent(preferredConversationId)}`
        : "";
      const response = await fetch(`/api/web-chat${query}`, {
        cache: "no-store",
      });
      const data = parseWebChatHistoryResponse(
        await response.json().catch(() => null),
      );

      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.messages)
      ) {
        return false;
      }

      return applyRestoredConversation(data);
    },
    [applyRestoredConversation],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (window.sessionStorage.getItem(WEB_CHAT_SUPPRESS_RESTORE_KEY) === "1") {
          if (!cancelled && isActiveRef.current) {
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
        if (!cancelled && isActiveRef.current) {
          resetChatState();
        }
      } finally {
        if (!cancelled && isActiveRef.current) {
          setIsRestoring(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [resetChatState, restoreConversation]);

  async function submitCurrentDraft(options?: {
    message?: string;
    persona?: Persona | null;
  }) {
    const message = (options?.message ?? draft).trim();
    if (!message || isSending || isRestoring) {
      return false;
    }

    const requestedPersona = normalizePersona(options?.persona);
    const nextPersona = requestedPersona ?? persona ?? fallbackPersona;
    const uiFallbackReply = getUiChatFallbackReply(nextPersona ?? null);

    if (requestedPersona && requestedPersona !== persona) {
      clearPendingNextStep();
    }

    const userMessage: ChatEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      persona: nextPersona ?? null,
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
          persona: requestedPersona,
          personaHint: requestedPersona,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | { error?: string }
        | null;
      const parsed = parseWebChatResponse(data);
      const responseConversationId = extractConversationId(data);

      if (!response.ok || !parsed) {
        const recovered = await restoreConversation(responseConversationId ?? conversationId);
        if (recovered) {
          setError(null);
          return true;
        }

        setError(uiFallbackReply);
        setMessages([
          ...optimisticMessages,
          {
            id: `assistant-ui-fallback-${Date.now()}`,
            role: "assistant",
            content: uiFallbackReply,
            persona: nextPersona ?? null,
            mode: "holding",
            nextStep: null,
          },
        ]);
        return false;
      }

      const resolvedPersona = parsed.persona ?? nextPersona ?? null;

      window.sessionStorage.removeItem(WEB_CHAT_SUPPRESS_RESTORE_KEY);
      window.sessionStorage.removeItem(WEB_CHAT_RESET_REQUEST_KEY);
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, parsed.conversationId);
      setPersona(resolvedPersona);
      setConversationId(parsed.conversationId);

      const nextMessages = [
        ...optimisticMessages,
        {
          id: `assistant-${parsed.turn}-${Date.now()}`,
          role: "assistant" as const,
          content: parsed.reply,
          persona: resolvedPersona,
          mode: parsed.mode,
          nextStep: parsed.nextStep ?? null,
        },
      ];

      setError(null);
      setMessages(nextMessages);
      if (parsed.nextStep) {
        persistPendingNextStep(parsed.nextStep);
      } else {
        clearPendingNextStep();
      }
      persistConversationCache(parsed.conversationId, resolvedPersona, nextMessages);

      return true;
    } catch {
      const recovered = await restoreConversation(conversationId);
      if (recovered) {
        setError(null);
        return true;
      }

      setError(uiFallbackReply);
      setMessages([
        ...optimisticMessages,
        {
          id: `assistant-ui-fallback-${Date.now()}`,
          role: "assistant",
          content: uiFallbackReply,
          persona: nextPersona ?? null,
          mode: "holding",
          nextStep: null,
        },
      ]);
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
