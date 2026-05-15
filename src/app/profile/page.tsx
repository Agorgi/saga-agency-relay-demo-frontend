import { AppFrame } from "@/components/AppFrame";
import { ForMeView } from "@/components/ForMeView";

export default function ProfilePage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ForMeView legacyHeader />
      </div>
    </AppFrame>
  );
}
