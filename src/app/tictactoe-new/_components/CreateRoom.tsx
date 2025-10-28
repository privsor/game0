"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

// Short uppercase code like ABC123 (6 chars)
function makeRoomCode() {
  // Use nanoid and filter to A-Z0-9, then slice to 6
  const base = nanoid(10).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return base.slice(0, 6);
}

export default function CreateRoom() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const newCode = useMemo(() => makeRoomCode(), []);

  const go = useCallback((room: string) => {
    if (!room) return;
    router.push(`/tictactoe-new/${room.toUpperCase()}`);
  }, [router]);

  const createRoom = useCallback(() => {
    if (busy) return;
    setBusy(true);
    try {
      go(newCode);
    } finally {
      setBusy(false);
    }
  }, [busy, go, newCode]);

  const joinRoom = useCallback(() => {
    if (!code.trim()) return;
    go(code.trim());
  }, [code, go]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Tic Tac Toe (New)</h1>

      <div className="rounded-xl border border-white/10 bg-black/60 p-6">
        <h2 className="text-lg font-semibold mb-4">Create a room</h2>
        <p className="text-white/70 mb-3">You will be Player X. Share the link with a friend to play.</p>
        <button
          onClick={createRoom}
          disabled={busy}
          className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold disabled:opacity-60"
        >Create room ({newCode})</button>
      </div>

      <div className="h-6" />

      <div className="rounded-xl border border-white/10 bg-black/60 p-6">
        <h2 className="text-lg font-semibold mb-4">Join a room</h2>
        <div className="flex gap-3 items-center">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter room code (e.g., ABC123)"
            className="flex-1 rounded-lg bg-white/10 px-4 py-2 outline-none"
          />
          <button
            onClick={joinRoom}
            className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
          >Join</button>
        </div>
      </div>
    </main>
  );
}
