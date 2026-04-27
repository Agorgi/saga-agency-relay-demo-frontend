import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { ExploreTalentView } from "@/components/ExploreTalentView";

export default function TalentPage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <ExploreTalentView />
        </Suspense>
      </div>
    </AppFrame>
  );
}
