import { AppFrame } from "@/components/AppFrame";
import { ProjectDetailView } from "@/components/ProjectDetailView";
import { RouteHydrator } from "@/components/RouteHydrator";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <RouteHydrator route="event" eventSlug={slug} />
      <div className="absolute inset-0">
        <ProjectDetailView eventSlug={slug} />
      </div>
    </AppFrame>
  );
}
