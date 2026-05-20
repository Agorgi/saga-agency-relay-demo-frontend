"use client";

import { useRouter } from "next/navigation";
import { sagaRoutes, withRoleFilter } from "@/lib/sagaRoutes";
import { useAgencyStore } from "@/store/useAgencyStore";

export function useSagaNavigation() {
  const router = useRouter();

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
      router.push(slug ? `${sagaRoutes.talent}?project=${slug}` : sagaRoutes.talent);
    },
    goExplore: () => router.push(sagaRoutes.talent),
    goMe: () => router.push(sagaRoutes.profile),
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
  };
}
