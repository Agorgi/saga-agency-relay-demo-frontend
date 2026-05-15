import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { LandingHero } from "@/components/LandingHero";

export default function HomePage() {
  return (
    <AppFrame composer={false}>
      <div className="relative z-10 h-full overflow-hidden">
        <Suspense fallback={null}>
          <LandingHero />
        </Suspense>
      </div>
    </AppFrame>
  );
}
