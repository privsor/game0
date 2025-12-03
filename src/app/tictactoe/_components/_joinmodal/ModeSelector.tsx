"use client";

import React from "react";
import DaddyModeCard from "./DaddyModeCard";

export type JoinMode = "daddy" | "free" | null;

export type ModeSelectorProps = {
  joinMode: JoinMode;
  setJoinMode: (m: JoinMode) => void;
  canSelectDaddy: boolean;
  isAuthed?: boolean;
  daddyCoins?: number; // user balance; if 0, show CTA when daddy mode selected
  onBuyDaddyCoins?: () => void; // handler for CTA
  onAuthCta?: () => void; // optional sign-in handler for enabling daddy mode
  freeFirst?: boolean;
  className?: string; // optional wrapper classes (grid/stack etc.) if needed
};

export function ModeSelector({ joinMode, setJoinMode, canSelectDaddy, isAuthed = false, daddyCoins = 0, onBuyDaddyCoins, onAuthCta, freeFirst = false, className }: ModeSelectorProps) {
  const DaddyButton = (
    <DaddyModeCard
      active={joinMode === "daddy"}
      setActive={() => setJoinMode("daddy")}
      isAuthed={isAuthed}
      canSelectDaddy={canSelectDaddy}
      daddyCoins={daddyCoins}
      onBuyDaddyCoins={onBuyDaddyCoins}
    />
  );

  const FreeButton = (
    <button
      type="button"
      onClick={() => setJoinMode("free")}
      className={`rounded-md border px-4 py-2 text-left transition-colors ${joinMode === "free" ? "border-slate-200 bg-slate-50/10 text-slate-100" : "border-slate-500/30 bg-slate-50/5 text-slate-200 hover:border-slate-300/50"}`}
    >
      <div className="text-sm font-semibold tracking-wide">Free Mode</div>
      <div className="text-xs text-slate-400">Play for fun. No coins.</div>
    </button>
  );

  return (
    <div className="">
      <h2 className="mb-3 text-xl font-bold tracking-wide text-slate-100">Select a mode</h2>
      <div className={(className || '') + ' flex flex-col gap-3 mb-4'}>
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
        {joinMode === null ? (
          <div className="text-xs text-slate-400">Select a mode to continue.</div>
        ) : null}
      </div>
    </div>
  );
}
