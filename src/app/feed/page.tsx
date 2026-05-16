import { AppFrame } from "@/components/AppFrame";
import { FanFeedView } from "@/components/FanFeedView";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const params = await searchParams;
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <FanFeedView
          encodedPrefill={typeof params.prefill === "string" ? params.prefill : null}
        />
      </div>
    </AppFrame>
  );
}
