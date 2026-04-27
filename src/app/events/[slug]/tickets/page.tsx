import { AppFrame } from "@/components/AppFrame";
import { RouteHydrator } from "@/components/RouteHydrator";
import { TicketCheckoutView } from "@/components/TicketCheckoutView";

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AppFrame>
      <RouteHydrator route="tickets" eventSlug={slug} />
      <div className="absolute inset-0">
        <TicketCheckoutView eventSlug={slug} />
      </div>
    </AppFrame>
  );
}
