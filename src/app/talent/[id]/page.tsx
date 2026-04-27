import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { TalentProfileView } from "@/components/TalentProfileView";

export default async function TalentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <TalentProfileView talentSlug={id} />
        </Suspense>
      </div>
    </AppFrame>
  );
}
