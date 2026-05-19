import { SagaShell } from "@/components/saga/SagaShell";
import { SagaCrewView } from "@/components/saga/SagaCrewView";

export default function DemoCrewPage() {
  return (
    <SagaShell
      back={{ href: "/demo/brief", label: "edit brief" }}
      version="// 03"
      time="9:51"
      underline
    >
      <SagaCrewView />
    </SagaShell>
  );
}
