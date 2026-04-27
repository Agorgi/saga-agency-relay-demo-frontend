import { AppFrame } from "@/components/AppFrame";
import { AssemblyView } from "@/components/AssemblyView";
import { RouteHydrator } from "@/components/RouteHydrator";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <RouteHydrator route="workspace" eventSlug={slug} />
      <div className="absolute inset-0">
        <AssemblyView eventSlug={slug} />
      </div>
    </AppFrame>
  );
}
