"use server";

import { redirect } from "next/navigation";
import { requireAdminForAction } from "@/lib/adminAuth";
import { logAudit } from "@/lib/audit";
import { loadConversationContext } from "@/lib/conversation/conversationContext";
import { getConversationEngineRuntime } from "@/lib/conversation/conversationEngineMode";
import { evaluateOrganizerIntakePolicy } from "@/lib/conversation/organizerIntakePolicy";
import { generateOrganizerReplyFromPlan } from "@/lib/conversation/organizerReplyGenerator";
import {
  generateAdminDevOrganizerReplyWithLlm,
  resolveAdminDevLlmExecution,
} from "@/lib/conversation/adminDevLlmReplies";
import { classifyConversationIntent } from "@/lib/conversation/intentRouter";
import type {
  OrganizerGeneratedReply,
  ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import { getDb } from "@/lib/db";
import { handleOrganizerInbound } from "@/lib/intake";
import { normalizePhone } from "@/lib/phone";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function devUrl(phone: string, params: { demoError?: string; demoNotice?: string } = {}) {
  const search = new URLSearchParams({ phone });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `/admin/dev?${search.toString()}`;
}

async function logDevActionFailure(
  action: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
) {
  await logAudit({
    actorType: "SYSTEM",
    action: "demo.action_failed",
    entityType: "DemoLab",
    entityId: action,
    metadata: {
      ...metadata,
      error: error instanceof Error ? error.message : "Unknown demo action error",
    },
  });
}

async function mockActiveOrganizerPlan({
  phone,
  body,
  requestedMode,
}: {
  phone: string;
  body: string;
  requestedMode?: string | null;
}): Promise<{
  replyPlan?: ReplyPlan | null;
  generatedReply?: OrganizerGeneratedReply | null;
  missingRequiredFields?: string[];
  missingOptionalFields?: string[];
  intent?: string;
  runtime: ReturnType<typeof getConversationEngineRuntime>;
}> {
  const runtime = getConversationEngineRuntime({
    providerMode: "MOCK",
    requestedMode: requestedMode || "mock_active",
    source: "admin_dev",
  });

  if (!runtime.effectiveActive) {
    return { runtime };
  }

  const context = await loadConversationContext(phone, {
    allowlistResult: "not_applicable",
  });
  const classification = classifyConversationIntent({ body, context });
  const shouldPlanOrganizerIntake =
    classification.intent === "ORGANIZER_PROJECT_IDEA" ||
    (Boolean(context.activeProjectBrief) &&
      !context.activeOutreach &&
      !context.contact &&
      ![
        "STOP_OR_OPT_OUT",
        "START_OR_OPT_IN",
        "HELP",
        "CAPABILITY_FAQ",
        "SAFETY_ESCALATION",
      ].includes(classification.intent));

  if (!shouldPlanOrganizerIntake) {
    return { runtime };
  }

  const policyContext = {
    ...context,
    intent: classification.intent,
    safetyFlags: classification.shouldEscalate
      ? classification.matchedSignals
      : [],
  };
  const policy = evaluateOrganizerIntakePolicy({
    context: policyContext,
    latestMessage: body,
  });
  const deterministicReply = generateOrganizerReplyFromPlan({
    context: policyContext,
    replyPlan: policy.replyPlan,
    latestMessage: body,
  });
  const generatedReply = await generateAdminDevOrganizerReplyWithLlm({
    context: policyContext,
    replyPlan: policy.replyPlan,
    latestMessage: body,
    fallbackReply: deterministicReply,
    conversationEngineMode: runtime.mode,
  });

  return {
    replyPlan: policy.replyPlan,
    generatedReply,
    missingRequiredFields: policy.missingRequiredFields,
    missingOptionalFields: policy.missingOptionalFields,
    intent: classification.intent,
    runtime,
  };
}

export async function simulateInboundAction(formData: FormData) {
  await requireAdminForAction();
  const phone = normalizePhone(text(formData, "phone") || "+14155550000");
  const body = text(formData, "body");
  const conversationEngineMode = text(formData, "conversationEngineMode");
  if (!body) redirect(devUrl(phone, { demoNotice: "Enter a demo organizer message first." }));

  try {
    const conversation = await mockActiveOrganizerPlan({
      phone,
      body,
      requestedMode: conversationEngineMode,
    });
    const llmExecution = resolveAdminDevLlmExecution({
      conversationEngineMode: conversation.runtime.mode,
    });
    await handleOrganizerInbound({
      from: phone,
      body,
      twilioMessageSid: `sim-${crypto.randomUUID()}`,
      provider: "MOCK",
      conversationReplyPlan: conversation.replyPlan,
      conversationGeneratedReply: conversation.generatedReply,
      conversationPolicyMetadata: {
        intent: conversation.intent,
        missingRequiredFields: conversation.missingRequiredFields,
        missingOptionalFields: conversation.missingOptionalFields,
      },
      llmExecutionContext: llmExecution.executionContext,
      llmExecutionContextDetails: llmExecution.details,
      metadata: {
        simulated: true,
        source: "admin_test_lab",
        conversationEngineMode: conversation.runtime.mode,
        conversationEngineEffectiveActive: conversation.runtime.effectiveActive,
      },
    });
  } catch (error) {
    await logDevActionFailure("simulate_organizer_inbound", error, { phone });
    redirect(
      devUrl(phone, {
        demoError:
          "Organizer intake simulation failed. The error was logged for Codex review.",
      }),
    );
  }

  redirect(devUrl(phone));
}

export async function resetSimulationAction(formData: FormData) {
  await requireAdminForAction();
  const phone = normalizePhone(text(formData, "phone") || "+14155550000");
  const user = await getDb().user.findUnique({
    where: { phone },
    include: {
      projectBriefs: true,
    },
  });

  if (user) {
    await getDb().message.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          { projectBriefId: { in: user.projectBriefs.map((brief) => brief.id) } },
        ],
      },
    });
    await getDb().projectBrief.deleteMany({
      where: { userId: user.id },
    });
    await getDb().user.delete({
      where: { id: user.id },
    });
  }

  redirect(devUrl(phone));
}
