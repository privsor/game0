"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export default function VariantSelector({
  variants,
  selectedIdx,
  setSelectedIdx,
  onInteract,
}: {
  variants: Array<{ id: number; label: string; buttonLabel?: string | null; coinCost: number }>;
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  onInteract?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // When selectedIdx changes (including ambient auto-rotate), center the active tile
  useEffect(() => {
    const el = itemRefs.current[selectedIdx];
    const container = containerRef.current;
    if (!el || !container) return;
    // Compute horizontal center without affecting vertical scroll
    const elCenter = el.offsetLeft + el.offsetWidth / 2;
    const targetScrollLeft = Math.max(0, elCenter - container.clientWidth / 2);
    container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
  }, [selectedIdx]);

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto scroll-smooth"
      onScroll={() => onInteract?.()}
      onMouseEnter={() => onInteract?.()}
      onTouchStart={() => onInteract?.()}
    >
      <div className="flex gap-2 pb-1 snap-x snap-mandatory">
        {variants.map((v, idx) => {
          const active = idx === selectedIdx;
          return (
            <button
              key={v.id}
              ref={(n) => {
                itemRefs.current[idx] = n;
              }}
              onClick={() => {
                onInteract?.();
                setSelectedIdx(idx);
              }}
              className={` flex-1 snap-center rounded-md border px-3 py-2 text-left transition-colors ${
                active ? "border-white bg-white text-black" : "border-white/10 bg-black/40 text-white"
              }`}
            >
              <div className="text-sm font-semibold truncate">{v.buttonLabel ?? v.label}</div>
              {/* <div className={`mt-1 inline-flex items-center gap-1 text-xs ${active ? "text-black/70" : "text-white/70"}`}>
                <Image src="/icons/daddycoin.svg" width={14} height={14} alt="coin" />
                <span className="font-semibold">{v.coinCost}</span>
              </div> */}
            </button>
          );
        })}
      </div>
    </div>
  );
}
