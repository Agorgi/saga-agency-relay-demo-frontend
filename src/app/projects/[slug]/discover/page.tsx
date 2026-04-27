import { AppFrame } from "@/components/AppFrame";
import { ProjectTalentDiscoveryView } from "@/components/ProjectTalentDiscoveryView";

export default async function ProjectDiscoverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectTalentDiscoveryView projectSlug={slug} />
      </div>
    </AppFrame>
  );
}
