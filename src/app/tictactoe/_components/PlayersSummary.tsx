"use client";

import React, { memo } from "react";
import Image from "next/image";

type Names = { X: string | null; O: string | null } | undefined;
type Avatars = { X: string | null; O: string | null } | undefined;

type Coins = { X: boolean; O: boolean } | undefined;

type PlayersSummaryProps = {
  names: Names;
  avatars: Avatars;
  coinsMode: Coins;
  coinsModePending: Coins;
};

function PlayersSummaryImpl({ names, avatars, coinsMode, coinsModePending }: PlayersSummaryProps) {
  return (
    <div className="text-center text-white/70 text-sm flex items-center justify-center gap-3">
      <span className="inline-flex items-center gap-1">
        X:
        {avatars?.X ? (
          <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
            <Image src={avatars.X} alt="X avatar" width={16} height={16} />
          </span>
        ) : null}
        <span className="font-semibold inline-flex items-center gap-1">
          {names?.X || '—'}
          {coinsMode?.X ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/10 px-2 py-0.5 text-[10px] text-amber-200">
              <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
              Daddy mode
            </span>
          ) : coinsModePending?.X ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/5 px-2 py-0.5 text-[10px] text-amber-200/80">
              <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
              1/2 Daddy mode
            </span>
          ) : null}
        </span>
      </span>
      <span className="text-white/40">·</span>
      <span className="inline-flex items-center gap-1">
        O:
        {avatars?.O ? (
          <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
            <Image src={avatars.O} alt="O avatar" width={16} height={16} />
          </span>
        ) : null}
        <span className="font-semibold inline-flex items-center gap-1">
          {names?.O || '—'}
          {coinsMode?.O ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/10 px-2 py-0.5 text-[10px] text-amber-200">
              <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
              Daddy mode
            </span>
          ) : coinsModePending?.O ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/5 px-2 py-0.5 text-[10px] text-amber-200/80">
              <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
              1/2 Daddy mode
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

export const PlayersSummary = memo(PlayersSummaryImpl);
