"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { getChannel } from "~/lib/ably";
import type { Cell } from "../tictactoe/_components/Board";
import { Board } from "../tictactoe/_components/Board";

export type WireState = {
  board: Cell[];
  next: "X" | "O";
  winner: "X" | "O" | "Draw" | null;
  players?: { X: string | null; O: string | null };
  names?: { X: string | null; O: string | null };
  avatars?: { X: string | null; O: string | null };
  turn?: number;
};

export default function GameClientNew(props: {
  roomCode: string;
  user: { id: string; name: string | null; image: string | null } | null;
  initial: {
    board: string; // "---------"
    next: string; // "X" | "O"
    winner: string; // '-'|'X'|'O'|'D'
    turn: number;
    players: { X: string | null; O: string | null };
    names: { X: string | null; O: string | null };
    avatars: { X: string | null; O: string | null };
  };
}) {
  const { data: session } = useSession();
  const roomCode = props.roomCode;
  // Stable anonymous ID for guests, mirrors legacy client behavior
  const userId = useMemo(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("ttt-user-id");
    if (!id) {
      try {
        id = `g_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("ttt-user-id", id);
      } catch {}
    }
    return id || "";
  }, []);
  const [state, setState] = useState<WireState>({
    board: props.initial.board.split("").map((c) => (c === '-' ? null : (c as Cell))) as Cell[],
    next: (props.initial.next as 'X'|'O'),
    winner: props.initial.winner === '-' ? null : (props.initial.winner === 'D' ? 'Draw' : (props.initial.winner as 'X'|'O')),
    turn: props.initial.turn,
    players: props.initial.players,
    names: props.initial.names,
    avatars: props.initial.avatars,
  });
  const [role, setRole] = useState<"X" | "O" | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [joining, setJoining] = useState(false);
  const joinPromptedRef = useRef(false);
  const [joinName, setJoinName] = useState<string>("");

  // Seed join name from session or localStorage
  useEffect(() => {
    if (session?.user?.name) {
      setJoinName(session.user.name);
      return;
    }
    try {
      const saved = localStorage.getItem("ttt-name") || "";
      if (saved) setJoinName(saved);
    } catch {}
  }, [session?.user?.name]);

  // Subscribe to realtime state
  useEffect(() => {
    let channel: any;
    const onMessage = (msg: any) => {
      const data = msg.data as { type: "state"; state: WireState };
      if (!data || data.type !== "state") return;
      setState((prev) => ({ ...prev, ...data.state }));
    };
    (async () => {
      channel = await getChannel(`room-${roomCode}`);
      channel.subscribe(onMessage);
    })();
    return () => {
      if (!channel) return;
      try { channel.unsubscribe(onMessage); } catch {}
    };
  }, [roomCode]);

  // If only X present and we are not assigned, prompt join; if room empty, prompt create
  useEffect(() => {
    const hasX = !!state.players?.X;
    const hasO = !!state.players?.O;
    if (!hasX && !hasO && !joinPromptedRef.current) {
      joinPromptedRef.current = true;
      setShowJoin(true);
    } else if (hasX && !hasO && !joinPromptedRef.current) {
      joinPromptedRef.current = true;
      setShowJoin(true);
    }
  }, [state.players?.X, state.players?.O]);

  const joinAs = async (preferred: 'X'|'O'|'auto') => {
    if (joining) return;
    setJoining(true);
    try {
      // persist name locally for guest UX
      try { localStorage.setItem('ttt-name', joinName); } catch {}
      const res = await fetch('/api/tictactoe/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomCode, userId: props.user?.id || userId, name: joinName, preferredRole: preferred }),
      });
      const data = await res.json();
      if (data?.ok) {
        setState(data.state);
        setRole(data.userRole);
        setShowJoin(false);
      }
    } finally {
      setJoining(false);
    }
  };

  // Moves
  const onMove = async (idx: number) => {
    // Gate: must have role, must be our turn, and no winner
    if (!role || state.winner || (state.next !== role)) return;
    try {
      await fetch('/api/tictactoe/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomCode, userId: props.user?.id || userId, idx }),
      });
      // Ably broadcast will update state; no optimistic update needed
    } catch {}
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Tic Tac Toe (New)</h1>

      {/* Players strip */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
        <span className="inline-flex items-center gap-2">
          <span className="text-white/50">X</span>
          {state.avatars?.X ? (
            <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
              <Image src={state.avatars.X} alt="X avatar" width={20} height={20} />
            </span>
          ) : (
            <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
          )}
          <span className="font-medium">{state.names?.X || '—'}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-white/50">O</span>
          {state.avatars?.O ? (
            <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
              <Image src={state.avatars.O} alt="O avatar" width={20} height={20} />
            </span>
          ) : (
            <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
          )}
          <span className="font-medium">{state.names?.O || '—'}</span>
        </span>
      </div>

      {/* Board */}
      <Board
        board={state.board}
        onMove={onMove}
        disabled={!role || !!state.winner || state.next !== role}
      />

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[420px] rounded-xl bg-black/90 p-5 border border-white/10">
            <h2 className="text-xl font-bold mb-3">Join game</h2>
            <p className="text-white/70 mb-4">You are about to play with <span className="font-semibold">{state.names?.X || 'Player 1'}</span></p>
            <div className="mb-4 grid gap-2">
              <button
                onClick={() => signIn("discord", { callbackUrl: `/tictactoe-new/${roomCode}` })}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
              >
                Continue with Discord
              </button>
              <button
                onClick={() => signIn("google", { callbackUrl: `/tictactoe-new/${roomCode}` })}
                className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
              >
                Continue with Google
              </button>
            </div>
            <div className="flex gap-3 justify-between">
              <button
                disabled={joining}
                onClick={() => setShowJoin(false)}
                className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
              >Watch instead</button>
              <button
                disabled={joining}
                onClick={() => joinAs('O')}
                className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold disabled:opacity-60"
              >{joining ? 'Joining…' : 'Join as O'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
