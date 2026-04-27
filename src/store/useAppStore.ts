import { create } from "zustand";
import {
  analyzeBrief,
  buildGroupChat,
  buildOutreachThreads,
  CREATORS,
  CreatorMatch,
  generateDeepResults,
  getInitialCanvasCreators,
  getSimilarCreators,
  type BriefAnalysis,
  type GroupChat,
  type OutreachThread,
} from "@/data/talentData";
import {
  buildEventFromDraft,
  buildEventQuery,
  buildTeamSlotsFromEvent,
  buildWorkspaceEvent,
  DEFAULT_CREATE_EVENT_DRAFT,
  getEventById,
  INITIAL_EVENTS,
  INITIAL_OWNED_TICKETS,
  INITIAL_VIEWER_PROFILE,
  syncEventMetrics,
  syncEventWithTeamSlots,
  type Application,
  type ApplicationRole,
  type CreateEventDraft,
  type EventProject,
  type FeedTab,
  type OwnedTicket,
  type Post,
  type UserProfile,
} from "@/data/sagaPlatformData";

export type AppPhase =
  | "landing"
  | "explore"
  | "event"
  | "tickets"
  | "my-events"
  | "profile"
  | "feed"
  | "creating"
  | "apply"
  | "analyzing"
  | "canvas"
  | "focus"
  | "workspace"
  | "outreach";

interface ApplyDraft {
  roleType: ApplicationRole;
  contribution: string;
  portfolioUrl: string;
  note: string;
  availabilityConfirmed: boolean;
}

interface AppState {
  phase: AppPhase;
  query: string;
  analysis: BriefAnalysis | null;
  detectedRoles: string[];
  activeRoleFilter: string | null;
  canvasCreators: CreatorMatch[];
  hoveredCreatorId: string | null;
  focusedCreator: CreatorMatch | null;
  similarCreators: CreatorMatch[];
  selectedCreatorIds: Set<string>;
  shortlistIds: Set<string>;
  teamSlots: Record<string, CreatorMatch>;
  depthLevel: number;
  draftEvent: CreateEventDraft;
  events: EventProject[];
  selectedEventId: string | null;
  eventSearchQuery: string;
  ownedTickets: OwnedTicket[];
  activeTicketId: string | null;
  ticketSelections: Record<string, number>;
  viewerProfile: UserProfile;
  activeFeedTab: FeedTab;
  applyDraft: ApplyDraft;
  postComposerOpen: boolean;
  composeEventId: string | null;
  postDraftCaption: string;
  outreachThreads: OutreachThread[];
  outreachReady: boolean;
  groupChat: GroupChat | null;

  setQuery: (query: string) => void;
  executeSearch: (query?: string) => void;
  openCreate: () => void;
  closeCreate: () => void;
  updateDraftEvent: (patch: Partial<CreateEventDraft>) => void;
  toggleDraftRole: (role: string) => void;
  submitDraftEvent: () => void;
  updateLiveBrief: (patch: Partial<Pick<BriefAnalysis, "location" | "budget" | "timeline">>) => void;
  setLiveBriefRoles: (rolesText: string) => void;
  setHoveredCreator: (id: string | null) => void;
  setActiveRoleFilter: (role: string | null) => void;
  focusCreator: (creator: CreatorMatch) => void;
  closeFocus: () => void;
  toggleCreatorSelection: (id: string) => void;
  addCreatorToShortlist: (id: string) => void;
  removeCreatorFromShortlist: (id: string) => void;
  branchOff: (branchText: string) => void;
  goDeeper: () => void;
  assignFocusedCreator: (role?: string) => void;
  assignCreatorToRole: (role: string, creator: CreatorMatch) => void;
  removeCreatorFromRole: (role: string) => void;
  openAssembly: () => void;
  returnToCanvas: (role?: string | null) => void;
  launchProject: () => void;
  advanceOutreach: () => void;
  publishProject: () => void;
  reset: () => void;

