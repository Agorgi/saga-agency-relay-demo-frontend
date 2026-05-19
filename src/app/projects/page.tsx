/**
 * /projects — landing page for return users.
 *
 * Reads the cookie session, looks up the projects it owns via
 * `loadProjectsListView`, and renders MyProjectsView. When the session is
 * missing, expired, or has no project yet, the loader returns an empty
 * list and the page renders an honest empty state with a CTA into chat.
 *
 * Stable URL: a design partner can bookmark `/projects` and always reach
 * either their project or the "start" CTA, even after the cookie session
 * has been replaced.
 *
 * Auth note: nothing here leaks across sessions — the loader keys on
 * `WebSession.projectId` for the requesting cookie, so a stranger with
 * the URL sees their own (likely empty) projects list, not someone
 * else's.
 *
 * Defensive: if the loader throws (DB unreachable, Prisma error), surface
 * an empty state rather than letting the error escape to a blank screen
 * — same pattern PR #35 applied to the brief review page.
 */

import { cookies } from "next/headers";
import { MyProjectsView } from "@/components/projects/MyProjectsView";
import { SagaShell } from "@/components/saga/SagaShell";
import {
  loadProjectsListView,
  type ProjectsListData,
} from "@/lib/projectsListView";
import { WEB_SESSION_COOKIE_NAME } from "@/lib/webChatSessionStore";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;

  let data: ProjectsListData = { projects: [] };
  try {
    data = await loadProjectsListView(sessionId);
  } catch (error) {
    logServerError("loadProjectsListView", error);
    data = { projects: [] };
  }

  return (
    <SagaShell state="PROJECTS">
      <MyProjectsView data={data} />
    </SagaShell>
  );
}
