import { NextResponse } from "next/server";
import { getRedis } from "~/server/redis";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { walletTransactions, wallets } from "~/server/db/schema";

// Toggle DaddyCoins mode for the current player in a room.
// POST body: { room: string, enable: boolean }
export async function POST(req: Request) {
  try {
    const redis = getRedis();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const body = await req.json();
    const room: string = String(body?.room || "").toUpperCase();
    const enable: boolean = !!body?.enable;

    if (!room) return NextResponse.json({ error: "invalid-input" }, { status: 400 });

    const key = `ttt:room:${room}`;
    // Determine role bindings
    const vals = await (redis as any).hmget(key, "x", "o");
    const px = String(vals?.x ?? "");
    const po = String(vals?.o ?? "");

    const userId = session.user.id;
    const role: "X" | "O" | null = userId === px ? "X" : userId === po ? "O" : null;
    if (!role) return NextResponse.json({ error: "not-player" }, { status: 403 });

    const isX = role === "X";
    const modeField = isX ? "cmx" : "cmo";
    const chargedField = isX ? "cmxd" : "cmod";

    if (enable) {
      // If not charged yet for this game, charge 1 DaddyCoin
      const charged = String((await (redis as any).hget(key, chargedField)) ?? "0");
      if (charged !== "1") {
        // Deduct 1 from wallet, if sufficient
        await db.transaction(async (tx) => {
          const current = (
            await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
          )[0];
          const bal = current?.balance ?? 0;
          if (bal < 1) {
            throw new Error("INSUFFICIENT_COINS");
          }
          await tx.update(wallets).set({ balance: bal - 1 }).where(eq(wallets.userId, userId));
          await tx.insert(walletTransactions).values({
            userId,
            amount: -1,
            type: "spend",
            reason: `ttt:entry:${room}:${role}`,
          });
        });
        // mark charged
        await (redis as any).hset(key, chargedField, "1");
      }
    }

    await (redis as any).hset(key, modeField, enable ? "1" : "0");
    // keep TTL alive
    await (redis as any).pexpire(key, 24 * 60 * 60 * 1000);

    return NextResponse.json({ ok: true, role, enabled: enable });
  } catch (err: any) {
    if (String(err?.message) === "INSUFFICIENT_COINS") {
      return NextResponse.json({ error: "INSUFFICIENT_COINS" }, { status: 400 });
    }
    console.error("/api/tictactoe/coinsmode error", err);
    return NextResponse.json({ error: "server-error" }, { status: 500 });
  }
}
