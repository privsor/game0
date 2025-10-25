"use client";

import React from "react";

export type Cell = "X" | "O" | null;

export function Board({
  board,
  onMove,
  disabled,
  highlight,
}: {
  board: Cell[];
  onMove: (idx: number) => void;
  disabled?: boolean;
  highlight?: number[] | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-md">
      {board.map((cell, i) => {
        const row = Math.floor(i / 3) + 1;
        const col = (i % 3) + 1;
        const isDisabled = !!cell || !!disabled;
        const isHighlighted = Array.isArray(highlight) ? highlight.includes(i) : false;
        const label = cell
          ? `Cell ${row}, ${col}, ${cell}`
          : `Place at row ${row}, column ${col}`;
        return (
          <button
            key={i}
            onClick={() => onMove(i)}
            onKeyDown={(e) => {
              if (isDisabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onMove(i);
              }
            }}
            aria-label={label}
            title={label}
            tabIndex={0}
            disabled={isDisabled}
            className={
              [
                "aspect-square rounded-lg border border-white/30 text-white bg-white/10 hover:bg-white/30 disabled:hover:bg-white/15 flex items-center justify-center text-5xl font-extrabold transition-colors",
                isHighlighted ? "!border-white opacity-100 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "disabled:border-white/25 disabled:bg-white/5",
              ].join(" ")
            }
          >
            {cell ?? ""}
          </button>
        );
      })}
    </div>
  );
}
