import { AppFrame } from "@/components/AppFrame";
import { ProjectsDashboardView } from "@/components/ProjectsDashboardView";

export default function MyEventsAliasPage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectsDashboardView />
      </div>
    </AppFrame>
  );
}
