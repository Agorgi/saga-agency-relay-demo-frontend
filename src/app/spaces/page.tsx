import { AppFrame } from "@/components/AppFrame";
import { SpacesView } from "@/components/SpacesView";

export default function SpacesPage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <SpacesView />
      </div>
    </AppFrame>
  );
}
