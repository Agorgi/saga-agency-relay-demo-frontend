import { AppFrame } from "@/components/AppFrame";
import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProfileView />
      </div>
    </AppFrame>
  );
}
