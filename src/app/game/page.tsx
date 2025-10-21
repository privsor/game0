"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { getChannel } from "~/lib/ably";

type Cell = "X" | "O" | null;

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

export default function GamePage() {
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
        // Prefer role from localStorage if returning
        const saved = typeof window !== "undefined" ? localStorage.getItem(`role:${channelName}`) : null;
        let assigned: Role | null = (saved as Role | null) ?? null;
        if (!assigned) {
          // Assign role by join order: first -> X, second -> O, others -> spectator (null)
          const count = members.length;
          assigned = count <= 1 ? "X" : count === 2 ? "O" : null;
        }
        setRole(assigned);
        if (assigned) {
          // Append role to clientId for visibility; Ably clientId is set at instantiation
          // We'll instead store role locally and broadcast hello
        }
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
        } else if (data.type === "hello") {
          // ignore: only used as a trigger for someone to sync
        }
      };

      const onConnected = () => setConnected(true);
      const onDisconnected = () => setConnected(false);

      ch.subscribe(onMessage).catch(() => {});
      ch.presence.subscribe("enter", async () => {
        // When someone joins, share state
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
        ch.unsubscribe().catch(() => {});
        ch.presence.leave().catch(() => {});
        ch.client.connection.off("connected", onConnected);
        ch.client.connection.off("disconnected", onDisconnected);
      };
    })();

    return () => {
      unsub?.();
    };
  }, [channelName]);

  useEffect(() => {
    // Persist role selection per room
    if (channelName && role) {
      try { localStorage.setItem(`role:${channelName}`, role); } catch {}
    }
  }, [channelName, role]);

  const startNewRoom = () => {
    const code = nanoid(6).toUpperCase();
    setRoomCode(code);
    router.replace(`/game?room=${code}`);
  };

  const joinRoom = () => {
    if (inputCode.trim().length >= 4) {
      const code = inputCode.trim().toUpperCase();
      setRoomCode(code);
      router.replace(`/game?room=${code}`);
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#111827] text-white px-4 py-10">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-4xl font-extrabold tracking-tight mb-8">
          Tic Tac Toe
        </h1>

        {!roomCode ? (
          <div className="grid gap-4 rounded-2xl bg-white/5 p-6 backdrop-blur">
            <button
              onClick={startNewRoom}
              className="rounded-xl bg-violet-500/90 hover:bg-violet-400 px-6 py-3 font-semibold transition-colors"
            >
              Create Room
            </button>
            <div className="flex items-center gap-3">
              <input
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Enter Room Code"
                className="flex-1 rounded-xl bg-white/10 px-4 py-3 outline-none placeholder:text-white/60"
              />
              <button
                onClick={joinRoom}
                className="rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-6 py-3 font-semibold transition-colors"
              >
                Join
              </button>
            </div>
            <p className="text-sm text-white/60">
              Share the room code with a friend to play in real-time.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="rounded-2xl bg-white/5 p-4 flex items-center justify-between">
              <div className="text-white/80">
                Room
                <span className="ml-2 rounded-lg bg-white/10 px-2 py-1 font-mono">{roomCode}</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <span>Players: {peers}</span>
                <span>·</span>
                <span>Status: {connected ? "Connected" : "Connecting..."}</span>
                <button
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    navigator.clipboard?.writeText(url).catch(() => {});
                  }}
                  className="ml-2 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1"
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {state.board.map((cell, i) => (
                <button
                  key={i}
                  onClick={() => makeMove(i)}
                  className="aspect-square rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-5xl font-extrabold transition-colors"
                >
                  {cell ?? ""}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-white/80">
              <div>
                You are: <span className="font-bold">{role ?? "Spectator"}</span>
              </div>
              <div>
                Next: <span className="font-bold">{state.next}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-4 text-center min-h-[3rem]">
              {state.winner ? (
                <div className="text-2xl font-bold">
                  {state.winner === "Draw" ? "It's a draw!" : `${state.winner} wins!`}
                </div>
              ) : null}
            </div>

            <div className="flex justify-between">
              <button
                onClick={resetGame}
                className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setRoomCode("");
                  setState(initialState());
                  setRole(null);
                }}
                className="rounded-xl bg-red-500/80 hover:bg-red-500 px-4 py-2"
              >
                Leave Room
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
