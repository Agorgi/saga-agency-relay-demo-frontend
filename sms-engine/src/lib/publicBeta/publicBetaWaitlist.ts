import { createHash } from "node:crypto";
import type {
  ConsentEventSource,
  ConsentEventType,
  Prisma,
  PublicBetaUseCase,
  PublicBetaWaitlistEntry,
  PublicBetaWaitlistStatus,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import {
  hashPhoneForLookup,
  redactEmail,
  redactPhone,
  redactSensitiveJson,
} from "@/lib/dataOps/dataClassification";
import {
  evaluatePublicBetaAdmission,
  type PublicBetaAdmissionDecision,
} from "@/lib/publicBeta/publicBetaAdmission";
import {
  getCappedPublicBetaConfig,
  publicBetaAuditEvents,
  PUBLIC_BETA_CONSENT_TEXT,
  PUBLIC_BETA_CONSENT_TEXT_VERSION,
} from "@/lib/publicBeta/publicBetaConfig";

export const publicBetaUseCaseOptions: PublicBetaUseCase[] = [
  "ORGANIZER",
  "CREATOR",
  "INTEREST_CHECK",
  "OTHER",
  "UNKNOWN",
];

export const publicBetaWaitlistStatusOptions: PublicBetaWaitlistStatus[] = [
  "PENDING",
  "INVITED",
  "ADMITTED",
  "REJECTED",
  "PAUSED",
  "DUPLICATE",
  "OPTED_OUT",
];

export type PublicBetaWaitlistInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  desiredUseCase?: string | null;
  fandoms?: string[] | null;
  source?: string | null;
  consentCaptured?: boolean;
  consentTextVersion?: string | null;
  notes?: string | null;
};

export type PublicBetaWaitlistFilters = {
  status?: string | null;
  desiredUseCase?: string | null;
  city?: string | null;
};

function normalizeText(value?: string | null) {
  return value && value.trim() ? value.trim() : null;
}

