"use client";

import React from "react";

export type Cell = "X" | "O" | null;

export function Board({
  board,
  onMove,
  disabled,
}: {
  board: Cell[];
  onMove: (idx: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-md">
      {board.map((cell, i) => {
        const row = Math.floor(i / 3) + 1;
        const col = (i % 3) + 1;
        const isDisabled = !!cell || !!disabled;
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
            className="aspect-square rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 flex items-center justify-center text-5xl font-extrabold transition-colors"
          >
            {cell ?? ""}
          </button>
        );
      })}
    </div>
  );
}
