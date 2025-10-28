"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

export default function GiftsPage() {
  const { data: balanceData, refetch: refetchBalance, isLoading: isBalLoading } = api.wallet.getBalance.useQuery();
  const { data: gifts, isLoading: isGiftsLoading, refetch: refetchGifts } = api.gifts.listActive.useQuery();
  const { data: purchases, refetch: refetchPurchases, isLoading: isPurchLoading } = api.gifts.myPurchases.useQuery();
  const purchaseMutation = api.wallet.purchase.useMutation();
  const addGiftMutation = api.gifts.add.useMutation();

  const purchaseMap = useMemo(() => {
    const map = new Map<number, { redemptionCode: string }>();
    (purchases ?? []).forEach((p) => map.set(p.giftId as number, { redemptionCode: p.redemptionCode as string }));
    return map;
  }, [purchases]);

  const [seeding, setSeeding] = useState(false);

  const seedDemoGifts = async () => {
    try {
      setSeeding(true);
      const demo = [
        {
          title: "iPhone 17 Pro Max",
          imageUrl: "https://images.unsplash.com/photo-1670272505671-74f7249bc818?q=80&w=1200&auto=format&fit=crop",
          coinCost: 5000,
          vendor: "amazon",
          voucherAmount: 1000,
          active: true,
        },
        {
          title: "Amazon Gift Card $100",
          imageUrl: "https://images.unsplash.com/photo-1617396900799-f4ec2dc1610a?q=80&w=1200&auto=format&fit=crop",
          coinCost: 1500,
          vendor: "amazon",
          voucherAmount: 100,
          active: true,
        },
        {
          title: "Nintendo Switch OLED",
          imageUrl: "https://images.unsplash.com/photo-1633444926800-3b4924ac95c4?q=80&w=1200&auto=format&fit=crop",
          coinCost: 3500,
          vendor: "amazon",
          voucherAmount: 0,
          active: true,
        },
      ];

      for (const g of demo) {
        await addGiftMutation.mutateAsync(g as any);
      }
      await refetchGifts();
    } finally {
      setSeeding(false);
    }
  };

  const handlePurchase = async (giftId: number) => {
    try {
      const res = await purchaseMutation.mutateAsync({ giftId });
      await Promise.all([refetchBalance(), refetchPurchases()]);
      const code = res?.purchase?.redemptionCode;
      if (code) {
        alert(`Unlocked! Your voucher code: ${code}`);
      } else {
        alert("Unlocked! Check your purchases for the voucher code.");
      }
    } catch (e: any) {
      alert(e?.message ?? "Failed to purchase");
    }
  };

  const balance = balanceData?.balance ?? 0;
  const loading = isBalLoading || isGiftsLoading || isPurchLoading || purchaseMutation.isPending;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Daddy's Gifts</h1>
          <p className="text-white/60">Spend your Daddy Coins to unlock epic gifts and vouchers.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-right">
          <div className="text-xs uppercase text-white/50">Daddy Coins</div>
          <div className="text-2xl font-bold">{loading ? "…" : balance}</div>
        </div>
      </div>

      {(!gifts || gifts.length === 0) && (
        <div className="mb-6 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-200">
          <div className="mb-2 font-semibold">No gifts yet</div>
          <p className="mb-3 text-sm">Add some demo gifts to get started.</p>
          <button
            onClick={seedDemoGifts}
            disabled={seeding}
            className="rounded-md bg-yellow-400 px-3 py-1.5 text-black hover:bg-yellow-300 disabled:opacity-60"
          >
            {seeding ? "Seeding…" : "Seed Demo Gifts"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(gifts ?? []).map((g) => {
          const unlocked = purchaseMap.has(g.id as number);
          const code = purchaseMap.get(g.id as number)?.redemptionCode;
          const canAfford = balance >= (g.coinCost as number);
          return (
            <div key={g.id as number} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="relative h-44 w-full bg-black">
                {g.imageUrl ? (
                  <Image src={g.imageUrl as string} alt={g.title as string} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/40">No Image</div>
                )}
                <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white/80">
                  {g.vendor}
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="font-semibold">{g.title}</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-white/70">Cost</div>
                  <div className="font-semibold">{g.coinCost} Coins</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  {!unlocked ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white/60">Voucher sealed</div>
                      <button
                        onClick={() => handlePurchase(g.id as number)}
                        disabled={!canAfford || loading}
                        className="rounded-md bg-white px-3 py-1.5 text-black hover:bg-white/90 disabled:opacity-50"
                      >
                        {canAfford ? "Unlock Voucher" : "Insufficient Coins"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1 text-xs uppercase text-emerald-300/80">Unlocked</div>
                      <div className="text-lg font-mono tracking-wide text-emerald-300">{code}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
