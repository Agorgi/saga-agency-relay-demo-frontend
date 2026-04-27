import { AppFrame } from "@/components/AppFrame";
import { CommunityFeedView } from "@/components/CommunityFeedView";
import { RouteHydrator } from "@/components/RouteHydrator";

export default function FeedPage() {
  return (
    <AppFrame>
      <RouteHydrator route="feed" />
      <div className="absolute inset-0">
        <CommunityFeedView />
      </div>
    </AppFrame>
  );
}
