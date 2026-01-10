import { HydrateClient, api } from "~/trpc/server";
import PrizeClient from "./_components/PrizeClient";

export default async function GiftsPage() {
  // Prefetch initial data for hydration: balance, gifts, and user's purchases
  // Only prefetch public data; auth-protected data is fetched client-side when authenticated
  await Promise.all([
    api.prizes.listGrouped.prefetch(),
  ]);

  return (
    <HydrateClient>
      <PrizeClient />
    </HydrateClient>
  );
}
