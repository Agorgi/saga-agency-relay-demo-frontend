import { AppFrame } from "@/components/AppFrame";
import { ForMeView } from "@/components/ForMeView";

export default function MePage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ForMeView />
      </div>
    </AppFrame>
  );
}
