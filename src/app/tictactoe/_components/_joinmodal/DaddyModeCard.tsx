"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PrizesModal from "../../../prizes/_components/PrizesModal";

export type DaddyModeCardProps = {
  active: boolean;
  setActive: () => void;
  isAuthed: boolean;
  canSelectDaddy: boolean;
  daddyCoins: number;
  onBuyDaddyCoins?: () => void;
  onJoinWithSocial?: () => void;
};

// One-by-one deal rotator: slides in from right with fade
function DealsRotator() {
  const baseDeals = useMemo(() => ([
    { discount: "FREE", price: 1000 },
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

export default function DaddyModeCard({ active, setActive, isAuthed, canSelectDaddy, daddyCoins, onBuyDaddyCoins, onJoinWithSocial }: DaddyModeCardProps) {
  const disabled = !isAuthed || !canSelectDaddy;
  const [prizesOpen, setPrizesOpen] = useState(false);
  
  const handleSelectMode = () => {
    if (!disabled) {
      setActive();
    }
  };
  
  return (
    <>
    <div
      className={`relative overflow-hidden rounded-md text-center border px-4 py-4 text-left transition-colors outline-none ${
        active ? "border-slate-300 bg-gradient-to-br from-zinc-900/80 via-slate-900/60 to-zinc-800/80" : "border-slate-500/30 bg-gradient-to-br from-zinc-900/40 via-slate-900/20 to-zinc-800/40"
      } ${disabled ? "opacity-80" : ""}`}
    >
      {/* highlight */}
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tl from-slate-300/10 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100">
          <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={16} height={16} />
          <span className="uppercase">Daddy Mode</span>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 space-y-3 text-center">
        {/* Rewards compact */}
        <div className="text items-center text-slate-300/90">
          <div className="flex items-center justify-center gap-2">
            <span className="opacity-70">Winner gets</span>
            <span className="font-semibold text-slate-100">+1</span>
            <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={20} height={20} />
            <span className="mx-2 h-3 w-px bg-slate-400/30" />
            <span className="opacity-70">vs Daddy</span>
            <span className="font-semibold text-slate-100">+3</span>
            <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={20} height={20} />
          </div>
        </div>

        {/* Deals rotator */}
        <div className="mt-2">
          <div className="text-md text-slate-300/90">Top Prizes in Daddy Mode</div>
          <div className="mt-1 border text-xs text-slate-200 rounded-md">
            <div className="flex items-center justify-between px-2 py-1">
              <Image src="/iphone17.gif" alt="iPhone 17" width={28} height={28} className="rounded-sm" />
              <div className="">
              <span className="font-medium text-white text-lg animate-pulse">Apple iPhone 17 Pro Max</span>
              <div className="mt-1 flex justify-center">
              <DealsRotator />
            </div>
              </div>
              
              <Image src="/iphone17.gif" alt="iPhone 17" width={28} height={28} className="rounded-sm" />
            </div>
            
            <div className="mt-2 mb-2 flex justify-center px-2">
              <button
                type="button"
                onClick={() => setPrizesOpen(true)}
                className="text-lg rounded border border-white/20 bg-white/5 px-3 py-1 text-white hover:bg-white/10"
              >
                View more prizes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Select Daddy Mode Button */}
      <div className="mt-4 px-2">
        <button
          type="button"
          onClick={handleSelectMode}
          disabled={disabled}
          className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200 transform ${
            disabled
              ? "cursor-not-allowed bg-slate-700/50 text-slate-400 border border-slate-600/30"
              : active
              ? "bg-gradient-to-r from-slate-800 to-black text-white border border-white/20 shadow-lg shadow-black/50 scale-[1.02]"
              : "bg-white/10 text-white border border-white/20 hover:from-slate-800 hover:to-black hover:border-white/30 hover:shadow-md hover:shadow-black/50 hover:scale-[1.01] active:scale-[0.98]"
          }`}
        >
          <div className="flex justify-between items-center gap-4">
            <span className="tracking-wide text-md">Select Daddy Mode</span>
            <div className="flex items-center gap-1 text-white/60 text-sm">
              <span className="text-xs opacity-90">cost:</span>
              <span className="font-bold text-sm">1</span>
              <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={18} height={18} className="drop-shadow-sm" />
            </div>
          </div>
        </button>
      </div>

      {/* Non-session nudge */}
      {!isAuthed && onJoinWithSocial ? (
        <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onJoinWithSocial}
          className="mt-3 text-xs text-center text-slate-300 underline underline-offset-2 decoration-slate-500 hover:text-white hover:decoration-slate-400 transition-all duration-200"
        >
          Join with a social account to activate this.
        </button>
        </div>
      ) : !isAuthed ? (
        <div className="mt-3 text-[11px] text-center text-slate-300">Join with a social account to activate this.</div>
      ) : null}

      {/* Low-balance */}
      {isAuthed && daddyCoins <= 0 ? (
        <div className="mt-2 rounded-md flex flex-col items-center justify-center text-[11px]">
          <div className="mb-1">You have 0 DaddyCoins. Buy some to play in Daddy Mode.</div>
          {onBuyDaddyCoins ? (
            <button
              type="button"
              onClick={onBuyDaddyCoins}
              className="rounded-lg border border-rose-200/20 bg-gradient-to-r from-rose-500 to-rose-600 text-white px-3 py-2 text-sm font-semibold hover:from-rose-600 hover:to-rose-700 hover:border-rose-200/30 hover:shadow-lg hover:shadow-rose-500/20 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Get Daddy Coins
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
    <PrizesModal open={prizesOpen} onClose={() => setPrizesOpen(false)} />
    </>
  );
}
