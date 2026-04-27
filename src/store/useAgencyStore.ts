"use client";

import { create } from "zustand";
import {
  buildProjectFromDraft,
  DEFAULT_BRIEF_DRAFT,
  DEFAULT_TALENT_FILTERS,
  getProjectBySlug,
  getRelayQuickReplyOptions,
  getSuggestedRoles,
  getTalentById,
  INITIAL_PROJECTS,
  INITIAL_RELAY_CONVERSATIONS,
  seedBriefFromPrompt,
  TALENT_PROFILES,
  VIEWER_PROFILE,
} from "@/data/sagaAgencyData";
import type {
  BookingTerms,
  BriefDraft,
  CreativeProject,
  ProjectRole,
  RelayConversation,
  RelayStatus,
  TalentFilters,
  TalentProfile,
  ViewerProfile,
} from "@/types/sagaAgency";

type RelayQuickReplyKey = keyof ReturnType<typeof getRelayQuickReplyOptions>;
type RelayPerspective = "client" | "talent";

interface AgencyState {
  projects: CreativeProject[];
  talent: TalentProfile[];
  conversations: RelayConversation[];
  viewerProfile: ViewerProfile;
  briefDraft: BriefDraft;
  selectedProjectId: string | null;
  selectedTalentId: string | null;
  selectedConversationId: string | null;
  talentSearchQuery: string;
  talentFilters: TalentFilters;
  relayPerspective: RelayPerspective;

  seedDraftFromPrompt: (prompt: string) => void;
  createProjectFromPrompt: (prompt: string) => CreativeProject;
  updateBriefDraft: (patch: Partial<BriefDraft>) => void;
  toggleBriefRole: (role: string) => void;
  setBriefRoleCount: (role: string, count: number) => void;
  resetBriefDraft: () => void;
  submitBrief: () => CreativeProject;

  selectProject: (projectId: string | null) => void;
  selectProjectBySlug: (slug: string | null | undefined) => void;
  selectTalent: (talentId: string | null) => void;
  selectConversation: (conversationId: string | null) => void;
  setRelayPerspective: (perspective: RelayPerspective) => void;

  setTalentSearchQuery: (query: string) => void;
  updateTalentFilters: (patch: Partial<TalentFilters>) => void;
  resetTalentFilters: () => void;

