"use client";

import React from "react";
import PrizeClient from "./PrizeClient";

export default function PrizesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-6xl max-h-[85vh] rounded-xl border border-white/10 bg-black/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50">
          <div className="text-base md:text-lg font-extrabold tracking-tight">All Prizes</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-2 md:p-4">
          <PrizeClient />
        </div>
      </div>
    </div>
  );
}
