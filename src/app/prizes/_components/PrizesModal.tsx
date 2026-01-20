"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PrizeClient from "./PrizeClient";

export default function PrizesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollBarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarGap > 0) document.body.style.paddingRight = `${scrollBarGap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" role="dialog" aria-modal="true">
      <div className="relative w-full lg:max-w-6xl max-h-[85vh] flex flex-col rounded-xl border border-white/10 bg-black/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="flex flex-none items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50">
          <div className="text-base md:text-lg font-extrabold tracking-tight">All Prizes</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain md:p-4 text-left">
          <PrizeClient />
        </div>
      </div>
    </div>
  );
  // Render in a portal so it is not constrained by any parent modal or transforms
  return mounted && typeof window !== "undefined" && document?.body
    ? createPortal(content, document.body)
    : content;
}
