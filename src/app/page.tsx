import { AppFrame } from "@/components/AppFrame";
import { LandingHero } from "@/components/LandingHero";

export default function HomePage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <LandingHero />
      </div>
    </AppFrame>
  );
}
