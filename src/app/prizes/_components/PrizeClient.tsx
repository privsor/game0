"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import MediaCarousel from "./MediaCarousel";
import VariantSelector from "./VariantSelector";
import InteractionBar from "./InteractionBar";
import { api } from "~/trpc/react";
import AuthModal from "../../_components/AuthModal";
import CommentsModal from "./CommentsModal";
import WinnersModal from "./WinnersModal";
import WantersModal from "./WantersModal";

// A richer Prize client that renders grouped prizes with variant selector,
// media carousel, sponsor, cost, and interaction bar.
export default function PrizeClient() {
  const { data: session } = useSession();
  const [authOpen, setAuthOpen] = useState(false);

  const { data: balanceData, refetch: refetchBalance, isLoading: isBalLoading } = api.wallet.getBalance.useQuery(undefined, {
    enabled: !!session,
  });
  const { data: prizes, isLoading: isPrizesLoading, refetch: refetchPrizes } = api.prizes.listGrouped.useQuery();
  const { data: purchases, refetch: refetchPurchases, isLoading: isPurchLoading } = api.gifts.myPurchases.useQuery(undefined, {
    enabled: !!session,
  }); // reuse purchases endpoint
  const purchaseMutation = api.wallet.purchase.useMutation();

  const balance = balanceData?.balance ?? 0;
  const loading = (session ? (isBalLoading || isPurchLoading) : false) || isPrizesLoading || purchaseMutation.isPending;

  const purchaseMap = useMemo(() => {
    const map = new Map<number, { redemptionCode: string }>();
    (purchases ?? []).forEach((p: any) => {
      if (p.prizeVariantId) map.set(p.prizeVariantId as number, { redemptionCode: p.redemptionCode as string });
    });
    return map;
  }, [purchases]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Header balance={balance} loading={loading} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(prizes ?? []).map((p: any) => (
          <PrizeCard
            key={p.id}
            prize={p}
            balance={balance}
            purchaseMap={purchaseMap}
            loading={loading}
            isAuthed={!!session}
            openAuthModal={() => setAuthOpen(true)}
            purchase={async (variantId: number) => {
              const res = await purchaseMutation.mutateAsync({ prizeVariantId: variantId } as any);
              await Promise.all([refetchBalance(), refetchPurchases(), refetchPrizes()]);
              return res?.purchase?.redemptionCode as string | undefined;
            }}
          />
        ))}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} callbackUrl="/prizes" />
    </main>
  );
}

function Header({ balance, loading }: { balance: number; loading: boolean }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Daddy's Prizes</h1>
        {/* <p className="text-white/60">Choose a variant and claim with Daddy Coins.</p> */}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 px-2 md:px-4 py-2 text-right">
        <div className="md:text-xs text-[7px] uppercase text-white/50">Daddy Coins</div>
        <span className="mt-1 text-2xl inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums">
          {loading ? "…" : balance}
          <Image src="/daddycoin.svg" width={26} height={26} alt="DaddyCoins" />
        </span>
      </div>
    </div>
  );
}

