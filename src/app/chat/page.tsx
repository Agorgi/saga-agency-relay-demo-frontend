import { SagaShell } from "@/components/saga/SagaShell";
import { SagaChatView } from "@/components/saga/SagaChatView";

export default function ChatPage() {
  return (
    <SagaShell
      state="01 · LIVE"
      version="// 01"
      dot="live"
      time="9:43"
      underline
    >
      <SagaChatView />
    </SagaShell>
  );
}
