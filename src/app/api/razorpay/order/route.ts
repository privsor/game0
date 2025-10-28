import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { coinPackages } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";

// Create Razorpay Order
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { coins } = (await req.json()) as {
      coins: number; // number of DaddyCoins to credit
    };

    if (![10, 30, 100, 200].includes(coins)) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    // Determine currency from IP headers (Vercel) or default to INR
    const country = req.headers.get("x-vercel-ip-country") || "";
    const currency: "INR" | "GBP" = country === "IN" ? "INR" : "GBP";

    // Lookup package from DB
    const pkg = (
      await db
        .select()
        .from(coinPackages)
        .where(and(eq(coinPackages.currency, currency), eq(coinPackages.coins, coins), eq(coinPackages.active, 1)))
        .limit(1)
    )[0];
    if (!pkg) {
      return NextResponse.json({ error: "PACKAGE_NOT_AVAILABLE" }, { status: 400 });
    }
    const amountMinor = pkg.amountMinor;

    const basicAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        notes: {
          userId: session.user.id,
          coins,
          currency,
        },
      }),
    });

    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("Razorpay order error:", text);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const order = await orderRes.json();
    return NextResponse.json({ order });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