function PrizeCard({
  prize,
  balance,
  loading,
  purchaseMap,
  isAuthed,
  openAuthModal,
  purchase,
}: {
  prize: any;
  balance: number;
  loading: boolean;
  purchaseMap: Map<number, { redemptionCode: string }>;
  isAuthed: boolean;
  openAuthModal: () => void;
  purchase: (variantId: number) => Promise<string | undefined>;
}) {
  const variants = prize.variants ?? [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = variants[selectedIdx];

  // Interaction hooks per prize
  const { data: ix, refetch: refetchIx } = api.prizes.getInteraction.useQuery({ prizeId: prize.id });
  const toggleWant = api.prizes.toggleWant.useMutation();
  const addComment = api.prizes.addComment.useMutation();
  const [showComments, setShowComments] = useState(false);
  const [showWinners, setShowWinners] = useState(false);
  const [showWanters, setShowWanters] = useState(false);

  // Optimistic state for want
  const [optimisticWanted, setOptimisticWanted] = useState<boolean | null>(null);
  const [optimisticWantDelta, setOptimisticWantDelta] = useState(0);
  const wantedByMe = optimisticWanted ?? !!ix?.wantedByMe;
  const wantCount = (ix?.want ?? 0) + optimisticWantDelta;

  // reset carousel when variant changes
  const [activeSlide, setActiveSlide] = useState(0);

  // ambient auto-rotate of variants when user is idle
  const [lastInteractAt, setLastInteractAt] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!(variants?.length > 1)) return;
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastInteractAt;
      if (idleMs > 6000) {
        // rotate
        const nextIdx = (selectedIdx + 1) % variants.length;
        setSelectedIdx(nextIdx);
        setActiveSlide(0);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [variants?.length, selectedIdx, lastInteractAt]);

  const unlocked = selected ? purchaseMap.has(selected.id as number) : false;
  const code = selected ? purchaseMap.get(selected.id as number)?.redemptionCode : undefined;
  const canAfford = selected ? balance >= (selected.coinCost as number) : false;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {/* Media carousel */}
      <div className="relative">
        <MediaCarousel
          prizeTitle={prize.title}
          variantMedia={selected?.media as any[]}
          prizeMedia={prize.media as any[]}
          fallbackImage={selected?.imageUrl ?? prize.primaryImageUrl ?? prize.imageUrl}
          fallbackVideo={prize.videoUrl}
        />
        <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white/80">{prize.sponsor ?? prize.vendor}</div>
      </div>

      <div className="space-y-3 p-4">
        <div className="font-semibold flex items-center gap-2 flex-wrap">
          <span>{prize.title}</span>
          {selected && <span className="text-sm text-white/60">• {selected.label}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>Sponsored by:</span>
          {prize.sponsorLogo ? 
          <Image
          src={prize.sponsorLogo as string}
          width={14}
          height={14}
          alt="brand"
          className="grayscale invert brightness-200 contrast-200"
        />         
          : null}
          <span className="font-medium text-white/80">{prize.sponsor ?? prize.vendor}</span>
        </div>

        <h3 className="text-sm font-semibold">Select a voucher</h3>
        {/* Variant selector */}
        {variants.length > 0 && (
          <VariantSelector
            variants={variants.map((v: any) => ({ id: v.id, label: v.label, buttonLabel: v.buttonLabel, coinCost: v.coinCost }))}
            selectedIdx={selectedIdx}
            setSelectedIdx={(idx) => {
              setSelectedIdx(idx);
              setActiveSlide(0);
            }}
            onInteract={() => setLastInteractAt(Date.now())}
          />
        )}

        {/* Claims left + Cost row */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-white/70">Claims left: 7 out of 10</div>
          <div className="inline-flex items-center gap-1.5 font-semibold">
            {selected?.coinCost ?? "—"}
            <Image src="/icons/daddycoin.svg" width={18} height={18} alt="DaddyCoins" />
          </div>
        </div>

        {/* Claim button */}
        <button
            onClick={async () => {
              if (!selected) return;
              if (!isAuthed) {
                openAuthModal();
                return;
              }
              try {
                const code = await purchase(selected.id as number);
                if (code) alert(`Unlocked! Code: ${code}`);
                else alert("Unlocked! Check your purchases for the voucher code.");
              } catch (e: any) {
                alert(e?.message ?? "Failed to purchase");
              }
            }}
            disabled={!selected || loading}
            className="w-full rounded-md bg-white px-3 py-2 text-center font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
          {selected ? "Claim" : "Select variant"}
        </button>

        {/* Interaction bar */}
        <InteractionBar
          counts={{ want: wantCount, comments: ix?.comments ?? 0, winners: ix?.winners ?? 0 }}
          wantedByMe={wantedByMe}
          recentWanters={ix?.recentWanters as any}
          recentCommenters={ix?.recentCommenters as any}
          recentWinners={ix?.recentWinners as any}
          onWant={async () => {
            if (!isAuthed) {
              openAuthModal();
              return;
            }
            try {
              // optimistic toggle
              const next = !wantedByMe;
              setOptimisticWanted(next);
              setOptimisticWantDelta((d) => d + (next ? 1 : -1));
              await toggleWant.mutateAsync({ prizeId: prize.id });
              await refetchIx();
              // reset optimistic state to reflect latest server
              setOptimisticWanted(null);
              setOptimisticWantDelta(0);
            } catch (e) {
              // ignore for now
              setOptimisticWanted(null);
              setOptimisticWantDelta(0);
            }
          }}
          onComments={() => setShowComments(true)}
          onWinners={() => setShowWinners(true)}
          onWantAvatarsClick={() => setShowWanters(true)}
          onCommentsAvatarsClick={() => setShowComments(true)}
          onWinnersAvatarsClick={() => setShowWinners(true)}
          disabled={loading}
        />

        {/* Modals */}
        <CommentsModal
          open={showComments}
          onClose={() => setShowComments(false)}
          prizeId={prize.id}
          requireAuth={() => {
            if (!isAuthed) {
              openAuthModal();
              return true;
            }
            return false;
          }}
          onChanged={() => refetchIx()}
        />
        <WinnersModal
          open={showWinners}
          onClose={() => setShowWinners(false)}
          prizeId={prize.id}
        />
        <WantersModal
          open={showWanters}
          onClose={() => setShowWanters(false)}
          prizeId={prize.id}
        />

        {/* Unlock state */}
        {unlocked && (
          <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">
            <div className="text-xs uppercase">Unlocked</div>
            <div className="font-mono text-lg">{code}</div>
          </div>
        )}
      </div>
    </div>
  );
}
