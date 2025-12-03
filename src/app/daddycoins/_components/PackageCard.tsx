"use client";

import Image from "next/image";
import React from "react";

type PackageCardProps = {
  coins: number;
  priceLabel: string;
  basePrice?: string;
  sub: string;
  busyId: number | null;
  balance: number;
  onBuy: (coins: number) => void;
  variant?: "default" | "modal";
};

export default function PackageCard({ coins, priceLabel, basePrice, sub, busyId, balance, onBuy, variant = "default" }: PackageCardProps) {
  // Determine stack layout per row based on coin package
  // Each stack visually represents up to 10 coins
  const stacks = Math.ceil(coins / 10);
  let rows: number[] = [];
  if (coins === 30) {
    rows = [3]; // 3 stacks in one row
  } else if (coins === 100) {
    rows = [4, 4, 2]; // 10 stacks as 4-4-2
  } else if (coins === 200) {
    rows = [5, 5, 5, 5]; // 20 stacks, 5 per row
  } else {
    // Fallback: fill rows up to 4 per row to keep visuals readable
    const perRow = 4;
    let remaining = stacks;
    while (remaining > 0) {
      rows.push(Math.min(perRow, remaining));
      remaining -= perRow;
    }
  }

  const maxInRow = Math.max(...rows);
  // Size the stack based on how many we need to fit per row
  const size = variant === "modal"
    ? (maxInRow >= 5 ? 48 : maxInRow === 4 ? 64 : maxInRow === 3 ? 80 : 80)
    : (maxInRow >= 5 ? 56 : maxInRow === 4 ? 83.33 : maxInRow === 3 ? 100 : 100); // px
  const offset = variant === "modal" ? 1.8 : 2; // tighter stack step in modal
  const shown = 10; // visual per stack
  const box = size + offset * (shown - 1);

  const Stack = () => {
    const topReal = size >= 100 ? 2 : 1; // use 2 real images for largest stacks, else 1
    return (
      <div className="relative" style={{ width: box, height: box }} aria-label={`coin stack of ${shown}`}>
        {/* Base tight shadow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: box * 0.45,
            height: box * 0.3,
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0.9), rgba(0,0,0,0) 45%)",
            filter: "blur(1px)",
          }}
        />
        {Array.from({ length: shown }).map((_, i) => {
          const left = i * offset;
          const bottom = i * offset;
          const isReal = i >= shown - topReal; // only top 1-2 layers use the SVG image
          const commonStyle: React.CSSProperties = {
            left,
            bottom,
            zIndex: i + 1,
            filter: "drop-shadow(0 2px 1.5px rgba(0,0,0,0.95)) drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.9))",
          };
          if (isReal) {
            return (
              <Image
                key={`real-${i}`}
                src="/daddycoin.svg"
                alt="DaddyCoin"
                width={size}
                height={size}
                className="absolute rounded-full ring-1 ring-white/10"
                style={commonStyle}
                priority={i < 2}
              />
            );
          }
          // Lightweight circle for lower layers
          return (
            <div
              key={`ph-${i}`}
              aria-hidden
              className="absolute rounded-full ring-1 ring-white/10"
              style={{
                ...commonStyle,
                width: size,
                height: size,
                background:
                  "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.9), rgba(240,240,240,0.95) 55%, rgba(235,235,235,0.95) 75%, rgba(230,230,230,0.9))",
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`relative z-0 rounded-xl border border-white/10 bg-white/5 ${variant === "modal" ? "p-3" : "p-2 md:p-5"}`}>
      <div className="mb-3 flex w-full flex-col items-start gap-2 isolate">
        {/* Render rows */}
        {rows.map((count, idx) => (
          <div key={`row-${idx}`} className="flex w-full flex-row justify-center items-center gap-2">
            {Array.from({ length: count }).map((_, j) => (
              <Stack key={`stack-${idx}-${j}`} />
            ))}
          </div>
        ))}
      </div>

      <div className="mb-1 text-sm text-white/60">{sub}</div>
      <div className="mb-4 text-3xl font-extrabold">
        {priceLabel} {basePrice && basePrice !== priceLabel && (
          <span className="text-white/60 line-through">{basePrice}</span>
        )}
      </div>
      <button
        onClick={() => onBuy(coins)}
        disabled={busyId === coins || balance >= 200}
        className="w-full rounded-md bg-white px-3 py-2 font-semibold text-lg text-black hover:bg-white/90 disabled:opacity-50"
      >
        {busyId === coins ? "Processing…" : balance >= 200 ? "Balance Limit Reached - play and earn more" : `Buy`}
      </button>
    </div>
  );
}
