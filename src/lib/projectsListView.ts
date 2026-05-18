/**
 * Server-side loader for `/projects` — the "your projects" landing page.
 *
 * Returns the projects owned by the supplied cookie session. The current
 * schema couples a `WebSession` to a single `Project` via
 * `WebSession.projectId`, so today this returns 0 or 1 projects. The shape
 * is a list so the page UI works unchanged when an identity layer (Person
 * → multiple sessions → multiple projects) arrives in Phase 2/3.
 *
 * Framework-agnostic data shaping; the page component renders the result.
 * Liftable into `apps/app-server` during backend convergence without
 * touching the contract.
 */

import { getDb } from "@/sms-engine/db";
import { getOrCreateJourney } from "@/lib/journey/service";
import type { ProjectJourney } from "@/lib/journey/types";

export type ProjectListItem = {
  projectId: string;
  /** Falls back to "Your project" when the brief hasn't named the project yet. */
  title: string;
  description: string | null;
  city: string | null;
  targetDate: string | null;
  journey: ProjectJourney;
  updatedAt: Date;
};

export type ProjectsListData = {
  /** Empty array when the session has no project — page renders the empty state. */
  projects: ProjectListItem[];
};

/**
 * Load the projects this session can see. Returns `{ projects: [] }` (never
 * throws) when the session id is missing, the session row doesn't exist,
 * the session has no projectId set, or the referenced Project was deleted.
 *
 * The journey is loaded via `getOrCreateJourney`, which means a project
 * that was created before the journey state machine landed still gets a
 * default 'intake' journey row on first read.
 */
export async function loadProjectsListView(
  sessionId: string | null | undefined,
): Promise<ProjectsListData> {
  if (!sessionId) return { projects: [] };

  const session = await getDb().webSession.findUnique({
    where: { id: sessionId },
    select: { projectId: true },
  });
  if (!session?.projectId) return { projects: [] };

  const project = await getDb().project.findUnique({
    where: { id: session.projectId },
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      targetDate: true,
      updatedAt: true,
    },
  });
  if (!project) return { projects: [] };

  const journey = await getOrCreateJourney(project.id);

  return {
    projects: [
      {
        projectId: project.id,
        title: project.title || "Your project",
        description: project.description,
        city: project.city,
        targetDate: project.targetDate,
        journey,
        updatedAt: project.updatedAt,
      },
    ],
  };
}
