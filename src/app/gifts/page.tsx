import { HydrateClient, api } from "~/trpc/server";
import GiftsClient from "./_components/GiftsClient";

export default async function GiftsPage() {
  // Prefetch initial data for hydration: balance, gifts, and user's purchases
  await Promise.all([
    api.wallet.getBalance.prefetch(),
    api.gifts.listActive.prefetch(),
    api.gifts.myPurchases.prefetch(),
  ]);

  return (
    <HydrateClient>
      <GiftsClient />
    </HydrateClient>
  );
}
