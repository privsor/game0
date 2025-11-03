import { HydrateClient, api } from "~/trpc/server";
import AdminGiftsClient from "./_components/AdminGiftsClient";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { redirect } from "next/navigation";

export default async function AdminGiftsPage() {
  // Server-side admin guard
  const session = await auth();
  const allow = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !allow.includes(email)) {
    redirect("/");
  }

  // Prefetch all gifts for hydration
  await api.gifts.listAll.prefetch();

  return (
    <HydrateClient>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
            <p className="text-white/60">Manage the gift catalog and availability.</p>
          </div>
        </div>
        <AdminGiftsClient />
      </main>
    </HydrateClient>
  );
}
