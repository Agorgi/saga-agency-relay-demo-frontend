import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getDb } from "@/sms-engine/db";
import type { Persona } from "@/lib/sagasanPersonas";
import type {
  OrganizerBudgetStatus,
  OrganizerReadinessStage,
  OrganizerReferenceStatus,
} from "@/lib/sagasanOrganizerIntake";
import type { WebChatNextStep } from "@/lib/webChatNextStep";

export const WEB_SESSION_COOKIE_NAME = "web_session_id";
export const WEB_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type ReplyMode = "autonomous" | "holding";
type ChatRole = "user" | "assistant";
type ProviderState =
  | "openai_not_called_gate_closed"
  | "openai_not_called_mode_mock"
  | "openai_not_called_missing_key"
  | "openai_called_succeeded"
  | "openai_called_failed"
  | "openai_called_validation_failed";

type MemorySession = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  userAgent: string | null;
  ipHash: string | null;
  persona: Persona | null;
  // In-memory sessions never own DB-persisted projects (there's no
  // DB). The field is always null; it exists so the type unifies
  // with the Prisma WebSession shape and downstream code (e.g.
  // projectAuth) can treat both consistently.
  projectId: string | null;
};

type MemoryStoredMessage = StoredWebChatMessage & {
  sessionId: string;
  conversationId: string;
};

type AssistantRuntimeSnapshot = Pick<
  StoredWebChatMessage,
  | "mode"
  | "providerState"
  | "fallbackReason"
  | "selectedReplySource"
  | "model"
  | "configuredMode"
  | "effectiveMode"
> & {
  createdAt: Date;
};

const memorySessions = new Map<string, MemorySession>();
const memoryMessages: MemoryStoredMessage[] = [];
let webChatLegacyDbMode = false;

const LEGACY_WEB_CHAT_SCHEMA_MARKERS = [
  "WebSession.persona",
  "column `persona` does not exist",
  "WebChatMessage.persona",
  "WebChatMessage.route",
  "WebChatMessage.nextStep",
  "WebChatMessage.extractedFields",
  "WebChatMessage.selectedReplySource",
  "WebChatMessage.fallbackReason",
  "WebChatMessage.providerState",
  "WebChatMessage.configuredMode",
  "WebChatMessage.effectiveMode",
  "The column `route` does not exist",
  "The column `nextStep` does not exist",
  "The column `extractedFields` does not exist",
  "The column `selectedReplySource` does not exist",
  "The column `fallbackReason` does not exist",
  "The column `providerState` does not exist",
  "The column `configuredMode` does not exist",
  "The column `effectiveMode` does not exist",
];

export type StoredExtractedFields = {
  persona: Persona | null;
  city: string | null;
  neighborhood: string | null;
  dateWindow: string | null;
  roles: string[];
  vibeTags: string[];
  venueType: string | null;
  projectIdea: string | null;
  interests: string[];
  portfolio: string | null;
  availability: string | null;
  rates: string | null;
  scale: string | null;
  scopeFormat: string | null;
  themeVibe: string | null;
  lineupStatus: string | null;
  helpNeeded: string | null;
  budget: string | null;
  budgetStatus: OrganizerBudgetStatus | null;
  inspirationStatus: OrganizerReferenceStatus | null;
  inspirationReferences: string[];
  userRole: string | null;
  userIdentity: string | null;
  organization: string | null;
  socials: string[];
  audience: string | null;
  ticketingModel: string | null;
  safetyFlags: string[];
  urgency: string | null;
  desiredTalentRoles: string[];
  readinessStage: OrganizerReadinessStage | null;
  missingRequiredFields: string[];
  missingImportantFields: string[];
  nextRoute: string | null;
};

export type StoredWebChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  mode: ReplyMode | null;
  persona: Persona | null;
  route: string | null;
  nextStep: WebChatNextStep | null;
  extractedFields: StoredExtractedFields | null;
  selectedReplySource: string | null;
  fallbackReason: string | null;
  providerState: ProviderState | null;
  model: string | null;
  configuredMode: string | null;
  effectiveMode: string | null;
  operation: string | null;
  turn: number;
  createdAt: string;
};

type AssistantTurnMeta = {
  persona: Persona | null;
  route: string | null;
  nextStep: WebChatNextStep | null;
  extractedFields: StoredExtractedFields | null;
  selectedReplySource: string | null;
  fallbackReason: string | null;
  providerState: ProviderState | null;
  model: string | null;
  configuredMode: string | null;
  effectiveMode: string | null;
  operation: string | null;
};

function normalizedUserAgent(req: NextRequest) {
  const value = req.headers.get("user-agent")?.trim();
  return value ? value.slice(0, 512) : null;
}

