import { AppFrame } from "@/components/AppFrame";
import { ForMeView } from "@/components/ForMeView";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ForMeView
          encodedPrefill={typeof params.prefill === "string" ? params.prefill : null}
        />
      </div>
    </AppFrame>
  );
}