  goHome: () => void;
  goExplore: () => void;
  goMyEvents: () => void;
  goProfile: () => void;
  goFeed: () => void;
  openEvent: (eventId: string) => void;
  openTickets: (eventId?: string) => void;
  openWorkspace: (eventId?: string) => void;
  openApply: (eventId?: string) => void;
  closeApply: () => void;
  setEventSearchQuery: (query: string) => void;
  toggleRsvp: (eventId: string) => void;
  updateTicketQuantity: (tierId: string, delta: number) => void;
  purchaseTickets: () => void;
  openTicketModal: (ticketId: string) => void;
  closeTicketModal: () => void;
  cancelTicket: (ticketId: string) => void;
  setApplyDraft: (patch: Partial<ApplyDraft>) => void;
  submitApplication: () => void;
  reviewApplication: (eventId: string, applicationId: string, status: Application["status"]) => void;
  setFeedTab: (tab: FeedTab) => void;
  openComposer: (eventId?: string | null) => void;
  closeComposer: () => void;
  updatePostDraft: (caption: string) => void;
  submitPost: () => void;
}

let analyzeTimer: ReturnType<typeof setTimeout> | null = null;
let deepenTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (analyzeTimer) clearTimeout(analyzeTimer);
  if (deepenTimer) clearTimeout(deepenTimer);
  analyzeTimer = null;
  deepenTimer = null;
}

function defaultApplyDraft(): ApplyDraft {
  return {
    roleType: "Vendor",
    contribution: "",
    portfolioUrl: "",
    note: "",
    availabilityConfirmed: true,
  };
}

function findEvent(events: EventProject[], eventId: string | null | undefined) {
  return getEventById(events, eventId);
}

