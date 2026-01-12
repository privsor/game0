"use client";
import { useState } from "react";

export default function InteractionBar({
  onWant,
  onComments,
  onWinners,
  disabled,
  counts,
  wantedByMe,
  recentWanters,
  recentCommenters,
  recentWinners,
  onWantAvatarsClick,
  onCommentsAvatarsClick,
  onWinnersAvatarsClick,
}: {
  onWant: () => void;
  onComments: () => void;
  onWinners: () => void;
  disabled?: boolean;
  counts?: { want?: number; comments?: number; winners?: number };
  wantedByMe?: boolean;
  recentWanters?: Array<{ userId: string; image: string | null; name: string | null }>;
  recentCommenters?: Array<{ userId: string; image: string | null; name: string | null }>;
  recentWinners?: Array<{ userId: string; image: string | null; name: string | null }>;
  onWantAvatarsClick?: () => void;
  onCommentsAvatarsClick?: () => void;
  onWinnersAvatarsClick?: () => void;
}) {
  const want = counts?.want ?? 0;
  const comments = counts?.comments ?? 0;
  const winners = counts?.winners ?? 0;

  // Abbreviate large numbers: 1,234 -> 1.2K; 1,234,567 -> 1.2M; etc.
  const formatCount = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return `${n}`;
  };

  // Reusable row item with icon on left and stacked count/label on right
  const RowItem = ({
    icon,
    label,
    count,
    onClick,
    active,
    inlineRight,
  }: {
    icon: string;
    label: string;
    count: number;
    onClick: () => void;
    active?: boolean;
    inlineRight?: React.ReactNode;
  }) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-white/10 disabled:opacity-50 ${
        active ? "bg-white/10" : ""
      }`}
    >
      {/* Icon left: ensure white-on-black via CSS filters for arbitrary SVGs */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        <img
          src={icon}
          alt={label}
          className={`${active ? "invert" : ""} brightness-200`}
          width={24}
          height={24}
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-0">
          <span
            className="relative z-10 mr-1.5 font-semibold leading-none"
            title={count.toLocaleString()}
          >
            {formatCount(count)}
          </span>
          {inlineRight}
        </div>
        <div className="truncate text-xs text-white/70">{label}</div>
      </div>
    </button>
  );

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3">
      <RowItem
        icon={"/icons/prize-card/want-this.svg"}
        label="want this"
        count={want}
        onClick={() => {
          onWant();
        }}
        active={!!wantedByMe}
        inlineRight={
          <button onClick={onWantAvatarsClick} className="-ml-1 flex -space-x-2.5">
            {(recentWanters ?? []).slice(0, 5).map((u) => (
              <img
                key={u.userId}
                src={u.image ?? "/default-avatar.png"}
                alt={u.name ?? ""}
                className="h-4 w-4 rounded-full border border-black object-cover"
              />
            ))}
          </button>
        }
      />
      <RowItem
        icon="/icons/prize-card/comment.svg"
        label="Comments"
        count={comments}
        onClick={onComments}
        inlineRight={
          <button onClick={onCommentsAvatarsClick} className="-ml-1 flex -space-x-2.5">
            {(recentCommenters ?? []).slice(0, 5).map((u) => (
              <img
                key={u.userId}
                src={u.image ?? "/default-avatar.png"}
                alt={u.name ?? ""}
                className="h-4 w-4 rounded-full border border-black object-cover"
              />
            ))}
          </button>
        }
      />
      <RowItem
        icon="/icons/prize-card/winners.svg"
        label="Winners"
        count={winners}
        onClick={onWinners}
        inlineRight={
          <button onClick={onWinnersAvatarsClick} className="-ml-1 flex -space-x-2.5">
            {(recentWinners ?? []).slice(0, 5).map((u) => (
              <img
                key={u.userId}
                src={u.image ?? "/default-avatar.png"}
                alt={u.name ?? ""}
                className="h-4 w-4 rounded-full border border-black object-cover"
              />
            ))}
          </button>
        }
      />
    </div>
  );
}
