"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  players?: { X: string | null; O: string | null };
  names?: { X: string | null; O: string | null };
};

type Role = "X" | "O";

type WireEvent =
  | { type: "state"; state: GameState & { turn?: number; players?: { X: string | null; O: string | null }, names?: { X: string | null; O: string | null } } };

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
  return {
    board: Array<Cell>(9).fill(null),
    next: "X",
    winner: null,
    players: { X: null, O: null },
    names: { X: null, O: null },
  };
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
  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState("");
  const joinPromptedRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Generate stable anonymous user ID
  const userId = useMemo(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("ttt-user-id");
    if (!id) {
      id = nanoid(12);
      localStorage.setItem("ttt-user-id", id);
    }
    return id;
  }, []);

  const channelName = useMemo(() => (roomCode ? `room-${roomCode}` : null), [roomCode]);

  // Lock page scrolling while this view is active (app-like feel)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (!channelName || !userId) return;

    let unsub: (() => void) | null = null;

    (async () => {
      // Fetch current state and role from server
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            setState({
              board: data.state.board,
              next: data.state.next,
              winner: data.state.winner ?? null,
              players: data.state.players ?? { X: null, O: null },
              names: data.state.names ?? { X: null, O: null },
            });
            setRole(data.userRole);
            // Decide if we should prompt to join
            if (!joinPromptedRef.current) {
              const hasX = !!(data.state.players?.X);
              const hasO = !!(data.state.players?.O);
              const myRole = data.userRole as Role | null;
              if (!myRole) {
                // Prefill name from localStorage or sensible default
                let stored = "";
                try {
                  stored = (localStorage.getItem("ttt-name") || "").trim();
                } catch {}
                let defaultName = stored;
                if (!defaultName) {
                  defaultName = hasX ? "Player 2" : "Player 1";
                } else {
                  // If X exists and O is empty, prefer suggesting Player 2 even if stored was Player 1
                  if (hasX && !hasO && defaultName.toLowerCase() === "player 1") {
                    defaultName = "Player 2";
                  }
                  // If both empty, prefer Player 1 even if stored was Player 2
                  if (!hasX && !hasO && defaultName.toLowerCase() === "player 2") {
                    defaultName = "Player 1";
                  }
                }
                setJoinName(defaultName);
                setShowJoin(true);
                joinPromptedRef.current = true;
              }
            }
          }
        }
      } catch {}

      // Attach with rewind=1 to immediately receive last authoritative state
      const ch = await getChannel(channelName, { params: { rewind: 1 } });
      // Initialize connection status (getChannel waits until connected, so we may have missed the 'connected' event)
      try { setConnected(ch.client.connection.state === 'connected'); } catch {}

      try {
        await ch.presence.enter({ at: Date.now() });
        const members: any[] = await ch.presence.get();
        setPeers(members.length);
      } catch {}

      const onMessage = (msg: any) => {
        const data = msg.data as WireEvent;
        if (!data) return;
        if (data.type === "state") {
          setState({
            board: data.state.board,
            next: data.state.next,
            winner: data.state.winner ?? null,
            players: data.state.players ?? { X: null, O: null },
            names: data.state.names ?? { X: null, O: null },
          });
        }
      };

      const onConnected = () => setConnected(true);
      const onDisconnected = () => setConnected(false);
      const onStateChange = (change: any) => {
        const st = change?.current || ch.client.connection.state;
        setConnected(st === 'connected');
      };

      ch.subscribe(onMessage);
      ch.presence.subscribe("enter", async () => {
        const membersNow: any[] = await ch.presence.get();
        setPeers(membersNow.length);
      });
      ch.presence.subscribe("leave", async () => {
        const membersNow: any[] = await ch.presence.get();
        setPeers(membersNow.length);
      });
      ch.client.connection.on("connected", onConnected);
      ch.client.connection.on("disconnected", onDisconnected);
      ch.client.connection.on("connectionstatechange", onStateChange);

      unsub = () => {
        try { ch.unsubscribe(onMessage as any); } catch {}
        try { ch.presence.leave(); } catch {}
        try { ch.client.connection.off("connected", onConnected); } catch {}
        try { ch.client.connection.off("disconnected", onDisconnected); } catch {}
        try { ch.client.connection.off("connectionstatechange", onStateChange); } catch {}
      };
    })();

    return () => {
      unsub?.();
    };
  }, [channelName, userId, roomCode]);

  useEffect(() => {
    if (channelName && role) {
      try { localStorage.setItem(`role:${channelName}`, role); } catch {}
    }
  }, [channelName, role]);

  // When room changes, allow prompting logic to run fresh
  useEffect(() => {
    joinPromptedRef.current = false;
    setShowJoin(false);
  }, [roomCode]);

  // Auto-close invite modal when both players are present
  useEffect(() => {
    if (!showInvite) return;
    const hasBoth = !!state.players?.X && !!state.players?.O;
    if (hasBoth) setShowInvite(false);
  }, [showInvite, state.players?.X, state.players?.O]);

  // While invite modal is open, poll server state as a fallback (in case realtime publish is delayed in production)
  useEffect(() => {
    if (!showInvite || !roomCode || !userId) return;
    let timer: any = null;
    const tick = async () => {
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.ok) {
            setState({
              board: data.state.board,
              next: data.state.next,
              winner: data.state.winner ?? null,
              players: data.state.players ?? { X: null, O: null },
              names: data.state.names ?? { X: null, O: null },
            });
            if (data.state.players?.X && data.state.players?.O) {
              setShowInvite(false);
            }
          }
        }
      } catch {}
    };
    // initial tick and interval
    tick();
    timer = setInterval(tick, 2000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showInvite, roomCode, userId]);

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
    if (!channelName || state.winner) return;
    // optimistic UI: apply locally and let Ably authoritative state reconcile
    setState((prev) => {
      if (prev.winner) return prev;
      if (prev.board[idx]) return prev;
      const board = prev.board.slice();
      board[idx] = prev.next;
      const winner = calculateWinner(board);
      const next = winner ? prev.next : (prev.next === "X" ? "O" : "X");
      return { board, next, winner };
    });
    try {
      const res = await fetch('/api/tictactoe/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomCode, idx, userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.userRole) {
          setRole(data.userRole);
        }
      } else {
        // On rejection, reconcile with authoritative state (use roomCode, not channelName)
        try {
          const s = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`, { cache: 'no-store' });
          if (s.ok) {
            const d = await s.json();
            if (d.ok) {
              setState(d.state);
              if (d.userRole) setRole(d.userRole);
            }
          }
        } catch {}
      }
    } catch {}
  };

  // Reset functionality removed as per product decision

  // Join helper inside component scope
  const joinAs = async (preferredRole: Role | 'auto') => {
    if (!roomCode || !userId || joining) return;
    setJoining(true);
    // Persist name immediately for better UX
    try { localStorage.setItem('ttt-name', joinName); } catch {}
    // Close modal immediately to reduce perceived latency
    setShowJoin(false);
    try {
      const res = await fetch('/api/tictactoe/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomCode, userId, name: joinName, preferredRole }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setState(data.state);
          setRole(data.userRole);
        } else {
          // Reopen modal on logical failure
          setShowJoin(true);
        }
      } else {
        setShowJoin(true);
      }
    } catch {
      setShowJoin(true);
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="flex min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden flex-col bg-black text-white px-4 py-6 md:p-0">
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-xl">
        <h1 className="text-center text-3xl font-extrabold tracking-tight mb-3 md:mb-2">Tic Tac Toe</h1>

        {!roomCode ? (
          <JoinPanel
            inputCode={inputCode}
            setInputCode={setInputCode}
            onCreate={startNewRoom}
            onJoin={joinRoom}
          />
        ) : (
          <div className="grid gap-5">
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-center text-white/70 text-sm gap-4">
              <div className="text-white/80">
                Room <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono">{roomCode}</span>
              </div>
              <span>·</span>
              <span className="inline-flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
                  aria-hidden
                />
                <span className="sr-only">{connected ? 'Online' : 'Connecting'}</span>
              </span>
              <span>·</span>
              <span>Online {peers}</span>
              <span>·</span>
              <button
                onClick={() => {
                  const url = typeof window !== "undefined" ? window.location.href : "";
                  navigator.clipboard?.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }).catch(() => {});
                }}
                className="rounded bg-white/10 hover:bg-white/20 px-2 py-1"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="rounded bg-white/10 hover:bg-white/20 px-2 py-1"
              >
                Bring a friend
              </button>
            </div>

            {/* Status badges */}
            <div className="flex items-center justify-center gap-3">
              {(() => {
                const hasPlayerX = state.players?.X !== null && state.players?.X !== undefined && state.players?.X !== '';
                const hasPlayerO = state.players?.O !== null && state.players?.O !== undefined && state.players?.O !== '';
                const playerCount = (hasPlayerX ? 1 : 0) + (hasPlayerO ? 1 : 0);
                
                if (playerCount === 0) {
                  return <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">Waiting for players…</span>;
                } else if (playerCount === 1) {
                  return <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">Waiting for opponent…</span>;
                }
                return null;
              })()}
              {role && !state.winner && state.next === role && (
                (role === 'X' ? !!state.players?.O : !!state.players?.X)
              ) ? (
                <span className="animate-pulse rounded-full bg-white text-black px-3 py-1 text-xs font-semibold">Your turn</span>
              ) : null}
              {(() => {
                if (state.winner) return null;
                const hasBoth = !!state.players?.X && !!state.players?.O;
                if (!hasBoth) return null;
                const isMyTurn = role && state.next === role;
                if (isMyTurn) return null;
                const nextName = state.next === 'X' ? (state.names?.X || 'Player 1') : (state.names?.O || 'Player 2');
                return (
                  <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
                    {nextName}'s turn
                  </span>
                );
              })()}
            </div>

            {/* Players summary */}
            <div className="text-center text-white/70 text-sm">
              X: <span className="font-semibold">{state.names?.X || '—'}</span> · O: <span className="font-semibold">{state.names?.O || '—'}</span>
            </div>

            <div className="flex justify-center">
              <Board 
                board={state.board} 
                onMove={makeMove} 
                disabled={
                  !!state.winner ||
                  (role === null) || (
                    role !== null && (
                      // must be your turn
                      state.next !== role ||
                      // if you are X, block until O joins
                      (role === 'X' && (!state.players || !state.players.O))
                    )
                  )
                }
              />
            </div>

            <div className="text-center text-white/80">
              You are <span className="font-bold">{role ?? "Spectator"}</span>
              {role ? (
                <span className="ml-2 text-white/60">(
                  {role === 'X' ? (state.names?.X || '') : (state.names?.O || '')}
                )</span>
              ) : null}
              <span className="mx-2 text-white/40">·</span>
              Next <span className="font-bold">{state.next}</span>{' '}
              <span className="text-white/60">(
                {state.next === 'X' ? (state.names?.X || 'Player 1') : (state.names?.O || 'Player 2')}
              )</span>
            </div>

            <div className="min-h-[2.25rem] text-center">
              {state.winner ? (
                <div className="text-xl font-bold">
                  {state.winner === "Draw" ? "It's a draw!" : `${state.winner} wins!`}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end md:justify-center">
              <button
                onClick={() => {
                  setRoomCode("");
                  setState(initialState());
                  setRole(null);
                }}
                className="rounded bg-red-500/80 hover:bg-red-500 px-4 py-2 md:fixed md:bottom-6 md:right-6"
              >
                Leave
              </button>
            </div>
          </div>
        )}

      {/* Invite modal */}
      {roomCode && showInvite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl text-center">
            {(() => {
              const hostName = state.names?.X || 'Player 1';
              return (
                <>
                  <h2 className="text-xl font-bold mb-1">Scan to join {hostName}'s room</h2>
                  <div className="text-white/60 text-sm mb-3">Room {roomCode}</div>
                </>
              );
            })()}
            {(() => {
              const url = typeof window !== 'undefined' ? window.location.href : '';
              const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
              return (
                <>
                  <div className="flex items-center justify-center mb-4">
                    {/* External QR image service for simplicity; can be replaced with local generator later */}
                    <img src={qrSrc} alt="Room QR code" className="rounded bg-white/5 p-2" />
                  </div>
                  <div className="text-xs text-white/60 break-all mb-3 px-2">{url}</div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: 'Join my Tic Tac Toe room', url }).catch(() => {});
                        } else {
                          navigator.clipboard?.writeText(url).catch(() => {});
                        }
                      }}
                      className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold"
                    >Share</button>
                    <button
                      onClick={() => setShowInvite(false)}
                      className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
                    >Close</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
        </div>
      </div>
      
      {/* Join modal */}
      {roomCode && showJoin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
            {(() => {
              const hasX = !!(state.players?.X);
              const hasO = !!(state.players?.O);
              const xn = state.names?.X || 'Player 1';
              const on = state.names?.O || 'Player 2';
              if (!hasX && !hasO) {
                return (
                  <>
                    <h2 className="text-xl font-bold mb-3">Create your player</h2>
                    <p className="text-white/70 mb-3">Enter your name. You will play as X.</p>
                    <input
                      autoFocus
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="Player 1"
                      className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4"
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        disabled={joining}
                        onClick={() => setShowJoin(false)}
                        className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
                      >Cancel</button>
                      <button
                        disabled={joining}
                        onClick={() => joinAs('X')}
                        className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold disabled:opacity-60"
                      >{joining ? 'Joining…' : 'Start as X'}</button>
                    </div>
                  </>
                );
              }
              if (hasX && !hasO) {
                return (
                  <>
                    <h2 className="text-xl font-bold mb-3">Join game</h2>
                    <p className="text-white/70 mb-2">Going to play with <span className="font-semibold">{xn}</span></p>
                    <label className="text-white/70 text-sm">Your player name</label>
                    <input
                      autoFocus
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="Player 2"
                      className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4 mt-1"
                    />
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
                  </>
                );
              }
              // both roles taken
              return (
                <>
                  <h2 className="text-xl font-bold mb-3">Room is full</h2>
                  <p className="text-white/70 mb-4"><span className="font-semibold">{xn}</span> is playing with <span className="font-semibold">{on}</span></p>
                  <div className="flex gap-3 justify-between">
                    <button
                      onClick={() => setShowJoin(false)}
                      className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold"
                    >Watch them play</button>
                    <button
                      onClick={() => { setRoomCode(""); setState(initialState()); setRole(null); router.replace('/tictactoe'); }}
                      className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
                    >Create your own room</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