  addTalentToShortlist: (projectId: string, talentId: string, roleName?: string) => void;
  removeTalentFromShortlist: (projectId: string, talentId: string) => void;
  askSagaToReachOut: (projectId: string, talentId: string, roleId?: string) => string | null;
  sendRelayMessage: (conversationId: string, body: string) => void;
  simulateTalentQuickReply: (conversationId: string, key: RelayQuickReplyKey) => void;
  simulateTalentReply: (conversationId: string, body: string) => void;
  generateTerms: (conversationId: string) => void;
  updateTerms: (conversationId: string, patch: Partial<BookingTerms>) => void;
  sendTerms: (conversationId: string) => void;
  talentAcceptTerms: (conversationId: string) => void;
  approveTerms: (conversationId: string) => void;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function appendProject(state: AgencyState, nextProject: CreativeProject) {
  return {
    projects: [nextProject, ...state.projects],
    selectedProjectId: nextProject.id,
    viewerProfile: {
      ...state.viewerProfile,
      activeProjectIds: unique([nextProject.id, ...state.viewerProfile.activeProjectIds]),
    },
  };
}

function firstName(name: string) {
  return name.split(" ")[0];
}

function timestampFor(index: number) {
  const hour = 10 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "12" : "27";
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour > 12 ? hour - 12 : hour;
  return `${normalized}:${minute} ${suffix}`;
}

function getProject(projects: CreativeProject[], projectId: string) {
  return projects.find((project) => project.id === projectId) || null;
}

function getConversation(conversations: RelayConversation[], conversationId: string) {
  return conversations.find((conversation) => conversation.id === conversationId) || null;
}

function getRole(project: CreativeProject, roleId: string) {
  return project.requiredRoles.find((role) => role.id === roleId) || null;
}

function getBestRoleForTalent(project: CreativeProject, talent: TalentProfile) {
  return (
    project.requiredRoles.find(
      (role) =>
        talent.roles.some((talentRole) => talentRole.toLowerCase() === role.name.toLowerCase()) &&
        role.status !== "booked"
    ) || project.requiredRoles[0]
  );
}

function updateRole(
  project: CreativeProject,
  roleId: string,
  updater: (role: ProjectRole) => ProjectRole
) {
  return {
    ...project,
    requiredRoles: project.requiredRoles.map((role) => (role.id === roleId ? updater(role) : role)),
  };
}

function upsertConversation(
  conversations: RelayConversation[],
  nextConversation: RelayConversation
) {
  const existingIndex = conversations.findIndex((conversation) => conversation.id === nextConversation.id);
  if (existingIndex === -1) return [nextConversation, ...conversations];
  const clone = [...conversations];
  clone[existingIndex] = nextConversation;
  return clone;
}

function relaySummaryFromBody(talentName: string, body: string) {
  const lower = body.toLowerCase();
  if (lower.includes("unavailable") || lower.includes("booked")) {
    return `${talentName} is unavailable for the requested date.`;
  }
  if (lower.includes("parking")) {
    return `${talentName} is interested and asks that parking be covered.`;
  }
  if (lower.includes("$")) {
    return `${talentName} replied with rate feedback. Saga updated the terms summary.`;
  }
  if (lower.includes("details") || lower.includes("scope")) {
    return `${talentName} wants more detail before confirming.`;
  }
  return `${talentName} replied by text. Saga pulled the key booking points into the relay summary.`;
}

function nextActionsFromStatus(status: RelayStatus) {
  if (status === "unavailable") return ["Find replacement", "Broaden location filter", "Send another outreach"];
  if (status === "booked") return ["Kick off production", "Assign deliverables", "Share schedule"];
  if (status === "terms-ready") return ["Generate terms", "Send terms", "Book talent"];
  if (status === "negotiating") return ["Clarify scope", "Adjust rate", "Confirm availability"];
  return ["Confirm availability", "Ask for rate", "Clarify deliverables"];
}

function applyReplyToTerms(
  current: BookingTerms,
  project: CreativeProject,
  body: string
) {
  const next = { ...current };
  const lower = body.toLowerCase();

  const moneyMatch = body.match(/\$[\d,]+(?:\.\d+)?/);
  if (moneyMatch) next.rate = moneyMatch[0];
  if (lower.includes("after 1pm")) next.dateTime = `${project.dateLabel} after 1pm`;
  if (lower.includes("half-day") || lower.includes("4 hour")) next.scope = "Half-day / 4-hour shoot";
  if (lower.includes("parking")) next.expenses = "Parking covered";
  if (lower.includes("usage")) next.usageRights = "Needs clarification";
  if (lower.includes("available")) next.status = "draft";

  return next;
}

function rewriteClientMessageForTalent(project: CreativeProject, talent: TalentProfile, body: string) {
  return `Hi ${firstName(talent.name)} — Saga here. For ${project.title} in ${project.city}, the client asks: ${body}`;
}

function initialOutreachMessage(project: CreativeProject, talent: TalentProfile, role: ProjectRole) {
  return `Hi ${firstName(talent.name)} — Saga here. A ${project.projectType.toLowerCase()} is looking for a ${role.name.toLowerCase()} in ${project.city}. Budget is ${project.budgetRange}. Are you available for ${project.dateLabel}?`;
}

function createConversation(project: CreativeProject, talent: TalentProfile, role: ProjectRole): RelayConversation {
  return {
    id: `${project.id}-${talent.id}-relay`,
    projectId: project.id,
    talentId: talent.id,
    roleId: role.id,
    status: "outreach-sent",
    sagaSummary: `Saga sent the first text to ${talent.name}. Contact details stay private.`,
    nextActions: ["Wait for reply", "Send a follow-up", "Replace talent if needed"],
    extractedTerms: {
      projectId: project.id,
      talentId: talent.id,
      role: role.name,
      dateTime: project.dateLabel,
      location: `${project.city} · ${project.locationMode}`,
      rate: talent.rateRange,
      scope: role.name,
      deliverables: project.deliverables.map((item) => item.title).slice(0, 2),
      usageRights: "Owned social + web",
      revisions: "1 revision round",
      expenses: "Parking/travel to be confirmed",
      cancellation: "48 hour cancellation window",
      status: "empty",
    },
    messages: [
      {
        id: `${project.id}-${talent.id}-client-seed`,
        sender: "saga",
        visibleTo: "client",
        channel: "app",
        body: `Saga started outreach to ${talent.name}. Contact details stay private.`,
        timestamp: "Now",
      },
      {
        id: `${project.id}-${talent.id}-sms-seed`,
        sender: "saga",
        visibleTo: "talent",
        channel: "sms",
        body: initialOutreachMessage(project, talent, role),
        timestamp: "Now",
      },
    ],
  };
}

export const useAgencyStore = create<AgencyState>((set, get) => ({
  projects: INITIAL_PROJECTS,
  talent: TALENT_PROFILES,
  conversations: INITIAL_RELAY_CONVERSATIONS,
  viewerProfile: VIEWER_PROFILE,
  briefDraft: DEFAULT_BRIEF_DRAFT,
  selectedProjectId:
    INITIAL_PROJECTS.find((project) => project.relayConversationIds.length)?.id ||
    INITIAL_PROJECTS[0]?.id ||
    null,
  selectedTalentId: null,
  selectedConversationId: INITIAL_RELAY_CONVERSATIONS[0]?.id || null,
  talentSearchQuery: "",
  talentFilters: DEFAULT_TALENT_FILTERS,
  relayPerspective: "client",

  seedDraftFromPrompt: (prompt) =>
    set({
      briefDraft: seedBriefFromPrompt(prompt),
    }),

  createProjectFromPrompt: (prompt) => {
    const state = get();
    const baseDraft = seedBriefFromPrompt(prompt);
    let nextDraft = baseDraft;
    let nextProject = buildProjectFromDraft(nextDraft);
    let duplicateIndex = 2;

    while (state.projects.some((project) => project.slug === nextProject.slug || project.id === nextProject.id)) {
      nextDraft = {
        ...baseDraft,
        title: `${baseDraft.title} ${duplicateIndex}`,
      };
      nextProject = buildProjectFromDraft(nextDraft);
      duplicateIndex += 1;
    }

    set((currentState) => ({
      ...appendProject(currentState, nextProject),
      briefDraft: seedBriefFromPrompt(prompt),
      talentSearchQuery: prompt,
    }));

    return nextProject;
  },

  updateBriefDraft: (patch) =>
    set((state) => {
      const nextDraft = { ...state.briefDraft, ...patch };
      if (patch.projectType && !patch.roles) {
        nextDraft.roles = getSuggestedRoles(patch.projectType);
      }
      return { briefDraft: nextDraft };
    }),

  toggleBriefRole: (role) =>
    set((state) => {
      const roles = state.briefDraft.roles.includes(role)
        ? state.briefDraft.roles.filter((entry) => entry !== role)
        : [...state.briefDraft.roles, role];
      return {
        briefDraft: {
          ...state.briefDraft,
          roles,
        },
      };
    }),

  setBriefRoleCount: (role, count) =>
    set((state) => ({
      briefDraft: {
        ...state.briefDraft,
        roleCounts: {
          ...state.briefDraft.roleCounts,
          [role]: Math.max(1, count),
        },
      },
    })),

  resetBriefDraft: () =>
    set({
      briefDraft: DEFAULT_BRIEF_DRAFT,
    }),

  submitBrief: () => {
    const nextProject = buildProjectFromDraft(get().briefDraft);
    set((state) => ({
      ...appendProject(state, nextProject),
      briefDraft: DEFAULT_BRIEF_DRAFT,
    }));
    return nextProject;
  },

  selectProject: (projectId) =>
    set({
      selectedProjectId: projectId,
    }),

  selectProjectBySlug: (slug) =>
    set((state) => ({
      selectedProjectId: getProjectBySlug(slug, state.projects)?.id || null,
    })),

  selectTalent: (talentId) =>
    set({
      selectedTalentId: talentId,
    }),

  selectConversation: (conversationId) =>
    set({
      selectedConversationId: conversationId,
    }),

  setRelayPerspective: (relayPerspective) => set({ relayPerspective }),

  setTalentSearchQuery: (talentSearchQuery) => set({ talentSearchQuery }),

  updateTalentFilters: (patch) =>
    set((state) => ({
      talentFilters: {
        ...state.talentFilters,
        ...patch,
      },
    })),

  resetTalentFilters: () => set({ talentFilters: DEFAULT_TALENT_FILTERS }),

  addTalentToShortlist: (projectId, talentId, roleName) =>
    set((state) => {
      const project = getProject(state.projects, projectId);
      if (!project) return state;
      const talent = getTalentById(talentId, state.talent);
      if (!talent) return state;
      const role =
        (roleName
          ? project.requiredRoles.find((entry) => entry.name === roleName)
          : null) || getBestRoleForTalent(project, talent);
      if (!role) return state;

      const updatedProject = updateRole(
        {
          ...project,
          shortlistedTalentIds: unique([talentId, ...project.shortlistedTalentIds]),
        },
        role.id,
        (currentRole) => ({
          ...currentRole,
          status: currentRole.status === "booked" ? "booked" : "shortlisted",
          selectedTalentIds: unique([talentId, ...currentRole.selectedTalentIds]),
        })
      );

      return {
        projects: state.projects.map((entry) => (entry.id === projectId ? updatedProject : entry)),
        selectedProjectId: projectId,
        selectedTalentId: talentId,
        viewerProfile: {
          ...state.viewerProfile,
          savedTalentIds: unique([talentId, ...state.viewerProfile.savedTalentIds]),
        },
      };
    }),

  removeTalentFromShortlist: (projectId, talentId) =>
    set((state) => ({
      projects: state.projects.map((project) => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          shortlistedTalentIds: project.shortlistedTalentIds.filter((id) => id !== talentId),
          requiredRoles: project.requiredRoles.map((role) => ({
            ...role,
            selectedTalentIds: role.selectedTalentIds.filter((id) => id !== talentId),
            status:
              role.selectedTalentIds.includes(talentId) && role.status !== "booked"
                ? "recommended"
                : role.status,
          })),
        };
      }),
    })),

  askSagaToReachOut: (projectId, talentId, roleId) => {
    const state = get();
    const project = getProject(state.projects, projectId);
    const talent = getTalentById(talentId, state.talent);
    if (!project || !talent) return null;

    const existing = state.conversations.find(
      (conversation) => conversation.projectId === projectId && conversation.talentId === talentId
    );
    if (existing) {
      set({ selectedConversationId: existing.id, selectedProjectId: projectId });
      return existing.id;
    }

    const role = (roleId ? getRole(project, roleId) : null) || getBestRoleForTalent(project, talent);
    if (!role) return null;

    const nextConversation = createConversation(project, talent, role);

    set((currentState) => ({
      conversations: upsertConversation(currentState.conversations, nextConversation),
      selectedConversationId: nextConversation.id,
      selectedProjectId: projectId,
      projects: currentState.projects.map((entry) => {
        if (entry.id !== projectId) return entry;
        const updated = updateRole(
          {
            ...entry,
            status: "outreach",
            shortlistedTalentIds: unique([talentId, ...entry.shortlistedTalentIds]),
            relayConversationIds: unique([nextConversation.id, ...entry.relayConversationIds]),
          },
          role.id,
          (currentRole) => ({
            ...currentRole,
            status: "outreach-sent",
            selectedTalentIds: unique([talentId, ...currentRole.selectedTalentIds]),
          })
        );
        return updated;
      }),
    }));

    return nextConversation.id;
  },

  sendRelayMessage: (conversationId, body) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation || !body.trim()) return state;
      const project = getProject(state.projects, conversation.projectId);
      const talent = getTalentById(conversation.talentId, state.talent);
      if (!project || !talent) return state;

