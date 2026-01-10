import { HydrateClient, api } from "~/trpc/server";
import AdminPrizesClient from "./_components/AdminPrizesClient";

export default async function AdminPrizesPage() {
  await api.prizes.listAll.prefetch();
  return (
    <HydrateClient>
      <AdminPrizesClient />
    </HydrateClient>
  );
}
