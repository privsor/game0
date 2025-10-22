"use client";

import React from "react";

export function JoinPanel({
  inputCode,
  setInputCode,
  onCreate,
  onJoin,
}: {
  inputCode: string;
  setInputCode: (v: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
      <button
        onClick={onCreate}
        className="rounded-lg bg-white text-black px-5 py-3 font-semibold hover:bg-white/90"
      >
        Create Room
      </button>
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
