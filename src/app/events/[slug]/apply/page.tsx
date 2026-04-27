import { AppFrame } from "@/components/AppFrame";
import { ApplyFlowView } from "@/components/ApplyFlowView";
import { RouteHydrator } from "@/components/RouteHydrator";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <RouteHydrator route="apply" eventSlug={slug} />
      <div className="absolute inset-0">
        <ApplyFlowView eventSlug={slug} />
      </div>
    </AppFrame>
  );
}