function inLegacyDbMode() {
  return hasWebChatDatabase() && webChatLegacyDbMode;
}

function isRecoverableLegacySchemaError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) &&
    !(error instanceof Prisma.PrismaClientUnknownRequestError)
  ) {
    return false;
  }

  const message = error.message || "";
  return LEGACY_WEB_CHAT_SCHEMA_MARKERS.some((marker) => message.includes(marker));
}

function activateLegacyDbMode(error: unknown) {
  if (!isRecoverableLegacySchemaError(error)) {
    return false;
  }

  if (!webChatLegacyDbMode) {
    console.warn("Web chat metadata columns are unavailable; using legacy DB mode.");
  }
  webChatLegacyDbMode = true;
  return true;
}

export function __setLegacyWebChatDbModeForTests(value: boolean | null) {
  webChatLegacyDbMode = value === true;
}

function withNullPersona<
  T extends {
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
    userAgent: string | null;
    ipHash: string | null;
  },
>(session: T) {
  return {
    ...session,
    persona: null as Persona | null,
    // Legacy DB mode predates the projectId column. Default to null
    // so the returned shape unifies with the modern WebSession +
    // MemorySession variants; projectAuth treats this as
    // "no project owned by this session" which is correct — a
    // legacy session can't own a tracer-flow Project.
    projectId: null as string | null,
  };
}

async function getOrCreateLegacyDbSession(req: NextRequest) {
  const db = getDb();
  const cookieSessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  const userAgent = normalizedUserAgent(req);

  if (cookieSessionId) {
    const existing = await db.webSession.findUnique({
      where: { id: cookieSessionId },
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        userAgent: true,
        ipHash: true,
      },
    });
    if (existing) {
      const session = await db.webSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          userAgent: existing.userAgent ?? userAgent,
        },
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          userAgent: true,
          ipHash: true,
        },
      });
      return { session: withNullPersona(session), isNew: false as const };
    }
  }

  const session = await db.webSession.create({
    data: {
      userAgent,
      ipHash: null,
    },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      userAgent: true,
      ipHash: true,
    },
  });
  return { session: withNullPersona(session), isNew: true as const };
}

async function getExistingLegacyDbSession(req: NextRequest) {
  const sessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    return null;
  }

  const session = await getDb().webSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      userAgent: true,
      ipHash: true,
    },
  });

  return session ? withNullPersona(session) : null;
}

export function hasWebChatDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getMemorySession(sessionId: string | null | undefined) {
  if (!sessionId) {
    return null;
  }
  return memorySessions.get(sessionId) || null;
}

export async function getOrCreateSession(req: NextRequest) {
  if (!hasWebChatDatabase()) {
    const cookieSessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
    const userAgent = normalizedUserAgent(req);
    const existing = getMemorySession(cookieSessionId);

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.userAgent = existing.userAgent ?? userAgent;
      return { session: existing, isNew: false as const };
    }

    const session: MemorySession = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      lastSeenAt: new Date(),
      userAgent,
      ipHash: null,
      persona: null,
      projectId: null,
    };
    memorySessions.set(session.id, session);
    return { session, isNew: true as const };
  }

  if (inLegacyDbMode()) {
    return getOrCreateLegacyDbSession(req);
  }

  const db = getDb();
  const cookieSessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  const userAgent = normalizedUserAgent(req);

  try {
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
        persona: null,
      },
    });
    return { session, isNew: true as const };
  } catch (error) {
    if (activateLegacyDbMode(error)) {
      return getOrCreateLegacyDbSession(req);
    }
    throw error;
  }
}

export async function getExistingSession(req: NextRequest) {
  const sessionId = req.cookies.get(WEB_SESSION_COOKIE_NAME)?.value?.trim();
  if (!sessionId) {
    return null;
  }

  if (!hasWebChatDatabase()) {
    return getMemorySession(sessionId);
  }

  if (inLegacyDbMode()) {
    return getExistingLegacyDbSession(req);
  }

  try {
    return await getDb().webSession.findUnique({
      where: { id: sessionId },
    });
  } catch (error) {
    if (activateLegacyDbMode(error)) {
      return getExistingLegacyDbSession(req);
    }
    throw error;
  }
}

