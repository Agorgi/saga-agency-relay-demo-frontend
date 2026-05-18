/**
 * /projects — "your projects" list page.
 *
 * Pure presentational component. The page route loads the session's
 * projects via `loadProjectsListView` and passes them in. When the list
 * is empty (no session, expired cookie, brand-new visitor) the page
 * renders an honest empty state pointing the user to `/chat`.
 *
 * Intentionally minimal:
 * - one card per project (today max 1 per session; multiple supported by the
 *   data shape so we don't refactor when an identity layer arrives)
 * - status chip with the human-readable journey step
 * - single primary CTA → `/projects/[id]` (the brief review page)
 *
 * No competing actions. No fixture data. Honest "0 projects" state for
 * sessions that haven't briefed a project yet.
 */

import Link from "next/link";
import type { ProjectsListData } from "@/lib/projectsListView";
import type { ProjectJourneyStep } from "@/lib/journey/types";

const STEP_LABELS: Record<ProjectJourneyStep, string> = {
  intake: "Brief in progress",
  brief_ready: "Brief ready — build your crew",
  crew_reviewing: "Reviewing candidates",
  outreach_prep: "Preparing outreach",
  outreach_awaiting_send: "Outreach waiting on A2P",
  outreach_sent: "Outreach sent",
  archived: "Archived",
};

export function MyProjectsView({ data }: { data: ProjectsListData }) {
  const { projects } = data;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Your projects
        </h1>
        <p className="text-sm text-zinc-500">
          Pick up where you left off.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <section aria-labelledby="project-list" className="flex flex-col gap-4">
          <h2 id="project-list" className="sr-only">
            Project list
          </h2>
          {projects.map((project) => (
            <ProjectCard key={project.projectId} project={project} />
          ))}
        </section>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-dashed border-zinc-300 p-8 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-base text-zinc-900">No projects yet.</p>
        <p className="text-sm text-zinc-500">
          Tell Sagasan what you want to make and the brief will land here.
        </p>
      </div>
      <Link
        href="/chat"
        className="inline-flex items-center justify-center self-center rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
      >
        Start with Sagasan
      </Link>
    </section>
  );
}

function ProjectCard({
  project,
}: {
  project: ProjectsListData["projects"][number];
}) {
  const stepLabel = STEP_LABELS[project.journey.step];
  const facts: string[] = [];
  if (project.city) facts.push(project.city);
  if (project.targetDate) facts.push(project.targetDate);
  const factLine = facts.join(" · ");

  return (
    <Link
      href={`/projects/${project.projectId}`}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 transition hover:border-zinc-300 hover:shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900">
          {project.title}
        </h3>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
          {stepLabel}
        </span>
      </div>
      {factLine ? (
        <p className="text-sm text-zinc-500">{factLine}</p>
      ) : null}
      {project.description ? (
        <p className="text-sm leading-relaxed text-zinc-700">
          {project.description}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">
        Last updated {formatRelative(project.updatedAt)}
      </p>
    </Link>
  );
}

/**
 * Tiny relative-time helper for "Last updated" labels. Keeps the view
 * dependency-free — `Intl.RelativeTimeFormat` ships in every Node + browser
 * we target. Internal: presentational, not on the data contract.
 */
function formatRelative(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diffSec = Math.round((then - now) / 1000);
  const absSec = Math.abs(diffSec);

  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absSec < 60) return fmt.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return fmt.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return fmt.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return fmt.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return fmt.format(diffMonth, "month");
  const diffYear = Math.round(diffMonth / 12);
  return fmt.format(diffYear, "year");
}
