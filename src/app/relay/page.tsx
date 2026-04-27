import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { RelayInboxView } from "@/components/RelayInboxView";

export default function RelayPage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <RelayInboxView />
        </Suspense>
      </div>
    </AppFrame>
  );
}