      const messageIndex = conversation.messages.length;
      const nextConversation: RelayConversation = {
        ...conversation,
        status: conversation.status === "outreach-sent" ? "negotiating" : conversation.status,
        sagaSummary: `Saga relayed your note to ${talent.name} without sharing contact details.`,
        nextActions: ["Wait for reply", "Nudge in 2 hours", "Prepare draft terms"],
        messages: [
          ...conversation.messages,
          {
            id: `${conversation.id}-client-${messageIndex}`,
            sender: "client",
            visibleTo: "client",
            channel: "app",
            body,
            timestamp: timestampFor(messageIndex),
          },
          {
            id: `${conversation.id}-saga-${messageIndex + 1}`,
            sender: "saga",
            visibleTo: "talent",
            channel: "sms",
            body: rewriteClientMessageForTalent(project, talent, body),
            timestamp: timestampFor(messageIndex + 1),
          },
        ],
      };

      return {
        conversations: upsertConversation(state.conversations, nextConversation),
        selectedConversationId: conversationId,
      };
    }),

  simulateTalentQuickReply: (conversationId, key) => {
    const preset = getRelayQuickReplyOptions()[key];
    if (!preset) return;

    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation) return state;
      const project = getProject(state.projects, conversation.projectId);
      const talent = getTalentById(conversation.talentId, state.talent);
      if (!project || !talent) return state;

      const messageIndex = conversation.messages.length;
      const nextTerms = applyReplyToTerms(conversation.extractedTerms, project, preset.talentMessage);
      const nextConversation: RelayConversation = {
        ...conversation,
        status: preset.status,
        sagaSummary: preset.summary,
        nextActions: nextActionsFromStatus(preset.status),
        extractedTerms: {
          ...nextTerms,
          status: preset.status === "terms-ready" ? "draft" : nextTerms.status,
        },
        messages: [
          ...conversation.messages,
          {
            id: `${conversation.id}-talent-${messageIndex}`,
            sender: "talent",
            visibleTo: "talent",
            channel: "sms",
            body: preset.talentMessage,
            timestamp: timestampFor(messageIndex),
          },
          {
            id: `${conversation.id}-saga-summary-${messageIndex + 1}`,
            sender: "saga",
            visibleTo: "client",
            channel: "app",
            body: preset.summary,
            timestamp: timestampFor(messageIndex + 1),
          },
        ],
      };

      const nextProjects = state.projects.map((entry) => {
        if (entry.id !== project.id) return entry;
        return updateRole(entry, conversation.roleId, (role) => ({
          ...role,
          status:
            preset.status === "unavailable"
              ? "declined"
              : preset.status === "terms-ready"
                ? "terms-ready"
                : "in-conversation",
        }));
      });

      return {
        conversations: upsertConversation(state.conversations, nextConversation),
        projects: nextProjects,
        selectedConversationId: conversationId,
      };
    });
  },

  simulateTalentReply: (conversationId, body) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation || !body.trim()) return state;
      const project = getProject(state.projects, conversation.projectId);
      const talent = getTalentById(conversation.talentId, state.talent);
      if (!project || !talent) return state;

      const summary = relaySummaryFromBody(talent.name, body);
      const nextStatus: RelayStatus =
        body.toLowerCase().includes("unavailable") || body.toLowerCase().includes("booked")
          ? "unavailable"
          : body.toLowerCase().includes("$") || body.toLowerCase().includes("parking")
            ? "terms-ready"
            : "talent-replied";
      const messageIndex = conversation.messages.length;
      const nextConversation: RelayConversation = {
        ...conversation,
        status: nextStatus,
        sagaSummary: summary,
        nextActions: nextActionsFromStatus(nextStatus),
        extractedTerms: applyReplyToTerms(conversation.extractedTerms, project, body),
        messages: [
          ...conversation.messages,
          {
            id: `${conversation.id}-talent-${messageIndex}`,
            sender: "talent",
            visibleTo: "talent",
            channel: "sms",
            body,
            timestamp: timestampFor(messageIndex),
          },
          {
            id: `${conversation.id}-saga-summary-${messageIndex + 1}`,
            sender: "saga",
            visibleTo: "client",
            channel: "app",
            body: summary,
            timestamp: timestampFor(messageIndex + 1),
          },
        ],
      };

      const nextProjects = state.projects.map((entry) => {
        if (entry.id !== project.id) return entry;
        return updateRole(entry, conversation.roleId, (role) => ({
          ...role,
          status:
            nextStatus === "terms-ready"
              ? "terms-ready"
              : nextStatus === "unavailable"
                ? "declined"
                : "in-conversation",
        }));
      });

      return {
        conversations: upsertConversation(state.conversations, nextConversation),
        projects: nextProjects,
      };
    }),

  generateTerms: (conversationId) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation) return state;
      const nextConversation: RelayConversation = {
        ...conversation,
        status: "terms-ready",
        sagaSummary: "Saga turned the conversation into draft booking terms.",
        nextActions: ["Send terms", "Approve internally", "Book talent"],
        extractedTerms: {
          ...conversation.extractedTerms,
          status: "draft",
        },
      };

      return {
        conversations: upsertConversation(state.conversations, nextConversation),
        projects: state.projects.map((project) =>
          project.id === conversation.projectId
            ? updateRole(project, conversation.roleId, (role) => ({
                ...role,
                status: "terms-ready",
              }))
            : project
        ),
      };
    }),

  updateTerms: (conversationId, patch) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              extractedTerms: {
                ...conversation.extractedTerms,
                ...patch,
              },
            }
          : conversation
      ),
    })),

  sendTerms: (conversationId) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation) return state;
      const talent = getTalentById(conversation.talentId, state.talent);
      if (!talent) return state;
      const messageIndex = conversation.messages.length;
      const nextConversation: RelayConversation = {
        ...conversation,
        status: "terms-ready",
        sagaSummary: `Saga sent the draft terms to ${talent.name} by text.`,
        nextActions: ["Wait for talent acceptance", "Adjust terms if needed", "Book talent"],
        extractedTerms: {
          ...conversation.extractedTerms,
          status: "sent",
        },
        messages: [
          ...conversation.messages,
          {
            id: `${conversation.id}-saga-terms-${messageIndex}`,
            sender: "saga",
            visibleTo: "talent",
            channel: "sms",
            body: `Saga here again — I just sent the draft terms for ${conversation.extractedTerms.role}. Reply ACCEPT if it all looks good or text any edits.`,
            timestamp: timestampFor(messageIndex),
          },
          {
            id: `${conversation.id}-client-terms-${messageIndex + 1}`,
            sender: "saga",
            visibleTo: "client",
            channel: "app",
            body: "Terms sent through Saga Relay. Contact details remain private.",
            timestamp: timestampFor(messageIndex + 1),
          },
        ],
      };
      return {
        conversations: upsertConversation(state.conversations, nextConversation),
      };
    }),

  talentAcceptTerms: (conversationId) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation) return state;
      const talent = getTalentById(conversation.talentId, state.talent);
      if (!talent) return state;
      const messageIndex = conversation.messages.length;
      const nextConversation: RelayConversation = {
        ...conversation,
        sagaSummary: `${talent.name} accepted the draft terms in Saga Relay.`,
        nextActions: ["Client approve terms", "Book talent", "Assign deliverables"],
        extractedTerms: {
          ...conversation.extractedTerms,
          status: "talent-accepted",
        },
        messages: [
          ...conversation.messages,
          {
            id: `${conversation.id}-talent-accept-${messageIndex}`,
            sender: "talent",
            visibleTo: "talent",
            channel: "sms",
            body: "ACCEPT — the terms look good on my side.",
            timestamp: timestampFor(messageIndex),
          },
          {
            id: `${conversation.id}-client-accept-${messageIndex + 1}`,
            sender: "saga",
            visibleTo: "client",
            channel: "app",
            body: `${talent.name} accepted the terms. You can approve and book now.`,
            timestamp: timestampFor(messageIndex + 1),
          },
        ],
      };
      return {
        conversations: upsertConversation(state.conversations, nextConversation),
      };
    }),

  approveTerms: (conversationId) =>
    set((state) => {
      const conversation = getConversation(state.conversations, conversationId);
      if (!conversation) return state;
      const project = getProject(state.projects, conversation.projectId);
      if (!project) return state;
      const nextConversation: RelayConversation = {
        ...conversation,
        status: "booked",
        sagaSummary: "Talent booked. Saga turned the relay into confirmed production terms.",
        nextActions: ["Kickoff", "Assign deliverables", "Share timeline"],
        extractedTerms: {
          ...conversation.extractedTerms,
          status: "booked",
        },
      };

      const updatedProjects = state.projects.map((entry) => {
        if (entry.id !== project.id) return entry;
        const updated = updateRole(entry, conversation.roleId, (role) => ({
          ...role,
          status: "booked",
          selectedTalentIds: unique([conversation.talentId, ...role.selectedTalentIds]),
        }));
        return {
          ...updated,
          status: "in-production" as const,
          bookedTalentIds: unique([conversation.talentId, ...updated.bookedTalentIds]),
          deliverables: updated.deliverables.map((deliverable, index) =>
            index === 0 && !deliverable.ownerTalentId
              ? { ...deliverable, ownerTalentId: conversation.talentId, status: "in-progress" as const }
              : deliverable
          ),
        };
      });

      return {
        conversations: upsertConversation(state.conversations, nextConversation),
        projects: updatedProjects,
      };
    }),
}));