async function appendLegacyTurn({
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

export async function appendTurn({
  sessionId,
  conversationId,
  userMessage,
  assistantReply,
  mode,
  sessionPersona,
  assistantMeta,
}: {
  sessionId: string;
  conversationId: string;
  userMessage: string;
  assistantReply: string;
  mode: ReplyMode;
  sessionPersona: Persona | null;
  assistantMeta: AssistantTurnMeta;
}) {
  if (!hasWebChatDatabase()) {
    const turn = memoryMessages.filter(
      (message) =>
        message.sessionId === sessionId &&
        message.conversationId === conversationId &&
        message.role === "assistant",
    ).length;
    const createdAt = new Date().toISOString();
    const session = memorySessions.get(sessionId);

    if (session) {
      session.persona = sessionPersona;
      session.lastSeenAt = new Date();
    }

    memoryMessages.push(
      {
        id: crypto.randomUUID(),
        sessionId,
        conversationId,
        role: "user",
        content: userMessage,
        mode: null,
        persona: sessionPersona,
        route: null,
        nextStep: null,
        extractedFields: null,
        selectedReplySource: null,
        fallbackReason: null,
        providerState: null,
        model: null,
        configuredMode: null,
        effectiveMode: null,
        operation: null,
        turn,
        createdAt,
      },
      {
        id: crypto.randomUUID(),
        sessionId,
        conversationId,
        role: "assistant",
        content: assistantReply,
        mode,
        persona: assistantMeta.persona,
        route: assistantMeta.route,
        nextStep: assistantMeta.nextStep,
        extractedFields: assistantMeta.extractedFields,
        selectedReplySource: assistantMeta.selectedReplySource,
        fallbackReason: assistantMeta.fallbackReason,
        providerState: assistantMeta.providerState,
        model: assistantMeta.model,
        configuredMode: assistantMeta.configuredMode,
        effectiveMode: assistantMeta.effectiveMode,
        operation: assistantMeta.operation,
        turn,
        createdAt,
      },
    );

    return turn;
  }

  if (inLegacyDbMode()) {
    return appendLegacyTurn({
      sessionId,
      conversationId,
      userMessage,
      assistantReply,
      mode,
    });
  }

  const db = getDb();
  try {
    return await db.$transaction(async (tx) => {
      const turn = await tx.webChatMessage.count({
        where: { sessionId, conversationId, role: "assistant" },
      });
      await tx.webSession.update({
        where: { id: sessionId },
        data: {
          persona: sessionPersona,
        },
      });
      await tx.webChatMessage.createMany({
        data: [
          {
            sessionId,
            conversationId,
            role: "user",
            content: userMessage,
            mode: null,
            persona: sessionPersona,
            turn,
          },
          {
            sessionId,
            conversationId,
            role: "assistant",
            content: assistantReply,
            mode,
            persona: assistantMeta.persona,
            route: assistantMeta.route,
            nextStep:
              assistantMeta.nextStep === null
                ? Prisma.JsonNull
                : (assistantMeta.nextStep as Prisma.InputJsonValue),
            extractedFields:
              assistantMeta.extractedFields === null
                ? Prisma.JsonNull
                : (assistantMeta.extractedFields as Prisma.InputJsonValue),
            selectedReplySource: assistantMeta.selectedReplySource,
            fallbackReason: assistantMeta.fallbackReason,
            providerState: assistantMeta.providerState,
            model: assistantMeta.model,
            configuredMode: assistantMeta.configuredMode,
            effectiveMode: assistantMeta.effectiveMode,
            operation: assistantMeta.operation,
            turn,
          },
        ],
      });
      return turn;
    });
  } catch (error) {
    if (activateLegacyDbMode(error)) {
      return appendLegacyTurn({
        sessionId,
        conversationId,
        userMessage,
        assistantReply,
        mode,
      });
    }
    throw error;
  }
}

export async function loadConversationMessages({
  sessionId,
  conversationId,
}: {
  sessionId: string;
  conversationId: string;
}) {
  if (!hasWebChatDatabase()) {
    return memoryMessages
      .filter(
        (message) =>
          message.sessionId === sessionId &&
          message.conversationId === conversationId,
      )
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      )
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        mode: message.mode,
        persona: message.persona,
        route: message.route,
        nextStep: message.nextStep,
        extractedFields: message.extractedFields,
        selectedReplySource: message.selectedReplySource,
        fallbackReason: message.fallbackReason,
        providerState: message.providerState,
        model: message.model,
        configuredMode: message.configuredMode,
        effectiveMode: message.effectiveMode,
        operation: message.operation,
        turn: message.turn,
        createdAt: message.createdAt,
      }));
  }

  const legacyLoadConversationMessages = async () => {
    const messages = await getDb().webChatMessage.findMany({
      where: { sessionId, conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        role: true,
        content: true,
        mode: true,
        turn: true,
        createdAt: true,
      },
    });

    return messages.map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      mode:
        message.mode === "autonomous" || message.mode === "holding"
          ? message.mode
          : null,
      persona: null,
      route: null,
      nextStep: null,
      extractedFields: null,
      selectedReplySource: null,
      fallbackReason: null,
      providerState: null,
      model: null,
      configuredMode: null,
      effectiveMode: null,
      operation: null,
      turn: message.turn,
      createdAt: message.createdAt.toISOString(),
    })) satisfies StoredWebChatMessage[];
  };

  if (inLegacyDbMode()) {
    return legacyLoadConversationMessages();
  }

  let messages;
  try {
    messages = await getDb().webChatMessage.findMany({
      where: { sessionId, conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        role: true,
        content: true,
        mode: true,
        persona: true,
        route: true,
        nextStep: true,
        extractedFields: true,
        selectedReplySource: true,
        fallbackReason: true,
        providerState: true,
        model: true,
        configuredMode: true,
        effectiveMode: true,
        operation: true,
        turn: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (activateLegacyDbMode(error)) {
      return legacyLoadConversationMessages();
    }
    throw error;
  }

  return messages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
    mode: message.mode === "autonomous" || message.mode === "holding" ? message.mode : null,
    persona:
      message.persona === "host" ||
      message.persona === "creative" ||
      message.persona === "venue" ||
      message.persona === "fan"
        ? message.persona
        : null,
    route: message.route,
    nextStep:
      message.nextStep && typeof message.nextStep === "object"
        ? (message.nextStep as WebChatNextStep)
        : null,
    extractedFields:
      message.extractedFields && typeof message.extractedFields === "object"
        ? (message.extractedFields as StoredExtractedFields)
        : null,
    selectedReplySource: message.selectedReplySource,
    fallbackReason: message.fallbackReason,
    providerState:
      message.providerState === "openai_not_called_gate_closed" ||
      message.providerState === "openai_not_called_mode_mock" ||
      message.providerState === "openai_not_called_missing_key" ||
      message.providerState === "openai_called_succeeded" ||
      message.providerState === "openai_called_failed" ||
      message.providerState === "openai_called_validation_failed"
        ? message.providerState
        : null,
    model: message.model,
    configuredMode: message.configuredMode,
    effectiveMode: message.effectiveMode,
    operation: message.operation,
    turn: message.turn,
    createdAt: message.createdAt.toISOString(),
  })) satisfies StoredWebChatMessage[];
}

