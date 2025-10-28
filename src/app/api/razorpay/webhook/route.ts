import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "~/env";
import { db } from "~/server/db";
import { wallets, walletTransactions } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// Razorpay webhook: verifies with RAZORPAY_WEBHOOK_SECRET and credits coins from order notes
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature");
    const bodyText = await req.text();
    if (!signature) return NextResponse.json({ error: "NO_SIGNATURE" }, { status: 400 });

    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyText)
      .digest("hex");

    if (expected !== signature) {
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
    }

    const payload = JSON.parse(bodyText);

    // We care about payment.authorized or payment.captured events associated with an order
    const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
    const orderId: string | undefined = entity?.order_id ?? payload?.payload?.order?.entity?.id;

    if (!orderId) return NextResponse.json({ ok: true }); // ignore others

    // Razorpay order fetch to read notes
    const basicAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("Webhook: failed to fetch order:", text);
      return NextResponse.json({ error: "ORDER_FETCH_FAILED" }, { status: 500 });
    }
    const order = (await orderRes.json()) as any;
    const notes = order?.notes ?? {};
    const coins = Number(notes.coins ?? 0);
    const userId = String(notes.userId ?? "");

    if (!userId || !coins || ![10, 30, 100, 200].includes(coins)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Idempotency check
    const existing = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.reason, `payment:${orderId}`))
      .limit(1);
    if (existing.length > 0) return NextResponse.json({ ok: true, credited: false });

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
        reason: `payment:${orderId}`,
      });
    });

    return NextResponse.json({ ok: true, credited: true });
  } catch (err) {
    console.error("Webhook error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
