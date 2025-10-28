"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { env } from "~/env";

// Minimal Razorpay typings
declare global {
  interface Window {
    Razorpay: any;
  }
}

async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function detectCurrency(): "INR" | "GBP" {
  try {
    if (typeof window === "undefined") return "INR";
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = navigator.language || "";
    if (tz.includes("Kolkata") || lang.toLowerCase().includes("-in") || lang.toLowerCase().endsWith("-in")) {
      return "INR";
    }
    // Fallback to GBP for now (international)
    return "GBP";
  } catch {
    return "INR";
  }
}

export default function DaddyCoinsPage() {
  const [currency, setCurrency] = useState<"INR" | "GBP">("INR");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: balanceData, refetch: refetchBalance } = api.wallet.getBalance.useQuery();
  const balance = balanceData?.balance ?? 0;

  useEffect(() => {
    setCurrency(detectCurrency());
  }, []);

  const packages = useMemo(
    () => {
      if (currency === "INR") {
        return [
          { coins: 10, priceLabel: "₹10", sub: "10 DaddyCoins" },
          { coins: 30, priceLabel: "₹20", sub: "30 DaddyCoins (Save ₹10)" },
          { coins: 100, priceLabel: "₹50", sub: "100 DaddyCoins (Save ₹50)" },
          { coins: 200, priceLabel: "₹100", sub: "200 DaddyCoins (Save ₹100)" },
        ];
      }
      return [
        { coins: 10, priceLabel: "£0.10", sub: "10 DaddyCoins" },
        { coins: 30, priceLabel: "£0.20", sub: "30 DaddyCoins (Save £0.10)" },
        { coins: 100, priceLabel: "£0.50", sub: "100 DaddyCoins (Save £0.50)" },
        { coins: 200, priceLabel: "£1.00", sub: "200 DaddyCoins (Save £1.00)" },
      ];
    },
    [currency],
  );

  const createOrder = async (coins: number) => {
    const res = await fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins, currency }),
    });
    if (!res.ok) throw new Error("Order creation failed");
    return res.json() as Promise<{ order: { id: string; amount: number; currency: string } }>;
  };

  const verifyPayment = async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await fetch("/api/razorpay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Verification failed");
    return res.json();
  };

  const handleBuy = async (coins: number) => {
    try {
      setBusyId(coins);
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Razorpay SDK failed to load");

      const { order } = await createOrder(coins);

      const rzp = new window.Razorpay({
        key: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Daddy Games",
        description: `${coins} DaddyCoins`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await refetchBalance();
            alert(`Payment successful! ${coins} DaddyCoins added.`);
          } catch (e: any) {
            alert(e?.message ?? "Payment verification failed");
          }
        },
        theme: { color: "#ffffff" },
      });

      rzp.on("payment.failed", function (resp: any) {
        console.error("Payment failed", resp?.error);
        alert("Payment failed. Please try again.");
      });

      rzp.open();
    } catch (e: any) {
      alert(e?.message ?? "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Buy DaddyCoins</h1>
          <p className="text-white/60">Top up your balance to play and win more gifts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-right">
            <div className="text-xs uppercase text-white/50">Balance</div>
            <div className="text-2xl font-bold">{balance}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <label className="mr-2 text-white/60">Region</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as any)}
              className="rounded bg-black px-2 py-1"
            >
              <option value="INR">India (INR)</option>
              <option value="GBP">International (GBP)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((p) => (
          <div key={p.coins} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="mb-1 text-sm text-white/60">{p.sub}</div>
            <div className="mb-4 text-3xl font-extrabold">{p.priceLabel}</div>
            <button
              onClick={() => handleBuy(p.coins)}
              disabled={busyId === p.coins}
              className="w-full rounded-md bg-white px-3 py-2 font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {busyId === p.coins ? "Processing…" : `Buy ${p.coins} Coins`}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
