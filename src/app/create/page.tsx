import { AppFrame } from "@/components/AppFrame";
import { ProjectBriefBuilderView } from "@/components/ProjectBriefBuilderView";

export default function CreateAliasPage() {
  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectBriefBuilderView />
      </div>
    </AppFrame>
  );
}
