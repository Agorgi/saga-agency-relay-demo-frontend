import { redirect } from "next/navigation";
import { loginAdmin } from "@/app/(admin)/admin/actions";
import { isAdminAuthenticated } from "@/sms-engine/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdminAuthenticated()) {
    redirect("/admin/projects");
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <section className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Saga Ops
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Public SMS intake, outreach, and group chat control center.
          </p>
        </div>
        <form action={loginAdmin} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-300">
            Admin password
            <input
              name="password"
              type="password"
              required
              placeholder="Enter admin password"
              className="mt-2 w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-50 outline-none ring-0 transition placeholder:text-zinc-500 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-400/30"
            />
          </label>
          {params.error ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              That password did not match.
            </p>
          ) : null}
          <button className="w-full rounded-md bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white">
            Enter dashboard
          </button>
        </form>
      </section>
    </main>
  );
}
