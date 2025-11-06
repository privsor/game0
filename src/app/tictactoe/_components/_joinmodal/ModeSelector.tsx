"use client";

import React from "react";
import Image from "next/image";

export type JoinMode = "daddy" | "free";

export type ModeSelectorProps = {
  joinMode: JoinMode;
  setJoinMode: (m: JoinMode) => void;
  canSelectDaddy: boolean;
  freeFirst?: boolean;
  className?: string; // optional wrapper classes (grid/stack etc.) if needed
};

export function ModeSelector({ joinMode, setJoinMode, canSelectDaddy, freeFirst = false, className }: ModeSelectorProps) {
  const DaddyButton = (
    <button
      type="button"
      onClick={() => canSelectDaddy && setJoinMode("daddy")}
      disabled={!canSelectDaddy}
      className={`rounded-xl border px-3 py-3 text-left ${joinMode === "daddy" ? "border-amber-300 bg-amber-200 text-black" : "border-amber-300/30 bg-amber-200/10 text-amber-200"} ${!canSelectDaddy ? "opacity-50 cursor-not-allowed" : "hover:bg-amber-200/20"}`}
      title={!canSelectDaddy ? "Sign in and have at least 1 DaddyCoin" : "Daddy Mode (costs 1 coin when an authenticated opponent joins)"}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={14} height={14} /> Daddy Mode
      </div>
      <div className="text-[11px] mt-1 opacity-80">
        Costs 1 DaddyCoin when a signed-in opponent joins. Winner rewards: +2 (vs free) / +3 (vs daddy).
      </div>
    </button>
  );

  const FreeButton = (
    <button
      type="button"
      onClick={() => setJoinMode("free")}
      className={`rounded-xl border px-3 py-3 text-left ${joinMode === "free" ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"}`}
    >
      <div className="text-sm font-semibold">Free Mode</div>
      <div className="text-xs text-white/60">Play for fun. No coins.</div>
    </button>
  );

  return (
    <div className={'flex flex-col gap-2 mb-4' + (className || '')}>
      {freeFirst ? (
        <>
          {FreeButton}
          {DaddyButton}
        </>
      ) : (
        <>
          {DaddyButton}
          {FreeButton}
        </>
      )}
    </div>
  );
}
