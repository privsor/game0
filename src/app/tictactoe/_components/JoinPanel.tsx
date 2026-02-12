"use client";

import React from "react";

export function JoinPanel({
  inputCode,
  setInputCode,
  onCreate,
  onJoin,
  onScanQR,
}: {
  inputCode: string;
  setInputCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onScanQR: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
      <button
        onClick={onCreate}
        className="rounded-lg bg-white text-black px-5 py-3 font-semibold hover:bg-white/90"
      >
        Create Room
      </button>
      <div className="my-1 flex items-center gap-3 text-xs text-white/50">
        <div className="h-px flex-1 bg-white/10" />
        <span>or join existing room</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <button
        onClick={onScanQR}
        className="rounded-lg border border-white/20 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10 flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Scan QR Code
      </button>
      <div className="my-1 flex items-center gap-3 text-xs text-white/50">
        <div className="h-px flex-1 bg-white/10" />
        <span>or enter code</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="flex items-center gap-3">
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          placeholder="Enter Room Code"
          className="flex-1 rounded-lg bg-white/10 px-4 py-3 outline-none placeholder:text-white/60"
        />
        <button
          onClick={onJoin}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 font-semibold hover:bg-white/15"
        >
          Join
        </button>
      </div>
      <p className="text-sm text-white/60">Share the room code with a friend to play in real-time.</p>
    </div>
  );
}
