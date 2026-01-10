"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { env } from "~/env";
import { useSession } from "next-auth/react";
import AuthModal from "../../_components/AuthModal";
import PackageCard from "../../daddycoins/_components/PackageCard";

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

    const langIsIN = lang.endsWith("-in") || langs.some((l) => l.endsWith("-in"));
    const tzIsIN = tz.includes("kolkata") || tz.includes("calcutta") || tz === "asia/kolkata" || tz === "asia/calcutta";
    if (langIsIN || tzIsIN) return "INR";
    return "GBP";
  } catch {
    return "INR";
  }
}

export type BuyDaddyCoinsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function BuyDaddyCoinsModal({ open, onClose }: BuyDaddyCoinsModalProps) {
  const { data: session } = useSession();
  const [currency, setCurrency] = useState<"INR" | "GBP">("INR");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const { data: balanceData, refetch: refetchBalance } = api.wallet.getBalance.useQuery(undefined, { enabled: open && !!session });
  const balance = balanceData?.balance ?? 0;

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

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
    return res.json() as Promise<{ order: { id: string; amount: number; currency: string } }>
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

  if (!open) return null;

  return (
    <>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} callbackUrl="/daddycoins" />
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
        <div className="rounded-xl border border-white/10 backdrop-blur-sm p-5 shadow-xl max-h-[80vh] flex flex-col">
          <div className="flex items-start justify-between mb-4 shrink-0">
            <div>
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight">Buy DaddyCoins</h2>
              <p className="text-xs md:text-sm text-white/60">Top up your balance to play and win more gifts.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:gap-6 gap-2 sm:grid-cols-2 lg:grid-cols-2 overflow-y-auto p-4 flex-1 min-h-0">
            {packages.map((p) => (
              <PackageCard
              key={p.coins}
              coins={p.coins}
              priceLabel={p.priceLabel}
              basePrice={(p as any).basePrice}
              sub={p.sub}
              busyId={busyId}
              balance={balance}
              onBuy={handleBuy}
              variant="modal"
            />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default BuyDaddyCoinsModal;
