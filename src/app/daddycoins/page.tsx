"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { env } from "~/env";
import { useSession } from "next-auth/react";
import AuthModal from "../_components/AuthModal";
import Image from "next/image";

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
    const opts = Intl.DateTimeFormat().resolvedOptions();
    const tz = (opts.timeZone || "").toLowerCase();
    const lang = (navigator.language || "").toLowerCase();
    const langs = (navigator.languages || []).map((l) => (l || "").toLowerCase());

    // Check for Indian region via language list
    const langIsIN = lang.endsWith("-in") || langs.some((l) => l.endsWith("-in"));

    // Check for Indian timezone names used across platforms
    const tzIsIN = tz.includes("kolkata") || tz.includes("calcutta") || tz === "asia/kolkata" || tz === "asia/calcutta";

    // Only treat as India if timezone or locale is explicitly Indian
    if (langIsIN || tzIsIN) return "INR";

    // Fallback to GBP for now (international)
    return "GBP";
  } catch {
    return "INR";
  }
}

export default function DaddyCoinsPage() {
  const { data: session } = useSession();
  const [currency, setCurrency] = useState<"INR" | "GBP">("INR");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const { data: balanceData, refetch: refetchBalance } = api.wallet.getBalance.useQuery();
  const balance = balanceData?.balance ?? 0;

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem("daddycoins_currency");
      if (stored === "INR" || stored === "GBP") {
        setCurrency(stored);
      } else {
        setCurrency(detectCurrency());
      }
    } catch {
      setCurrency(detectCurrency());
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem("daddycoins_currency", currency);
    } catch {
      // ignore persistence errors
    }
  }, [currency]);

  const packages = useMemo(
    () => {
      if (currency === "INR") {
        return [
          { coins: 10, priceLabel: "₹10", basePrice: "₹10", sub: "10 DaddyCoins" },
          { coins: 30, priceLabel: "₹20", basePrice: "₹30", sub: "30 DaddyCoins (Save ₹10)" },
          { coins: 100, priceLabel: "₹50", basePrice: "₹100", sub: "100 DaddyCoins (Save ₹50)" },
          { coins: 200, priceLabel: "₹100", basePrice: "₹200", sub: "200 DaddyCoins (Save ₹100)" },
        ];
      }
      return [
        { coins: 10, priceLabel: "£0.10", basePrice: "£0.10", sub: "10 DaddyCoins" },
        { coins: 30, priceLabel: "£0.20", basePrice: "£0.30", sub: "30 DaddyCoins (Save £0.10)" },
        { coins: 100, priceLabel: "£0.50", basePrice: "£1.00", sub: "100 DaddyCoins (Save £0.50)" },
        { coins: 200, priceLabel: "£1.00", basePrice: "£2.00", sub: "200 DaddyCoins (Save £1.00)" },
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
      // If not signed in, open auth modal and exit early
      if (!session) {
        setAuthOpen(true);
        return;
      }
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
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} callbackUrl="/daddycoins" />
      <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Buy DaddyCoins</h1>
          <p className="text-white/60">Top up your balance to play and win more gifts.</p>
        </div>
        {/* <div className="flex items-center gap-3">
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
        </div> */}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {packages.map((p) => (
          <div key={p.coins} className="rounded-xl border border-white/10 bg-white/5 p-5">
            {/* Coin stacks layout */}
            <div className="mb-3 flex w-full flex-col items-start gap-2">
              {(() => {
                // Determine stack layout per row based on coin package
                // Each stack visually represents up to 10 coins
                const stacks = Math.ceil(p.coins / 10);
                let rows: number[] = [];
                if (p.coins === 30) {
                  rows = [3]; // 3 stacks in one row
                } else if (p.coins === 100) {
                  rows = [4, 4, 2]; // 10 stacks as 4-4-2
                } else if (p.coins === 200) {
                  rows = [5, 5, 5, 5]; // 20 stacks, 5 per row
                } else {
                  // Fallback: fill rows up to 4 per row to keep visuals readable
                  const perRow = 4;
                  let remaining = stacks;
                  while (remaining > 0) {
                    rows.push(Math.min(perRow, remaining));
                    remaining -= perRow;
                  }
                }

                const maxInRow = Math.max(...rows);
                // Size the stack based on how many we need to fit per row
                const size = maxInRow >= 5 ? 56 : maxInRow === 4 ? 83.33 : maxInRow === 3 ? 100 : 100; // px
                const offset = 2; // tight stack step in px
                const shown = 10; // visual per stack
                const box = size + offset * (shown - 1);

                // Reusable renderer for a single stack
                const Stack = () => (
                  <div
                    className="relative"
                    style={{ width: box, height: box }}
                    aria-label={`coin stack of ${shown}`}
                  >
                    {/* Base tight shadow */}
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: box * 0.45,
                        height: box * 0.3,
                        background:
                          "radial-gradient(ellipse at center, rgba(0,0,0,0.9), rgba(0,0,0,0) 45%)",
                        filter: "blur(1px)",
                      }}
                    />
                    {Array.from({ length: shown }).map((_, i) => (
                      <Image
                        key={i}
                        src="/daddycoin.svg"
                        alt="DaddyCoin"
                        width={size}
                        height={size}
                        className="absolute rounded-full ring-1 ring-white/10"
                        style={{
                          left: i * offset,
                          bottom: i * offset,
                          zIndex: i + 1,
                          filter:
                            "drop-shadow(0 2px 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.9))",
                        }}
                        priority={i < 3}
                      />
                    ))}
                  </div>
                );

                // Render rows
                let rendered = 0;
                return (
                  <>
                    {rows.map((count, idx) => (
                      <div key={`row-${idx}`} className="flex w-full flex-row items-center gap-2">
                        {Array.from({ length: count }).map((_, j) => {
                          rendered += 1;
                          return <Stack key={`stack-${idx}-${j}`} />;
                        })}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            
            <div className="mb-1 text-sm text-white/60">{p.sub}</div>
            <div className="mb-4 text-3xl font-extrabold">{p.priceLabel} {p.basePrice !== p.priceLabel && <span className="text-white/60 line-through">{p.basePrice}</span>}</div>
            <button
              onClick={() => handleBuy(p.coins)}
              disabled={busyId === p.coins}
              className="w-full rounded-md bg-white px-3 py-2 font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {busyId === p.coins ? "Processing…" : `Buy ${p.coins} DaddyCoins`}
            </button>
          </div>
        ))}
      </div>
      </main>
    </>
  );
}
