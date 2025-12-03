"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

export type DaddyModeCardProps = {
  active: boolean;
  setActive: () => void;
  isAuthed: boolean;
  canSelectDaddy: boolean;
  daddyCoins: number;
  onBuyDaddyCoins?: () => void;
};

// One-by-one deal rotator: slides in from right with fade
function DealsRotator() {
  const baseDeals = useMemo(() => ([
    { discount: "100% discount voucher", price: 1000 },
    { discount: "75% discount voucher", price: 750 },
    { discount: "50% discount voucher", price: 500 },
    { discount: "25% discount voucher", price: 250 },
  ]), []);

  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % baseDeals.length);
      setAnimKey((k) => k + 1);
    }, 2200);
    return () => clearInterval(t);
  }, [baseDeals.length]);

  if (baseDeals.length === 0) return null;
  const d = baseDeals[idx % baseDeals.length]!;
  return (
    <div className="relative">
      <div key={animKey} className="flex items-center gap-2 text-xs text-slate-300/90 animate-slideIn">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-50/[0.06] px-3 py-1">
          <span className="">{d.discount}</span>
          <span className="flex items-center gap-1 whitespace-nowrap"><span className="font-semibold text-slate-100">{d.price}</span> <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} /></span>
        </span>
      </div>
      <style jsx>{`
        .animate-slideIn { animation: slideIn 420ms ease-out; }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateX(18px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default function DaddyModeCard({ active, setActive, isAuthed, canSelectDaddy, daddyCoins, onBuyDaddyCoins }: DaddyModeCardProps) {
  const disabled = !isAuthed || !canSelectDaddy;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!disabled) setActive(); }}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); setActive(); } }}
      className={`relative overflow-hidden rounded-md text-center border px-4 py-4 text-left transition-colors outline-none ${active ? "border-slate-300 bg-gradient-to-br from-zinc-900/80 via-slate-900/60 to-zinc-800/80" : "border-slate-500/30 bg-gradient-to-br from-zinc-900/40 via-slate-900/20 to-zinc-800/40"} ${disabled ? "opacity-80 cursor-not-allowed" : "hover:border-slate-300/60"}`}
      aria-disabled={disabled}
      title={!isAuthed ? "Join with a social to activate Daddy Mode" : undefined}
    >
      {/* highlight */}
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tl from-slate-300/10 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100">
          <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={16} height={16} />
          <span className="uppercase">Daddy Mode</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-50/5 px-2 py-0.5 text-[10px] text-slate-200 ring-1 ring-inset ring-slate-400/30">
          <span className="opacity-70">Entry Fee</span>
          <span className="font-semibold">1</span>
          <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 space-y-3 text-center">
        {/* Rewards compact */}
        <div className="text-xs items-center text-slate-300/90">
          <div className="flex items-center justify-center gap-2">
            <span className="opacity-70">Win</span>
            <span className="font-semibold text-slate-100">+1</span>
            <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
            <span className="mx-2 h-3 w-px bg-slate-400/30" />
            <span className="opacity-70">vs Daddy</span>
            <span className="font-semibold text-slate-100">+3</span>
            <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
          </div>
        </div>

        {/* Deals rotator */}
        <div className="mt-3">
          <div className="text-xs text-slate-300/90">Top Prizes in Daddy Mode</div>
          <div className="mt-1 flex flex-col items-center gap-2 text-xs text-slate-200">
            <span className="font-medium text-slate-100">Apple iPhone 17 Pro Max</span>
            <DealsRotator />
          </div>
        </div>
      </div>

      {/* Non-session nudge */}
      {!isAuthed ? (
        <div className="mt-3 text-[11px] text-slate-300">Join with a social to activate this.</div>
      ) : null}

      {/* Low-balance */}
      {isAuthed && daddyCoins <= 0 ? (
        <div className="mt-3 rounded-md bg-rose-300/10 p-2 text-[11px] text-rose-200 ring-1 ring-inset ring-rose-300/30">
          <div className="mb-1">You have 0 DaddyCoins.</div>
          {onBuyDaddyCoins ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBuyDaddyCoins(); }}
              className="rounded-md border border-rose-200/60 bg-rose-200 text-rose-900 px-2 py-1 text-xs font-semibold hover:bg-rose-100"
            >
              Buy Daddy Coins
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
