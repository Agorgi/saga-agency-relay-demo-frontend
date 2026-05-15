import { AppFrame } from "@/components/AppFrame";
import { ProjectPreviewView } from "@/components/ProjectPreviewView";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppFrame composer={false}>
      <div className="absolute inset-0">
        <ProjectPreviewView
          encodedPrefill={typeof params.prefill === "string" ? params.prefill : null}
        />
      </div>
    </AppFrame>
  );
}