function normalizeEmail(value?: string | null) {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

export function hashEmailForLookup(value?: string | null) {
  const email = normalizeEmail(value);
  if (!email) return null;
  return createHash("sha256").update(email).digest("hex");
}

export function normalizePublicBetaUseCase(
  value?: string | null,
): PublicBetaUseCase {
  const normalized = (value || "UNKNOWN").trim().toUpperCase();
  return publicBetaUseCaseOptions.includes(normalized as PublicBetaUseCase)
    ? (normalized as PublicBetaUseCase)
    : "UNKNOWN";
}

export function normalizePublicBetaWaitlistStatus(
  value?: string | null,
): PublicBetaWaitlistStatus {
  const normalized = (value || "PENDING").trim().toUpperCase();
  return publicBetaWaitlistStatusOptions.includes(
    normalized as PublicBetaWaitlistStatus,
  )
    ? (normalized as PublicBetaWaitlistStatus)
    : "PENDING";
}

export function preparePublicBetaWaitlistData(input: PublicBetaWaitlistInput) {
  const email = normalizeEmail(input.email);
  const phoneHash = hashPhoneForLookup(input.phone);
  const redactedPhone = input.phone ? redactPhone(input.phone) : null;
  const consentCaptured = Boolean(input.consentCaptured);

  return {
    name: normalizeText(input.name),
    email,
    emailHash: hashEmailForLookup(email),
    phoneHash,
    redactedPhone,
    city: normalizeText(input.city),
    desiredUseCase: normalizePublicBetaUseCase(input.desiredUseCase),
    fandoms: input.fandoms?.map((item) => item.trim()).filter(Boolean) || [],
    source: normalizeText(input.source) || "waitlist_form",
    status: "PENDING" as PublicBetaWaitlistStatus,
    consentCaptured,
    consentTextVersion: consentCaptured
      ? input.consentTextVersion || PUBLIC_BETA_CONSENT_TEXT_VERSION
      : null,
    consentCapturedAt: consentCaptured ? new Date() : null,
    notes: normalizeText(input.notes),
  };
}

export function safePublicBetaWaitlistSummary(
  entry: Pick<
    PublicBetaWaitlistEntry,
    | "id"
    | "email"
    | "redactedPhone"
    | "name"
    | "desiredUseCase"
    | "city"
    | "fandoms"
    | "source"
    | "status"
    | "inviteCodeId"
    | "consentCaptured"
    | "consentTextVersion"
    | "consentCapturedAt"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email ? redactEmail(entry.email) : null,
    redactedPhone: entry.redactedPhone,
    desiredUseCase: entry.desiredUseCase,
    city: entry.city,
    fandoms: redactSensitiveJson(entry.fandoms),
    source: entry.source,
    status: entry.status,
    inviteCodeId: entry.inviteCodeId,
    consentCaptured: entry.consentCaptured,
    consentTextVersion: entry.consentTextVersion,
    consentCapturedAt: entry.consentCapturedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function detectWaitlistDuplicate(input: {
  existingEmailHash?: string | null;
  existingPhoneHash?: string | null;
  emailHash?: string | null;
  phoneHash?: string | null;
}) {
  return Boolean(
    (input.emailHash && input.emailHash === input.existingEmailHash) ||
      (input.phoneHash && input.phoneHash === input.existingPhoneHash),
  );
}

export async function createPublicBetaWaitlistEntry(input: PublicBetaWaitlistInput) {
  const config = getCappedPublicBetaConfig();
  const prepared = preparePublicBetaWaitlistData(input);

  if (!config.publicBetaLandingEnabled || !config.publicBetaWaitlistEnabled) {
    return {
      ok: false,
      status: "waitlist_disabled" as const,
      entry: null,
      duplicate: false,
      persisted: false,
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      ok: true,
      status: "created_preview" as const,
      entry: safePublicBetaWaitlistSummary({
        id: "preview",
        email: prepared.email,
        redactedPhone: prepared.redactedPhone,
        name: prepared.name,
        desiredUseCase: prepared.desiredUseCase,
        city: prepared.city,
        fandoms: prepared.fandoms,
        source: prepared.source,
        status: "PENDING",
        inviteCodeId: null,
        consentCaptured: prepared.consentCaptured,
        consentTextVersion: prepared.consentTextVersion,
        consentCapturedAt: prepared.consentCapturedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      duplicate: false,
      persisted: false,
    };
  }

  const db = getDb();
  const duplicate = await db.publicBetaWaitlistEntry.findFirst({
    where: {
      OR: [
        ...(prepared.emailHash ? [{ emailHash: prepared.emailHash }] : []),
        ...(prepared.phoneHash ? [{ phoneHash: prepared.phoneHash }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const entry = await db.publicBetaWaitlistEntry.create({
    data: {
      ...prepared,
      status: duplicate ? "DUPLICATE" : "PENDING",
      fandoms: prepared.fandoms,
    },
  });

  if (prepared.consentCaptured) {
    await recordPublicBetaConsentEvent({
      waitlistEntryId: entry.id,
      phoneHash: prepared.phoneHash,
      emailHash: prepared.emailHash,
      consentType: "PUBLIC_BETA",
      source: "WAITLIST_FORM",
      consentText: PUBLIC_BETA_CONSENT_TEXT,
      consentTextVersion: prepared.consentTextVersion || PUBLIC_BETA_CONSENT_TEXT_VERSION,
      metadata: { waitlistEntryCreated: true },
    });
  }

  await logAudit({
    actorType: "SYSTEM",
    action: publicBetaAuditEvents.waitlistEntryCreated,
    entityType: "PublicBetaWaitlistEntry",
    entityId: entry.id,
    metadata: {
      waitlistEntryId: entry.id,
      status: entry.status,
      desiredUseCase: entry.desiredUseCase,
      hasEmail: Boolean(entry.email),
      hasPhone: Boolean(entry.redactedPhone),
      consentCaptured: entry.consentCaptured,
      duplicate: Boolean(duplicate),
      noSmsSent: true,
    },
  });

  return {
    ok: true,
    status: duplicate ? ("duplicate" as const) : ("created" as const),
    entry: safePublicBetaWaitlistSummary(entry),
    duplicate: Boolean(duplicate),
    persisted: true,
  };
}

export async function recordPublicBetaConsentEvent(input: {
  participantId?: string | null;
  waitlistEntryId?: string | null;
  phoneHash?: string | null;
  emailHash?: string | null;
  consentType?: ConsentEventType;
  consentTextVersion?: string | null;
  consentText?: string | null;
  source?: ConsentEventSource;
  metadata?: Record<string, unknown>;
}) {
  const capturedAt = new Date();
  const consentType = input.consentType || "PUBLIC_BETA";
  const source = input.source || "ADMIN";
  const consentTextVersion =
    input.consentTextVersion || PUBLIC_BETA_CONSENT_TEXT_VERSION;
  const consentText = input.consentText || PUBLIC_BETA_CONSENT_TEXT;

  if (!process.env.DATABASE_URL) {
    return {
      persisted: false,
      event: {
        id: "preview",
        participantId: input.participantId || null,
        waitlistEntryId: input.waitlistEntryId || null,
        consentType,
        source,
        consentTextVersion,
        capturedAt,
      },
    };
  }

  const event = await getDb().consentEvent.create({
    data: {
      participantId: input.participantId || null,
      waitlistEntryId: input.waitlistEntryId || null,
      phoneHash: input.phoneHash || null,
      emailHash: input.emailHash || null,
      consentType,
      source,
      consentTextVersion,
      consentText,
      capturedAt,
      metadata: (input.metadata || {}) as Prisma.InputJsonValue,
    },
  });

  if (input.waitlistEntryId) {
    await getDb().publicBetaWaitlistEntry.update({
      where: { id: input.waitlistEntryId },
      data: {
        consentCaptured: true,
        consentTextVersion,
        consentCapturedAt: capturedAt,
      },
    });
  }

  await logAudit({
    actorType: source === "ADMIN" ? "ADMIN" : "SYSTEM",
    action: publicBetaAuditEvents.consentRecorded,
    entityType: "ConsentEvent",
    entityId: event.id,
    metadata: {
      waitlistEntryId: input.waitlistEntryId || undefined,
      participantId: input.participantId || undefined,
      consentType,
      consentTextVersion,
      source,
      noSmsSent: true,
    },
  });

  return { persisted: true, event };
}

function waitlistWhere(filters: PublicBetaWaitlistFilters = {}) {
  const status = filters.status
    ? normalizePublicBetaWaitlistStatus(filters.status)
    : null;
  const desiredUseCase = filters.desiredUseCase
    ? normalizePublicBetaUseCase(filters.desiredUseCase)
    : null;
  return {
    ...(status ? { status } : {}),
    ...(desiredUseCase ? { desiredUseCase } : {}),
    ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" as const } } : {}),
  };
}

export async function getPublicBetaWaitlistHealthSnapshot() {
  if (!process.env.DATABASE_URL) {
    return {
      publicBetaWaitlistCount: null,
      publicBetaAdmittedCount: null,
      publicBetaPausedCount: null,
      publicBetaRejectedCount: null,
      publicBetaDailyNewUserCount: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      publicBetaWaitlistCount,
      publicBetaAdmittedCount,
      publicBetaPausedCount,
      publicBetaRejectedCount,
      publicBetaDailyNewUserCount,
    ] = await Promise.all([
      getDb().publicBetaWaitlistEntry.count(),
      getDb().publicBetaWaitlistEntry.count({ where: { status: "ADMITTED" } }),
      getDb().publicBetaWaitlistEntry.count({ where: { status: "PAUSED" } }),
      getDb().publicBetaWaitlistEntry.count({ where: { status: "REJECTED" } }),
      getDb().publicBetaWaitlistEntry.count({
        where: { createdAt: { gte: since } },
      }),
    ]);

    return {
      publicBetaWaitlistCount,
      publicBetaAdmittedCount,
      publicBetaPausedCount,
      publicBetaRejectedCount,
      publicBetaDailyNewUserCount,
    };
  } catch {
    return {
      publicBetaWaitlistCount: null,
      publicBetaAdmittedCount: null,
      publicBetaPausedCount: null,
      publicBetaRejectedCount: null,
      publicBetaDailyNewUserCount: null,
      warnings: ["public_beta_waitlist_db_unavailable"],
    };
  }
}

export async function getPublicBetaAdminSnapshot(
  filters: PublicBetaWaitlistFilters = {},
) {
  const [health, config] = await Promise.all([
    getPublicBetaWaitlistHealthSnapshot(),
    Promise.resolve(getCappedPublicBetaConfig()),
  ]);

  if (!process.env.DATABASE_URL) {
    return {
      config,
      health,
      entries: [],
      recentEvents: [],
    };
  }

  const [entries, recentEvents] = await Promise.all([
    getDb().publicBetaWaitlistEntry.findMany({
      where: waitlistWhere(filters),
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    getDb().auditLog.findMany({
      where: { action: { startsWith: "public_beta." } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    config,
    health,
    entries: entries.map(safePublicBetaWaitlistSummary),
    recentEvents: recentEvents.map((event) => ({
      ...event,
      metadata: redactSensitiveJson(event.metadata),
    })),
  };
}

export async function updatePublicBetaWaitlistStatus(input: {
  waitlistEntryId: string;
  status: PublicBetaWaitlistStatus;
  notes?: string | null;
}) {
  const existing = await getDb().publicBetaWaitlistEntry.findUniqueOrThrow({
    where: { id: input.waitlistEntryId },
  });
  const updated = await getDb().publicBetaWaitlistEntry.update({
    where: { id: input.waitlistEntryId },
    data: {
      status: input.status,
      notes: input.notes ?? existing.notes,
    },
  });

  const action =
    input.status === "INVITED"
      ? publicBetaAuditEvents.entryInvited
      : input.status === "ADMITTED"
        ? publicBetaAuditEvents.entryAdmitted
        : input.status === "REJECTED"
          ? publicBetaAuditEvents.entryRejected
          : input.status === "PAUSED"
            ? publicBetaAuditEvents.entryPaused
            : publicBetaAuditEvents.waitlistEntryUpdated;

  await logAudit({
    actorType: "ADMIN",
    action,
    entityType: "PublicBetaWaitlistEntry",
    entityId: updated.id,
    metadata: {
      waitlistEntryId: updated.id,
      oldStatus: existing.status,
      newStatus: updated.status,
      desiredUseCase: updated.desiredUseCase,
      noSmsSent: true,
    },
  });

  return safePublicBetaWaitlistSummary(updated);
}

export async function evaluatePublicBetaAdmissionForEntry(
  waitlistEntryId: string,
): Promise<PublicBetaAdmissionDecision> {
  const entry = await getDb().publicBetaWaitlistEntry.findUniqueOrThrow({
    where: { id: waitlistEntryId },
  });
  const [activeParticipantCount] = await Promise.all([
    getDb().pilotParticipant.count({ where: { status: "ACTIVE" } }),
  ]);
  const config = getCappedPublicBetaConfig();
  const decision = evaluatePublicBetaAdmission({
    waitlistEntry: entry,
    pilotStage: config.pilotStage,
    accessMode: process.env.SMS_ACCESS_MODE || "allowlist_only",
    activeParticipantCount,
    publicBetaMaxActiveParticipants: config.publicBetaMaxActiveParticipants,
    publicBetaEnabled: config.publicBetaEnabled,
    publicBetaRequireConsent: config.publicBetaRequireConsent,
    smsComplianceApproved: config.smsComplianceApproved,
    smsSendsDisabled: config.smsSendsDisabled,
    supportEmailConfigured: config.supportEmailConfigured,
    privacyUrlConfigured: config.privacyUrlConfigured,
    termsUrlConfigured: config.termsUrlConfigured,
    duplicate: entry.status === "DUPLICATE",
    optedOut: entry.status === "OPTED_OUT",
    paused: entry.status === "PAUSED",
  });

  await logAudit({
    actorType: "ADMIN",
    action: publicBetaAuditEvents.admissionEvaluated,
    entityType: "PublicBetaWaitlistEntry",
    entityId: entry.id,
    metadata: {
      waitlistEntryId: entry.id,
      status: entry.status,
      admissionStatus: decision.admissionStatus,
      blockersCount: decision.blockers.length,
      warningsCount: decision.warnings.length,
      noSmsSent: true,
    },
  });

  return decision;
}
