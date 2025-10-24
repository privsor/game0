"use client";

import * as Ably from "ably";
import { nanoid } from "nanoid";

let cached: Ably.Realtime | null = null;

export function getClient(): Ably.Realtime {
  if (cached) return cached;

  const clientId =
    process.env.NEXT_PUBLIC_ABLY_CLIENT_ID ||
    (typeof window !== "undefined" &&
      (localStorage.getItem("ablyClientId") ||
        ((): string => {
          const id = `u_${nanoid(8)}`;
          try {
            localStorage.setItem("ablyClientId", id);
          } catch {}
          return id;
        })()));

  cached = new Ably.Realtime({
    clientId: (clientId || undefined) as string | undefined,
    authUrl: "/api/ably/token",
    authMethod: "GET",
    queryTime: true,
    transportParams: {},
  });

  return cached;
}

export async function getChannel(name: string, options?: any): Promise<any> {
  const client = getClient();
  await new Promise<void>((resolve) => {
    if (client.connection.state === "connected") return resolve();
    const onConnected = () => {
      client.connection.off("connected", onConnected);
      resolve();
    };
    client.connection.on("connected", onConnected);
  });
  return (client.channels as any).get(name, options);
}
