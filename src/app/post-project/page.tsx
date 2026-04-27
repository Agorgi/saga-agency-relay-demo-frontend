import { AppFrame } from "@/components/AppFrame";
import { ProjectBriefBuilderView } from "@/components/ProjectBriefBuilderView";

export default function PostProjectPage() {
  return (
    <AppFrame chrome={false} composer={false}>
      <div className="absolute inset-0">
        <ProjectBriefBuilderView />
      </div>
    </AppFrame>
  );
}