export async function loadLatestConversationForSession(sessionId: string) {
  if (!hasWebChatDatabase()) {
    const latestMessage = [...memoryMessages]
      .filter((message) => message.sessionId === sessionId)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      )[0];

    if (!latestMessage) {
      return null;
    }

    return {
      conversationId: latestMessage.conversationId,
      messages: await loadConversationMessages({
        sessionId,
        conversationId: latestMessage.conversationId,
      }),
    };
  }

  const latestMessage = await getDb().webChatMessage.findFirst({
    where: { sessionId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { conversationId: true },
  });

  if (!latestMessage) {
    return null;
  }

  return {
    conversationId: latestMessage.conversationId,
    messages: await loadConversationMessages({
      sessionId,
      conversationId: latestMessage.conversationId,
    }),
  };
}

export async function loadRecentAssistantMessagesForRuntime(limit = 100) {
  if (!hasWebChatDatabase()) {
    return [...memoryMessages]
      .filter((message) => message.role === "assistant")
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, limit)
      .map((message) => ({
        mode: message.mode,
        providerState: message.providerState,
        fallbackReason: message.fallbackReason,
        selectedReplySource: message.selectedReplySource,
        model: message.model,
        configuredMode: message.configuredMode,
        effectiveMode: message.effectiveMode,
        createdAt: new Date(message.createdAt),
      })) satisfies AssistantRuntimeSnapshot[];
  }

  const legacyLoadRuntimeMessages = async () =>
    getDb().webChatMessage.findMany({
      where: { role: "assistant" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        mode: true,
        createdAt: true,
      },
    }).then((messages) =>
      messages.map((message) => ({
        mode:
          message.mode === "autonomous" || message.mode === "holding"
            ? message.mode
            : null,
        providerState: null,
        fallbackReason: null,
        selectedReplySource: null,
        model: null,
        configuredMode: null,
        effectiveMode: null,
        createdAt: message.createdAt,
      })),
    );

  if (inLegacyDbMode()) {
    return legacyLoadRuntimeMessages();
  }

  try {
    return await getDb().webChatMessage.findMany({
      where: { role: "assistant" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        mode: true,
        providerState: true,
        fallbackReason: true,
        selectedReplySource: true,
        model: true,
        configuredMode: true,
        effectiveMode: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (activateLegacyDbMode(error)) {
      return legacyLoadRuntimeMessages();
    }
    throw error;
  }
}