function parseRolesText(rolesText: string) {
  return [...new Set(
    rolesText
      .split(/[,\n/]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  )].slice(0, 6);
}

function mergeEvent(events: EventProject[], nextEvent: EventProject) {
  const existingIndex = events.findIndex((event) => event.id === nextEvent.id);
  if (existingIndex === -1) return [nextEvent, ...events];
  const copy = [...events];
  copy[existingIndex] = nextEvent;
  return copy;
}

function ticketKey(eventId: string, tierId: string) {
  return `${eventId}:${tierId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getCurrentEvent(state: Pick<AppState, "events" | "selectedEventId">) {
  return findEvent(state.events, state.selectedEventId);
}

function getWorkspaceRoles(event: EventProject | null, analysis: BriefAnalysis | null) {
  if (event) {
    return event.productionPlan.roles.slice(0, 6).map((role) => role.name);
  }
  return analysis?.roles || [];
}

function getBestOpenRole(
  roles: string[],
  teamSlots: Record<string, CreatorMatch>,
  creator: CreatorMatch,
  activeRoleFilter: string | null
) {
  if (activeRoleFilter && roles.includes(activeRoleFilter) && !teamSlots[activeRoleFilter]) {
    return activeRoleFilter;
  }

  const unfilled = roles.filter((role) => !teamSlots[role]);
  if (creator.bestRole && unfilled.includes(creator.bestRole)) return creator.bestRole;

  const ranked = Object.entries(creator.roleMatches)
    .filter(([role]) => unfilled.includes(role))
    .sort((a, b) => b[1].score - a[1].score)[0];

  return ranked?.[0] || unfilled[0] || roles[0] || creator.bestRole;
}

function assignCreator(
  current: Record<string, CreatorMatch>,
  role: string,
  creator: CreatorMatch
) {
  const next = { ...current };
  Object.entries(next).forEach(([existingRole, existingCreator]) => {
    if (existingCreator.id === creator.id && existingRole !== role) {
      delete next[existingRole];
    }
  });
  next[role] = creator;
  return next;
}

function buildSeededTeamSlots(state: Pick<AppState, "teamSlots" | "selectedCreatorIds" | "similarCreators" | "shortlistIds" | "canvasCreators" | "analysis" | "query">) {
  let nextSlots = { ...state.teamSlots };
  const rolePool = state.analysis?.roles || [];
  const seenIds = new Set<string>();
  const shortlisted = [...state.shortlistIds]
    .map((id) => state.canvasCreators.find((creator) => creator.id === id) || null)
    .filter(Boolean) as CreatorMatch[];
  const selected = state.similarCreators.filter((creator) => state.selectedCreatorIds.has(creator.id));
  const prioritized = [...shortlisted, ...selected]
    .filter((creator) => {
      if (seenIds.has(creator.id)) return false;
      seenIds.add(creator.id);
      return true;
    })
    .sort((a, b) => b.overallScore - a.overallScore);

  prioritized.forEach((creator) => {
    const role = getBestOpenRole(rolePool, nextSlots, creator, null);
    if (role && !nextSlots[role]) {
      nextSlots = assignCreator(nextSlots, role, creator);
    }
  });

  return nextSlots;
}

function syncSelectedEvent(events: EventProject[], selectedEventId: string | null, teamSlots: Record<string, CreatorMatch>) {
  if (!selectedEventId) return events;
  return events.map((event) =>
    event.id === selectedEventId ? syncEventWithTeamSlots(event, teamSlots) : event
  );
}

function hydrateWorkspaceState(event: EventProject) {
  const query = buildEventQuery(event);
  const analysis = analyzeBrief(query);
  const roles = getWorkspaceRoles(event, analysis);
  return {
    query,
    analysis: {
      ...analysis,
      roles,
      location: event.city,
      budget: event.productionPlan.budgetRange,
    },
    detectedRoles: roles,
    teamSlots: buildTeamSlotsFromEvent(event),
    canvasCreators: getInitialCanvasCreators(query, roles),
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  phase: "landing",
  query: "",
  analysis: null,
  detectedRoles: [],
  activeRoleFilter: null,
  canvasCreators: [],
  hoveredCreatorId: null,
  focusedCreator: null,
  similarCreators: [],
  selectedCreatorIds: new Set(),
  shortlistIds: new Set(),
  teamSlots: {},
  depthLevel: 0,
  draftEvent: { ...DEFAULT_CREATE_EVENT_DRAFT, requiredRoles: [...DEFAULT_CREATE_EVENT_DRAFT.requiredRoles] },
  events: INITIAL_EVENTS,
  selectedEventId: null,
  eventSearchQuery: "",
  ownedTickets: INITIAL_OWNED_TICKETS,
  activeTicketId: null,
  ticketSelections: {},
  viewerProfile: INITIAL_VIEWER_PROFILE,
  activeFeedTab: "explore",
  applyDraft: defaultApplyDraft(),
  postComposerOpen: false,
  composeEventId: null,
  postDraftCaption: "",
  outreachThreads: [],
  outreachReady: false,
  groupChat: null,

  setQuery: (query) => set({ query }),

  executeSearch: (maybeQuery) => {
    const query = (maybeQuery || get().query).trim();
    if (!query) return;
    clearTimers();

    const analysis = analyzeBrief(query);
    const workspaceEvent = buildWorkspaceEvent(query);
    const roles = getWorkspaceRoles(workspaceEvent, analysis);

    set((state) => ({
      phase: "analyzing",
      query,
      analysis: {
        ...analysis,
        roles,
        location: workspaceEvent.city,
        budget: workspaceEvent.productionPlan.budgetRange,
      },
      detectedRoles: roles,
      selectedEventId: workspaceEvent.id,
      events: mergeEvent(state.events, workspaceEvent),
      activeRoleFilter: null,
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
      shortlistIds: new Set(),
      teamSlots: {},
      hoveredCreatorId: null,
      depthLevel: 0,
      outreachThreads: [],
      outreachReady: false,
      groupChat: null,
    }));

    analyzeTimer = setTimeout(() => {
      set({
        phase: "canvas",
        canvasCreators: getInitialCanvasCreators(query, roles),
      });
    }, 1250);
  },

  openCreate: () =>
    set({
      phase: "creating",
      draftEvent: { ...DEFAULT_CREATE_EVENT_DRAFT, requiredRoles: [...DEFAULT_CREATE_EVENT_DRAFT.requiredRoles] },
    }),

  closeCreate: () =>
    set((state) => ({
      phase: state.selectedEventId ? "workspace" : "landing",
    })),

  updateDraftEvent: (patch) =>
    set((state) => ({
      draftEvent: {
        ...state.draftEvent,
        ...patch,
        requiredRoles: patch.requiredRoles || state.draftEvent.requiredRoles,
      },
    })),

  toggleDraftRole: (role) =>
    set((state) => {
      const nextRoles = new Set(state.draftEvent.requiredRoles);
      if (nextRoles.has(role)) {
        nextRoles.delete(role);
      } else if (nextRoles.size < 8) {
        nextRoles.add(role);
      }
      return {
        draftEvent: {
          ...state.draftEvent,
          requiredRoles: [...nextRoles],
        },
      };
    }),

  submitDraftEvent: () => {
    const nextEvent = buildEventFromDraft(get().draftEvent);
    const workspaceState = hydrateWorkspaceState(nextEvent);
    set((state) => ({
      events: mergeEvent(state.events, nextEvent),
      selectedEventId: nextEvent.id,
      viewerProfile: {
        ...state.viewerProfile,
        hostingEventIds: [nextEvent.id, ...state.viewerProfile.hostingEventIds],
      },
      phase: "workspace",
      query: workspaceState.query,
      analysis: workspaceState.analysis,
      detectedRoles: workspaceState.detectedRoles,
      teamSlots: workspaceState.teamSlots,
      canvasCreators: workspaceState.canvasCreators,
      activeRoleFilter: null,
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
      shortlistIds: new Set(),
      depthLevel: 0,
      outreachThreads: [],
      outreachReady: false,
      groupChat: null,
    }));
  },

  updateLiveBrief: (patch) =>
    set((state) => {
      if (!state.analysis) return {};
      const selectedEvent = getCurrentEvent(state);
      const nextEvent = selectedEvent
        ? syncEventMetrics({
            ...selectedEvent,
            city: patch.location || selectedEvent.city,
            productionPlan: {
              ...selectedEvent.productionPlan,
              budgetRange: patch.budget || selectedEvent.productionPlan.budgetRange,
            },
          })
        : null;
      return {
        analysis: {
          ...state.analysis,
          ...patch,
        },
        events: nextEvent ? mergeEvent(state.events, nextEvent) : state.events,
      };
    }),

  setLiveBriefRoles: (rolesText) =>
    set((state) => {
      if (!state.analysis) return {};
      const nextRoles = parseRolesText(rolesText);
      if (!nextRoles.length) return {};
      return {
        analysis: {
          ...state.analysis,
          roles: nextRoles,
        },
        detectedRoles: nextRoles,
        canvasCreators: getInitialCanvasCreators(state.query, nextRoles),
        activeRoleFilter: null,
      };
    }),

  setHoveredCreator: (id) => set({ hoveredCreatorId: id }),
  setActiveRoleFilter: (role) => set({ activeRoleFilter: role }),

  focusCreator: (creator) => {
    const similarCreators = getSimilarCreators(creator, get().canvasCreators);
    set({
      phase: "focus",
      focusedCreator: creator,
      similarCreators,
      selectedCreatorIds: new Set(),
    });
  },

  closeFocus: () =>
    set({
      phase: "canvas",
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
    }),

  toggleCreatorSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedCreatorIds);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return { selectedCreatorIds: next };
    }),

  addCreatorToShortlist: (id) =>
    set((state) => {
      const next = new Set(state.shortlistIds);
      if (!next.has(id) && next.size < 8) next.add(id);
      return { shortlistIds: next };
    }),

  removeCreatorFromShortlist: (id) =>
    set((state) => {
      const next = new Set(state.shortlistIds);
      next.delete(id);
      return { shortlistIds: next };
    }),

  branchOff: (branchText) => {
    const fragment = branchText.trim();
    if (!fragment) return;
    clearTimers();

    const state = get();
    const nextQuery = `${state.query} ${fragment}`.trim();
    const analysis = analyzeBrief(nextQuery);
    const roles = state.detectedRoles.length ? state.detectedRoles : analysis.roles;

    set({
      phase: "analyzing",
      query: nextQuery,
      analysis: {
        ...analysis,
        roles,
      },
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
      hoveredCreatorId: null,
    });

    analyzeTimer = setTimeout(() => {
      set({
        phase: "canvas",
        canvasCreators: getInitialCanvasCreators(nextQuery, roles),
        depthLevel: 0,
        activeRoleFilter: null,
      });
    }, 850);
  },

  goDeeper: () => {
    const state = get();
    const selected = state.similarCreators.filter((creator) => state.selectedCreatorIds.has(creator.id));
    if (!selected.length) return;
    clearTimers();
    set({
      phase: "focus" === state.phase ? "canvas" : state.phase,
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
    });

    deepenTimer = setTimeout(() => {
      set({
        phase: "canvas",
        canvasCreators: generateDeepResults(selected, CREATORS, state.query, state.detectedRoles),
        depthLevel: state.depthLevel + 1,
        activeRoleFilter: null,
      });
    }, 520);
  },

  assignFocusedCreator: (role) => {
    const state = get();
    if (!state.focusedCreator) return;
    const targetRole = role || getBestOpenRole(state.detectedRoles, state.teamSlots, state.focusedCreator, state.activeRoleFilter);
    if (!targetRole) return;
    const teamSlots = assignCreator(state.teamSlots, targetRole, state.focusedCreator);
    set({
      teamSlots,
      events: syncSelectedEvent(state.events, state.selectedEventId, teamSlots),
    });
  },

  assignCreatorToRole: (role, creator) => {
    const state = get();
    const teamSlots = assignCreator(state.teamSlots, role, creator);
    set({
      phase: "workspace",
      teamSlots,
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
      events: syncSelectedEvent(state.events, state.selectedEventId, teamSlots),
    });
  },

  removeCreatorFromRole: (role) =>
    set((state) => {
      const nextSlots = { ...state.teamSlots };
      delete nextSlots[role];
      return {
        teamSlots: nextSlots,
        events: syncSelectedEvent(state.events, state.selectedEventId, nextSlots),
      };
    }),

  openAssembly: () =>
    set((state) => {
      const nextSlots = buildSeededTeamSlots(state);
      return {
        phase: "workspace",
        teamSlots: nextSlots,
        focusedCreator: null,
        similarCreators: [],
        selectedCreatorIds: new Set(),
        hoveredCreatorId: null,
        events: syncSelectedEvent(state.events, state.selectedEventId, nextSlots),
      };
    }),

  returnToCanvas: (role) =>
    set((state) => {
      const selectedEvent = getCurrentEvent(state);
      const workspace = selectedEvent ? hydrateWorkspaceState(selectedEvent) : null;
      const query = workspace?.query || state.query;
      const roles = workspace?.detectedRoles || state.detectedRoles;
      return {
        phase: "canvas",
        query,
        analysis: workspace?.analysis || state.analysis,
        detectedRoles: roles,
        canvasCreators: getInitialCanvasCreators(query, roles),
        activeRoleFilter: role || null,
        focusedCreator: null,
        similarCreators: [],
        selectedCreatorIds: new Set(),
      };
    }),

  launchProject: () => {
    const state = get();
    const event = getCurrentEvent(state);
    if (!event) return;
    const outreachThreads = buildOutreachThreads(
      event.title,
      event.city,
      `${event.dateLabel} ${event.timeLabel}`,
      state.teamSlots
    );
    const groupChat = buildGroupChat(event.title, state.teamSlots);
    set({
      phase: "outreach",
      outreachThreads,
      outreachReady: outreachThreads.length === 0,
      groupChat,
    });
  },

  advanceOutreach: () =>
    set((state) => {
      const event = getCurrentEvent(state);
      if (!event) return {};
      if (!state.outreachThreads.length) return { outreachReady: true };

      const nextThreads = [...state.outreachThreads];
      const queuedIndex = nextThreads.findIndex((thread) => thread.status === "queued");
      if (queuedIndex >= 0) {
        nextThreads[queuedIndex] = { ...nextThreads[queuedIndex], status: "sent" };
      } else {
        const sentIndex = nextThreads.findIndex((thread) => thread.status === "sent");
        if (sentIndex >= 0) {
          nextThreads[sentIndex] = { ...nextThreads[sentIndex], status: "accepted" };
        }
      }

      const acceptedCreatorIds = new Set(
        nextThreads
          .filter((thread) => thread.status === "accepted")
          .map((thread) => state.teamSlots[thread.role]?.id)
          .filter(Boolean)
      );

      const updatedEvent = syncEventMetrics({
        ...event,
        productionPlan: {
          ...event.productionPlan,
          roles: event.productionPlan.roles.map((role) => {
            const selectedCreator = state.teamSlots[role.name];
            const isAccepted = selectedCreator && acceptedCreatorIds.has(selectedCreator.id);
            return {
              ...role,
              status:
                role.selectedCandidateId && isAccepted
                  ? "confirmed"
                  : role.selectedCandidateId
                    ? "contacting"
                    : role.status,
            };
          }),
        },
      });

      const allAccepted = nextThreads.every((thread) => thread.status === "accepted");
      const publishedEvent = allAccepted
        ? {
            ...updatedEvent,
            status: "published" as const,
          }
        : updatedEvent;

      return {
        outreachThreads: nextThreads,
        outreachReady: allAccepted,
        events: mergeEvent(state.events, publishedEvent),
      };
    }),

  publishProject: () =>
    set((state) => {
      const event = getCurrentEvent(state);
      if (!event) return {};
      const published = syncEventMetrics({
        ...event,
        status: event.status === "published" ? "live" : "published",
      });
      return {
        phase: "event",
        events: mergeEvent(state.events, published),
      };
    }),

  reset: () => {
    clearTimers();
    set((state) => ({
      phase: "landing",
      query: "",
      analysis: null,
      detectedRoles: [],
      activeRoleFilter: null,
      canvasCreators: [],
      hoveredCreatorId: null,
      focusedCreator: null,
      similarCreators: [],
      selectedCreatorIds: new Set(),
      shortlistIds: new Set(),
      teamSlots: {},
      depthLevel: 0,
      selectedEventId: null,
      activeTicketId: null,
      ticketSelections: {},
      postComposerOpen: false,
      composeEventId: null,
      postDraftCaption: "",
      outreachThreads: [],
      outreachReady: false,
      groupChat: null,
      draftEvent: { ...DEFAULT_CREATE_EVENT_DRAFT, requiredRoles: [...DEFAULT_CREATE_EVENT_DRAFT.requiredRoles] },
      applyDraft: defaultApplyDraft(),
      viewerProfile: state.viewerProfile,
      events: state.events,
      ownedTickets: state.ownedTickets,
    }));
  },

  goHome: () => set({ phase: "landing", selectedEventId: null, activeTicketId: null }),
  goExplore: () => set({ phase: "explore", activeTicketId: null }),
  goMyEvents: () => set({ phase: "my-events" }),
  goProfile: () => set({ phase: "profile" }),
  goFeed: () => set({ phase: "feed" }),

  openEvent: (eventId) => set({ phase: "event", selectedEventId: eventId, activeTicketId: null }),

  openTickets: (eventId) =>
    set((state) => ({
      phase: "tickets",
      selectedEventId: eventId || state.selectedEventId,
    })),

  openWorkspace: (eventId) =>
    set((state) => {
      const targetEvent = findEvent(state.events, eventId || state.selectedEventId);
      if (!targetEvent) return { phase: "workspace" };
      const workspaceState = hydrateWorkspaceState(targetEvent);
      return {
        phase: "workspace",
        selectedEventId: targetEvent.id,
        query: workspaceState.query,
        analysis: workspaceState.analysis,
        detectedRoles: workspaceState.detectedRoles,
        teamSlots: workspaceState.teamSlots,
        canvasCreators: workspaceState.canvasCreators,
        activeRoleFilter: null,
        focusedCreator: null,
        similarCreators: [],
        selectedCreatorIds: new Set(),
        shortlistIds: new Set(),
      };
    }),

  openApply: (eventId) =>
    set({
      phase: "apply",
      selectedEventId: eventId || get().selectedEventId,
      applyDraft: defaultApplyDraft(),
    }),

  closeApply: () => set({ phase: "event", applyDraft: defaultApplyDraft() }),

  setEventSearchQuery: (query) => set({ eventSearchQuery: query }),

  toggleRsvp: (eventId) =>
    set((state) => {
      const attending = new Set(state.viewerProfile.attendingEventIds);
      const isAttending = attending.has(eventId);
      if (isAttending) attending.delete(eventId);
      else attending.add(eventId);

      return {
        viewerProfile: {
          ...state.viewerProfile,
          attendingEventIds: [...attending],
        },
        events: state.events.map((event) =>
          event.id === eventId
            ? syncEventMetrics({
                ...event,
                rsvpCount: Math.max(0, event.rsvpCount + (isAttending ? -1 : 1)),
              })
            : event
        ),
      };
    }),

  updateTicketQuantity: (tierId, delta) =>
    set((state) => {
      const event = getCurrentEvent(state);
      if (!event) return {};
      const tier = event.ticketTiers.find((item) => item.id === tierId);
      if (!tier) return {};
      const key = ticketKey(event.id, tierId);
      const current = state.ticketSelections[key] || 0;
      const next = clamp(current + delta, 0, Math.min(tier.remaining, tier.maxPerPerson || 6));
      return {
        ticketSelections: {
          ...state.ticketSelections,
          [key]: next,
        },
      };
    }),

  purchaseTickets: () =>
    set((state) => {
      const event = getCurrentEvent(state);
      if (!event) return {};
      const selections = event.ticketTiers
        .map((tier) => ({
          tier,
          quantity: state.ticketSelections[ticketKey(event.id, tier.id)] || 0,
        }))
        .filter((entry) => entry.quantity > 0);
      if (!selections.length) return {};

      const purchasedAt = new Date().toISOString();
      const newTickets = selections.map<OwnedTicket>((entry) => ({
        id: `${event.id}-${entry.tier.id}-${Date.now()}-${entry.quantity}`,
        eventId: event.id,
        tierId: entry.tier.id,
        quantity: entry.quantity,
        purchasedAt,
      }));

      const updatedEvent = syncEventMetrics({
        ...event,
        ticketTiers: event.ticketTiers.map((tier) => {
          const match = selections.find((entry) => entry.tier.id === tier.id);
          return match
            ? { ...tier, remaining: Math.max(0, tier.remaining - match.quantity) }
            : tier;
        }),
        rsvpCount: event.rsvpCount + selections.reduce((sum, entry) => sum + entry.quantity, 0),
      });

      return {
        phase: "my-events",
        events: mergeEvent(state.events, updatedEvent),
        ownedTickets: [...newTickets, ...state.ownedTickets],
        activeTicketId: newTickets[0]?.id || null,
        ticketSelections: Object.fromEntries(
          Object.entries(state.ticketSelections).filter(([key]) => !key.startsWith(`${event.id}:`))
        ),
        viewerProfile: {
          ...state.viewerProfile,
          attendingEventIds: state.viewerProfile.attendingEventIds.includes(event.id)
            ? state.viewerProfile.attendingEventIds
            : [event.id, ...state.viewerProfile.attendingEventIds],
        },
      };
    }),

  openTicketModal: (ticketId) => set({ activeTicketId: ticketId }),
  closeTicketModal: () => set({ activeTicketId: null }),

  cancelTicket: (ticketId) =>
    set((state) => {
      const ticket = state.ownedTickets.find((item) => item.id === ticketId);
      if (!ticket) return {};
      return {
        ownedTickets: state.ownedTickets.filter((item) => item.id !== ticketId),
        activeTicketId: null,
        events: state.events.map((event) => {
          if (event.id !== ticket.eventId) return event;
          return syncEventMetrics({
            ...event,
            ticketTiers: event.ticketTiers.map((tier) =>
              tier.id === ticket.tierId
                ? { ...tier, remaining: tier.remaining + ticket.quantity }
                : tier
            ),
            rsvpCount: Math.max(0, event.rsvpCount - ticket.quantity),
          });
        }),
      };
    }),

  setApplyDraft: (patch) =>
    set((state) => ({
      applyDraft: {
        ...state.applyDraft,
        ...patch,
      },
    })),

  submitApplication: () =>
    set((state) => {
      const event = getCurrentEvent(state);
      if (!event) return {};
      const application: Application = {
        id: `${event.id}-application-${Date.now()}`,
        eventId: event.id,
        applicantName: state.viewerProfile.name,
        applicantAvatar: state.viewerProfile.avatar,
        roleType: state.applyDraft.roleType,
        contribution: state.applyDraft.contribution,
        note: state.applyDraft.note,
        portfolioUrl: state.applyDraft.portfolioUrl,
        status: "pending",
        availabilityConfirmed: state.applyDraft.availabilityConfirmed,
        createdAt: "Just now",
      };

      return {
        phase: "event",
        applyDraft: defaultApplyDraft(),
        events: mergeEvent(
          state.events,
          syncEventMetrics({
            ...event,
            applications: [application, ...event.applications],
          })
        ),
      };
    }),

  reviewApplication: (eventId, applicationId, status) =>
    set((state) => {
      const event = findEvent(state.events, eventId);
      if (!event) return {};
      const updatedEvent = syncEventMetrics({
        ...event,
        applications: event.applications.map((application) =>
          application.id === applicationId ? { ...application, status } : application
        ),
        vendorsAndCosplayers:
          status === "accepted"
            ? [
                ...event.vendorsAndCosplayers,
                ...event.applications
                  .filter((application) => application.id === applicationId)
                  .map((application) => ({
                    id: `${application.id}-participant`,
                    name: application.applicantName,
                    avatar: application.applicantAvatar,
                    roleLabel:
                      application.roleType === "Co-host"
                        ? "Co-host"
                        : application.roleType === "Crew"
                          ? "Crew"
                          : application.roleType,
                    note: application.note,
                    tag: application.contribution,
                    portfolioUrl: application.portfolioUrl,
                  }) as const),
              ]
            : event.vendorsAndCosplayers,
      });

      return {
        events: mergeEvent(state.events, updatedEvent),
      };
    }),

  setFeedTab: (tab) => set({ activeFeedTab: tab }),

  openComposer: (eventId) =>
    set({
      postComposerOpen: true,
      composeEventId: eventId === undefined ? get().selectedEventId : eventId,
      postDraftCaption: "",
    }),

  closeComposer: () =>
    set({
      postComposerOpen: false,
      composeEventId: null,
      postDraftCaption: "",
    }),

  updatePostDraft: (caption) => set({ postDraftCaption: caption }),

  submitPost: () =>
    set((state) => {
      const caption = state.postDraftCaption.trim();
      if (!caption) return {};
      const event = findEvent(state.events, state.composeEventId);
      const post: Post = {
        id: `post-${Date.now()}`,
        authorId: state.viewerProfile.id,
        authorName: state.viewerProfile.name,
        authorAvatar: state.viewerProfile.avatar,
        imageUrl: `https://picsum.photos/seed/post-${Date.now()}/720/900`,
        caption,
        likes: 0,
        eventId: event?.id,
        eventTitle: event?.title,
        createdAt: "Just now",
      };

      return {
        postComposerOpen: false,
        composeEventId: null,
        postDraftCaption: "",
        events: event
          ? mergeEvent(
              state.events,
              syncEventMetrics({
                ...event,
                posts: [post, ...event.posts],
              })
            )
          : state.events,
        viewerProfile: {
          ...state.viewerProfile,
          posts: [post, ...state.viewerProfile.posts],
        },
      };
    }),
}));
