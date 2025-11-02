"use client";

import React, { memo } from "react";
import Image from "next/image";

type Players = { X: string | null; O: string | null } | undefined;
type Names = { X: string | null; O: string | null } | undefined;
type Avatars = { X: string | null; O: string | null } | undefined;

export type StatusBadgesProps = {
  players: Players;
  role: "X" | "O" | null;
  winner: "X" | "O" | "Draw" | null;
  next: "X" | "O";
  names: Names;
  avatars: Avatars;
};

function StatusBadgesImpl({ players, role, winner, next, names, avatars }: StatusBadgesProps) {
  const hasPlayerX = !!(players?.X);
  const hasPlayerO = !!(players?.O);
  const playerCount = (hasPlayerX ? 1 : 0) + (hasPlayerO ? 1 : 0);

  const showYourTurn = !!role && !winner && next === role && (role === 'X' ? hasPlayerO : hasPlayerX);

  const showOthersTurn = !winner && hasPlayerX && hasPlayerO && !(role && next === role);
  const nextName = next === 'X' ? (names?.X || 'Player 1') : (names?.O || 'Player 2');
  const nextAvatar = next === 'X' ? (avatars?.X || null) : (avatars?.O || null);

  return (
    <div className="flex items-center justify-center gap-3">
      {playerCount === 0 ? (
        <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">Waiting for players…</span>
      ) : playerCount === 1 ? (
        <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">Waiting for opponent…</span>
      ) : null}

      {showYourTurn ? (
        <span className="animate-pulse rounded-full bg-white text-black px-3 py-1 text-xs font-semibold">Your turn</span>
      ) : null}

      {showOthersTurn ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
          {nextAvatar ? (
            <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
              <Image src={nextAvatar} alt="avatar" width={16} height={16} />
            </span>
          ) : null}
          {nextName}'s turn
        </span>
      ) : null}
    </div>
  );
}

export const StatusBadges = memo(StatusBadgesImpl);
