"use client";

import { useRouter } from "next/navigation";
import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import { sagaRoutes, withRoleFilter } from "@/lib/sagaRoutes";
import { buildNextStepHref, readPendingNextStep } from "@/lib/webChatNextStep";
import { useAgencyStore } from "@/store/useAgencyStore";
import { useAppStore } from "@/store/useAppStore";

export function useSagaNavigation() {
  const router = useRouter();

  const resolveLegacyEventSlug = (eventId?: string | null) => {
    const state = useAppStore.getState();
    const resolvedId = eventId || state.selectedEventId;
    return state.events.find((event) => event.id === resolvedId)?.slug || null;
  };

  const resolveProjectSlug = (projectId?: string | null) => {
    const state = useAgencyStore.getState();
    const resolvedId = projectId || state.selectedProjectId;
    return state.projects.find((project) => project.id === resolvedId)?.slug || null;
  };

  const resolveTalentSlug = (talentId?: string | null) => {
    const state = useAgencyStore.getState();
    const talent = state.talent.find((profile) => profile.id === (talentId || state.selectedTalentId));
    if (!talent) return null;
    return talent.id;
  };

  return {
    goHome: () => router.push(sagaRoutes.landing),
    goTalent: (projectId?: string | null) => {
      const slug = resolveProjectSlug(projectId);
      router.push(slug ? `${sagaRoutes.explore}?project=${slug}` : sagaRoutes.explore);
    },
    goExplore: () => router.push(sagaRoutes.explore),
    goFeed: () => router.push(sagaRoutes.feed),
    goMe: () => router.push(sagaRoutes.me),
    goSpaces: () => router.push(sagaRoutes.spaces),
    goProjects: () => router.push(sagaRoutes.projects),
    goMyEvents: () => router.push(sagaRoutes.projects),
    goRelay: (projectId?: string | null, conversationId?: string | null) => {
      const slug = resolveProjectSlug(projectId);
      const params = new URLSearchParams();
      if (slug) params.set("project", slug);
      if (conversationId) params.set("conversation", conversationId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      router.push(`${sagaRoutes.relay}${suffix}`);
    },
    goProfile: () => router.push(sagaRoutes.profile),
    openCreate: () => {
      const pendingNextStep = readPendingNextStep("/projects/new");
      if (pendingNextStep) {
        router.push(buildNextStepHref(pendingNextStep));
        return;
      }

      requestWebChatReset("host");
      router.push("/?intent=host");
    },
    openPostProject: () => {
      const pendingNextStep = readPendingNextStep("/projects/new");
      if (pendingNextStep) {
        router.push(buildNextStepHref(pendingNextStep));
        return;
      }

      requestWebChatReset("host");
      router.push("/?intent=host");
    },
    openProject: (projectId?: string | null) => {
      const slug = resolveProjectSlug(projectId);
      if (slug) router.push(sagaRoutes.project(slug));
    },
    openProjectDiscover: (projectId?: string | null, role?: string | null) => {
      const slug = resolveProjectSlug(projectId);
      if (!slug) return;
      router.push(withRoleFilter(sagaRoutes.projectDiscover(slug), role));
    },
    openTalentProfile: (talentId?: string | null, projectId?: string | null) => {
      const talentSlug = resolveTalentSlug(talentId);
      if (!talentSlug) return;
      const projectSlug = resolveProjectSlug(projectId);
      router.push(
        projectSlug
          ? `${sagaRoutes.talentProfile(talentSlug)}?project=${projectSlug}`
          : sagaRoutes.talentProfile(talentSlug)
      );
    },
    openEvent: (eventId: string) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(sagaRoutes.event(slug));
    },
    openLegacyEventBySlug: (slug: string) => {
      if (slug) router.push(sagaRoutes.event(slug));
    },
    openTickets: (eventId?: string | null) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(sagaRoutes.tickets(slug));
    },
    openTicketsBySlug: (slug?: string | null) => {
      if (slug) router.push(sagaRoutes.tickets(slug));
    },
    openApply: (eventId?: string | null) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(sagaRoutes.apply(slug));
    },
    openWorkspace: (eventId?: string | null) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(sagaRoutes.workspace(slug));
    },
    openDiscover: (eventId?: string | null, role?: string | null) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(withRoleFilter(sagaRoutes.discover(slug), role));
    },
    openOutreach: (eventId?: string | null) => {
      const slug = resolveLegacyEventSlug(eventId);
      if (slug) router.push(sagaRoutes.outreach(slug));
    },
  };
}
