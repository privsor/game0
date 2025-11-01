import * as Ably from "ably";
import { env } from "~/env";

// Singleton Ably REST client for server-side publish
let restClient: Ably.Rest | null = null;

function getRest(): Ably.Rest {
  if (!restClient) {
    restClient = new Ably.Rest(env.ABLY_API_KEY);
  }
  return restClient;
}

export async function publishWalletUpdate(
  userId: string,
  payload: { balance: number; delta?: number; txId?: string; reason?: string },
) {
  const rest = getRest();
  const channel = rest.channels.get(`wallet:${userId}`);
  await channel.publish("updated", payload);
}
