import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { auth } from "~/server/auth";

// Create Razorpay Order
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { coins, currency } = (await req.json()) as {
      coins: number; // number of DaddyCoins to credit
      currency: "INR" | "GBP";
    };

    if (![10, 30, 100, 200].includes(coins)) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    // Determine amount in minor units
    let amountMinor = 0; // paise for INR, pence for GBP
    if (currency === "INR") {
      amountMinor =
        coins === 10 ? 10 * 100 : // Rs 10
        coins === 30 ? 20 * 100 : // Rs 20 (discount)
        coins === 100 ? 50 * 100 : // Rs 50
        100 * 100; // Rs 100 for 200 coins
    } else {
      // GBP
      amountMinor =
        coins === 10 ? 10 : // 10 pence
        coins === 30 ? 20 : // 20 pence (discount)
        coins === 100 ? 50 : // 50 pence
        100; // 1 pound (100 pence) for 200 coins
    }

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
