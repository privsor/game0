import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = (await req.json()) as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    // Verify signature
    const hmac = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (hmac !== razorpay_signature) {
      return NextResponse.json({ error: "SIGNATURE_INVALID" }, { status: 400 });
    }

    // Fetch order to read notes (coins, userId)
    const basicAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("Razorpay get order error:", text);
      return NextResponse.json({ error: "ORDER_FETCH_FAILED" }, { status: 500 });
    }
    const order = (await orderRes.json()) as any;
    const orderNotes = order?.notes ?? {};
    const coins = Number(orderNotes.coins ?? 0);
    const notedUserId = String(orderNotes.userId ?? "");

    if (!coins || ![10, 30, 100, 200].includes(coins)) {
      return NextResponse.json({ error: "INVALID_NOTES" }, { status: 400 });
    }
    if (notedUserId !== userId) {
      return NextResponse.json({ error: "USER_MISMATCH" }, { status: 403 });
    }

    // Idempotency: check if a txn with this order already exists
    const existingTxn = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.reason, `payment:${razorpay_order_id}`))
      .limit(1);
    if (existingTxn.length > 0) {
      return NextResponse.json({ ok: true, credited: false });
    }

    // Credit coins
    await db.transaction(async (tx) => {
      const current = (
        await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
      )[0];
      const newBalance = (current?.balance ?? 0) + coins;
      if (!current) {
        await tx.insert(wallets).values({ userId, balance: newBalance });
      } else {
        await tx.update(wallets).set({ balance: newBalance }).where(eq(wallets.userId, userId));
      }
      await tx.insert(walletTransactions).values({
        userId,
        amount: coins,
        type: "earn",
        reason: `payment:${razorpay_order_id}`,
      });
    });

    return NextResponse.json({ ok: true, credited: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
