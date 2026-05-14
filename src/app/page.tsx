import { AppFrame } from "@/components/AppFrame";
import { LandingHero } from "@/components/LandingHero";

export default function HomePage() {
  return (
    <AppFrame composer={false}>
      <div className="relative z-10 h-full overflow-y-auto">
        <LandingHero />
      </div>
    </AppFrame>
  );
}
