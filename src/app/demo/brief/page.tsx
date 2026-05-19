import { SagaShell } from "@/components/saga/SagaShell";
import { SagaBriefView } from "@/components/saga/SagaBriefView";

export default function DemoBriefPage() {
  return (
    <SagaShell
      back={{ href: "/chat", label: "edit with Sagasan" }}
      version="// 02"
      time="9:48"
      underline
    >
      <SagaBriefView />
    </SagaShell>
  );
}
