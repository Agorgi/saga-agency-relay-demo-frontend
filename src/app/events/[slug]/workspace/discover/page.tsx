import { AppFrame } from "@/components/AppFrame";
import { RouteHydrator } from "@/components/RouteHydrator";
import { WorkspaceDiscoverScene } from "@/components/WorkspaceDiscoverScene";

export default async function WorkspaceDiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { slug } = await params;
  const { role } = await searchParams;

  return (
    <AppFrame>
      <RouteHydrator route="discover" eventSlug={slug} role={role || null} />
      <WorkspaceDiscoverScene />
    </AppFrame>
  );
}
