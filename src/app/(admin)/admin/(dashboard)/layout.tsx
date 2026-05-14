import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/sms-engine/adminAuth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
