"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

type RouteKind =
  | "landing"
  | "explore"
  | "feed"
  | "my-events"
  | "profile"
  | "create"
  | "event"
  | "tickets"
  | "apply"
  | "workspace"
  | "discover"
  | "outreach";

export function RouteHydrator({
  route,
  eventSlug,
  role,
}: {
  route: RouteKind;
  eventSlug?: string;
  role?: string | null;
}) {
  const events = useAppStore((state) => state.events);
  const goHome = useAppStore((state) => state.goHome);
  const goExplore = useAppStore((state) => state.goExplore);
  const goFeed = useAppStore((state) => state.goFeed);
  const goMyEvents = useAppStore((state) => state.goMyEvents);
  const goProfile = useAppStore((state) => state.goProfile);
  const openCreate = useAppStore((state) => state.openCreate);
  const openEvent = useAppStore((state) => state.openEvent);
  const openTickets = useAppStore((state) => state.openTickets);
  const openApply = useAppStore((state) => state.openApply);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const returnToCanvas = useAppStore((state) => state.returnToCanvas);
  const launchProject = useAppStore((state) => state.launchProject);

  const event = eventSlug ? events.find((item) => item.slug === eventSlug) : null;
  const eventId = event?.id ?? null;

  useEffect(() => {
    if (route === "landing") {
      goHome();
      return;
    }

    if (route === "explore") {
      goExplore();
      return;
    }

    if (route === "feed") {
      goFeed();
      return;
    }

    if (route === "my-events") {
      goMyEvents();
      return;
    }

    if (route === "profile") {
      goProfile();
      return;
    }

    if (route === "create") {
      openCreate();
      return;
    }

    if (!eventId) return;

    if (route === "event") {
      openEvent(eventId);
      return;
    }

    if (route === "tickets") {
      openTickets(eventId);
      return;
    }

    if (route === "apply") {
      openApply(eventId);
      return;
    }

    if (route === "workspace") {
      openWorkspace(eventId);
      return;
    }

    if (route === "discover") {
      openWorkspace(eventId);
      returnToCanvas(role || null);
      return;
    }

    if (route === "outreach") {
      openWorkspace(eventId);
      launchProject();
    }
  }, [
    eventId,
    goExplore,
    goFeed,
    goHome,
    goMyEvents,
    goProfile,
    launchProject,
    openApply,
    openCreate,
    openEvent,
    openTickets,
    openWorkspace,
    returnToCanvas,
    role,
    route,
  ]);

  return null;
}
