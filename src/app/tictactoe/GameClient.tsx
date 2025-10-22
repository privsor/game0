"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { getChannel } from "~/lib/ably";
import { Board } from "./_components/Board";
import type { Cell } from "./_components/Board";
import { JoinPanel } from "./_components/JoinPanel";

type GameState = {
  board: Cell[]; // 9 cells
  next: "X" | "O";
  winner: "X" | "O" | "Draw" | null;
};

type Role = "X" | "O";

type WireEvent =
  | { type: "hello" }
  | { type: "move"; idx: number; by: Role }
  | { type: "reset" }
  | { type: "sync"; state: GameState };

function calculateWinner(board: Cell[]): GameState["winner"] {
  const lines: Array<[number, number, number]> = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(Boolean)) return "Draw";
  return null;
}

function initialState(): GameState {
  return { board: Array<Cell>(9).fill(null), next: "X", winner: null };
}

export default function GameClient() {
  const router = useRouter();
  const search = useSearchParams();
  const initialRoom = (search?.get("room") || "").toUpperCase();
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [inputCode, setInputCode] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [state, setState] = useState<GameState>(initialState);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState(0);

  const channelName = useMemo(() => (roomCode ? `room-${roomCode}` : null), [roomCode]);

  useEffect(() => {
    if (!channelName) return;

    let unsub: (() => void) | null = null;

    (async () => {
      const ch = await getChannel(channelName);

      // Presence determines role assignment
      try {
        await ch.presence.enter({ at: Date.now() });
        const members: any[] = await ch.presence.get();
        setPeers(members.length);
        // Prefer role from localStorage if returning
        const saved = typeof window !== "undefined" ? localStorage.getItem(`role:${channelName}`) : null;
        let assigned: Role | null = (saved as Role | null) ?? null;
        if (!assigned) {
          // Assign role by join order: first -> X, second -> O, others -> spectator (null)
          const count = members.length;
          assigned = count <= 1 ? "X" : count === 2 ? "O" : null;
        }
        setRole(assigned);
      } catch {}

      // Send hello to get current state from an existing peer
      await ch.publish("hello", { type: "hello" } as WireEvent);

      const onMessage = (msg: any) => {
        const data = msg.data as WireEvent;
        if (!data) return;
        if (data.type === "move") {
          setState((prev) => {
            if (prev.winner) return prev;
            if (prev.board[data.idx]) return prev;
            if (prev.next !== data.by) return prev;
            const board = prev.board.slice();
            board[data.idx] = data.by;
            const winner = calculateWinner(board);
            const next = winner ? prev.next : (prev.next === "X" ? "O" : "X");
            return { board, next, winner };
          });
        } else if (data.type === "reset") {
          setState(initialState());
        } else if (data.type === "sync") {
          setState(data.state);
        }
      };

      const onConnected = () => setConnected(true);
      const onDisconnected = () => setConnected(false);

      // Subscribe to channel messages (non-promise API)
      ch.subscribe(onMessage);
      ch.presence.subscribe("enter", async () => {
        const membersNow: any[] = await ch.presence.get();
        setPeers(membersNow.length);
        ch.publish("sync", { type: "sync", state });
      });
      ch.presence.subscribe("leave", async () => {
        const membersNow: any[] = await ch.presence.get();
        setPeers(membersNow.length);
      });
      ch.client.connection.on("connected", onConnected);
      ch.client.connection.on("disconnected", onDisconnected);

      unsub = () => {
        try { ch.unsubscribe(onMessage as any); } catch {}
        try { ch.presence.leave(); } catch {}
        try { ch.client.connection.off("connected", onConnected); } catch {}
        try { ch.client.connection.off("disconnected", onDisconnected); } catch {}
      };
    })();

    return () => {
      unsub?.();
    };
  }, [channelName]);

  useEffect(() => {
    if (channelName && role) {
      try { localStorage.setItem(`role:${channelName}`, role); } catch {}
    }
  }, [channelName, role]);

  const startNewRoom = () => {
    const code = nanoid(6).toUpperCase();
    setRoomCode(code);
    router.replace(`/tictactoe?room=${code}`);
  };

  const joinRoom = () => {
    if (inputCode.trim().length >= 4) {
      const code = inputCode.trim().toUpperCase();
      setRoomCode(code);
      router.replace(`/tictactoe?room=${code}`);
    }
  };

  const makeMove = async (idx: number) => {
    if (!channelName || !role || state.winner) return;
    if (state.board[idx]) return;
    if (state.next !== role) return;
    const ch = await getChannel(channelName);
    const evt: WireEvent = { type: "move", idx, by: role };
    await ch.publish("move", evt);
  };

  const resetGame = async () => {
    if (!channelName) return;
    const ch = await getChannel(channelName);
    await ch.publish("reset", { type: "reset" } satisfies WireEvent);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-3xl font-extrabold tracking-tight mb-4">Tic Tac Toe</h1>

        {!roomCode ? (
          <JoinPanel
            inputCode={inputCode}
            setInputCode={setInputCode}
            onCreate={startNewRoom}
            onJoin={joinRoom}
          />
        ) : (
          <div className="grid gap-5">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between">
              <div className="text-white/80">
                Room <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono">{roomCode}</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <span>{connected ? "Online" : "Connecting"}</span>
                <span>·</span>
                <span>Players {peers}</span>
                <button
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    navigator.clipboard?.writeText(url).catch(() => {});
                  }}
                  className="rounded bg-white/10 hover:bg-white/20 px-2 py-1"
                >
                  Copy link
                </button>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center justify-center gap-3">
              {peers < 2 ? (
                <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">Waiting for opponent…</span>
              ) : null}
              {role && state.next === role && !state.winner ? (
                <span className="animate-pulse rounded-full bg-white text-black px-3 py-1 text-xs font-semibold">Your turn</span>
              ) : null}
            </div>

            <Board board={state.board} onMove={makeMove} disabled={!role || state.next !== role || !!state.winner} />

            <div className="flex items-center justify-between text-white/80">
              <div>
                You are <span className="font-bold">{role ?? "Spectator"}</span>
              </div>
              <div>
                Next <span className="font-bold">{state.next}</span>
              </div>
            </div>

            <div className="min-h-[2.25rem] text-center">
              {state.winner ? (
                <div className="text-xl font-bold">
                  {state.winner === "Draw" ? "It's a draw!" : `${state.winner} wins!`}
                </div>
              ) : null}
            </div>

            <div className="flex justify-between">
              <button
                onClick={resetGame}
                className="rounded border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setRoomCode("");
                  setState(initialState());
                  setRole(null);
                }}
                className="rounded bg-red-500/80 hover:bg-red-500 px-4 py-2"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
