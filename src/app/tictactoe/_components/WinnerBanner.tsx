"use client";

import React, { memo } from "react";

type Winner = "X" | "O" | "Draw" | null;

type WinnerBannerProps = { winner: Winner };

function WinnerBannerImpl({ winner }: WinnerBannerProps) {
  if (!winner) return null;
  return (
    <div className="text-xl font-bold">
      {winner === "Draw" ? "It's a draw!" : `${winner} wins!`}
    </div>
  );
}

export const WinnerBanner = memo(WinnerBannerImpl);
