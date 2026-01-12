import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { db } from "~/server/db";
import { wallets, walletTransactions, users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const Body = z.object({
  id: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase() || "";
    const allow = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!email || !allow.includes(email)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = Body.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid-input" }, { status: 400 });
    const { id, delta, reason } = parsed.data;

    const target = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0] as any;
    if (!target || !target.isFako) return NextResponse.json({ error: "not-fako" }, { status: 400 });

    const newBalance = await db.transaction(async (tx) => {
      const current = (
        await tx.select().from(wallets).where(eq(wallets.userId, id)).limit(1)
      )[0];
      const nextBalance = (current?.balance ?? 0) + delta;
      if (!current) {
        await tx.insert(wallets).values({ userId: id, balance: nextBalance });
      } else {
        await tx.update(wallets).set({ balance: nextBalance }).where(eq(wallets.userId, id));
      }
      await tx.insert(walletTransactions).values({
        userId: id,
        amount: delta,
        type: delta >= 0 ? "earn" : "spend",
        reason: reason || (delta >= 0 ? "admin_adjust_plus" : "admin_adjust_minus"),
      });
      return nextBalance;
    });

    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (err) {
    console.error("/admin/fako/users/wallet/adjust error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
