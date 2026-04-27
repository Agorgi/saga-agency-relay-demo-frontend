import { AppFrame } from "@/components/AppFrame";
import { ProjectWorkspaceView } from "@/components/ProjectWorkspaceView";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectWorkspaceView projectSlug={slug} />
      </div>
    </AppFrame>
  );
}
