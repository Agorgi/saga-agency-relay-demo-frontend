import { AppFrame } from "@/components/AppFrame";
import { SpacesView } from "@/components/SpacesView";

export default async function SpacesPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const params = await searchParams;
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <SpacesView
          encodedPrefill={typeof params.prefill === "string" ? params.prefill : null}
        />
      </div>
    </AppFrame>
  );
}
