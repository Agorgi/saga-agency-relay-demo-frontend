import { AppFrame } from "@/components/AppFrame";
import { OutreachView } from "@/components/OutreachView";
import { RouteHydrator } from "@/components/RouteHydrator";

export default async function OutreachPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <RouteHydrator route="outreach" eventSlug={slug} />
      <div className="absolute inset-0">
        <OutreachView eventSlug={slug} />
      </div>
    </AppFrame>
  );
}
