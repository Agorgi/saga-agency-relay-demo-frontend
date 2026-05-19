import { SagaShell } from "@/components/saga/SagaShell";
import { SagaCandidatesView } from "@/components/saga/SagaCandidatesView";

export default function DemoCandidatesPage() {
  return (
    <SagaShell
      back={{ href: "/demo/crew", label: "back to crew" }}
      version="// 04"
      time="9:55"
      underline
    >
      <SagaCandidatesView />
    </SagaShell>
  );
}
