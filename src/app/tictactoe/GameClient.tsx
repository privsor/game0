"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { getChannel } from "~/lib/ably";
import { Board } from "./_components/Board";
import type { Cell } from "./_components/Board";
import { JoinPanel } from "./_components/JoinPanel";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";

type GameState = {
  board: Cell[]; // 9 cells
  next: "X" | "O";
  winner: "X" | "O" | "Draw" | null;
  players?: { X: string | null; O: string | null };
  names?: { X: string | null; O: string | null };
  avatars?: { X: string | null; O: string | null };
};

type Role = "X" | "O";

type WireEvent =
  | { type: "state"; state: GameState & { turn?: number; players?: { X: string | null; O: string | null }, names?: { X: string | null; O: string | null }, avatars?: { X: string | null; O: string | null } } };

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

function winningLine(board: Cell[]): number[] | null {
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
      return [a, b, c];
    }
  }
  return null;
}

function initialState(): GameState {
  return {
    board: Array<Cell>(9).fill(null),
    next: "X",
    winner: null,
    players: { X: null, O: null },
    names: { X: null, O: null },
    avatars: { X: null, O: null },
  };
}

export default function GameClient() {
  const { data: session } = useSession();
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
  const socialCallbackUrl = `/tictactoe?room=${roomCode}`;
  const joinPromptedRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareDone, setShareDone] = useState<null | 'copied' | 'shared'>(null);
  // Tooltip for invite button when only Player 1 is present
  const [showInviteHint, setShowInviteHint] = useState(false);
  // Track peers count locally to avoid presence.get on every presence event
  const peersCountRef = useRef(0);
  // Refs for values used inside effects without causing re-subscribe churn
  const roomCodeRef = useRef(roomCode);
  const userIdRef = useRef("");

  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

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

  // keep a ref in sync for effects/handlers without adding as dependency unnecessarily
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Compute when to show the invite tooltip (only X present, O missing)
  useEffect(() => {
    const hasX = !!(state.players?.X);
    const hasO = !!(state.players?.O);
    const shouldShow = !!roomCode && hasX && !hasO && !showInvite; // hide while invite modal is open
    setShowInviteHint(shouldShow);
  }, [roomCode, state.players?.X, state.players?.O, showInvite]);

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
        // Fire-and-forget presence enter to avoid blocking
        ch.presence.enter({ at: Date.now() }).catch(() => {});
        // Seed peers once
        const members: any[] = await ch.presence.get();
        peersCountRef.current = members.length;
        setPeers(peersCountRef.current);
      } catch {}

      const onMessage = (msg: any) => {
        const data = msg.data as WireEvent;
        if (!data) return;
        if (data.type === "state") {
          const incoming = {
            board: data.state.board,
            next: data.state.next,
            winner: data.state.winner ?? null,
            players: data.state.players ?? { X: null, O: null },
            names: data.state.names ?? { X: null, O: null },
            avatars: data.state.avatars ?? { X: null, O: null },
          } as GameState;
          setState((prev) => {
            // Shallow, targeted equality checks to avoid unnecessary renders
            const sameBoard = prev.board === incoming.board || (
              prev.board.length === incoming.board.length && prev.board.every((v, i) => v === incoming.board[i])
            );
            const sameNext = prev.next === incoming.next;
            const sameWinner = prev.winner === incoming.winner;
            const samePlayers = (prev.players?.X ?? null) === (incoming.players?.X ?? null)
              && (prev.players?.O ?? null) === (incoming.players?.O ?? null);
            const sameNames = (prev.names?.X ?? null) === (incoming.names?.X ?? null)
              && (prev.names?.O ?? null) === (incoming.names?.O ?? null);
            const sameAvatars = (prev.avatars?.X ?? null) === (incoming.avatars?.X ?? null)
              && (prev.avatars?.O ?? null) === (incoming.avatars?.O ?? null);
            if (sameBoard && sameNext && sameWinner && samePlayers && sameNames && sameAvatars) {
              return prev;
            }
            return incoming;
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
      ch.presence.subscribe("enter", () => {
        peersCountRef.current = Math.max(0, peersCountRef.current + 1);
        setPeers(peersCountRef.current);
      });
      ch.presence.subscribe("leave", () => {
        peersCountRef.current = Math.max(0, peersCountRef.current - 1);
        setPeers(peersCountRef.current);
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
  }, [channelName]);

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
    if (!showInvite || !roomCodeRef.current || !userIdRef.current) return;
    // Only poll as a fallback when the tab is hidden; rely on realtime otherwise
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    let timer: any = null;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCodeRef.current}&userId=${userIdRef.current}`,
          { signal: controller.signal, cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok) {
            setState((prev) => {
              const incoming = {
                board: data.state.board,
                next: data.state.next,
                winner: data.state.winner ?? null,
                players: data.state.players ?? { X: null, O: null },
                names: data.state.names ?? { X: null, O: null },
              } as GameState;
              const sameBoard = prev.board.length === incoming.board.length && prev.board.every((v, i) => v === incoming.board[i]);
              const sameNext = prev.next === incoming.next;
              const sameWinner = prev.winner === incoming.winner;
              const samePlayers = (prev.players?.X ?? null) === (incoming.players?.X ?? null) && (prev.players?.O ?? null) === (incoming.players?.O ?? null);
              const sameNames = (prev.names?.X ?? null) === (incoming.names?.X ?? null) && (prev.names?.O ?? null) === (incoming.names?.O ?? null);
              if (sameBoard && sameNext && sameWinner && samePlayers && sameNames) return prev;
              return incoming;
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
      controller.abort();
    };
  }, [showInvite]);

  const startNewRoom = useCallback(() => {
    const code = nanoid(6).toUpperCase();
    setRoomCode(code);
    router.replace(`/tictactoe?room=${code}`);
  }, [router]);

  const joinRoom = useCallback(() => {
    if (inputCode.trim().length >= 4) {
      const code = inputCode.trim().toUpperCase();
      if (code === roomCode) return;
      setRoomCode(code);
      router.replace(`/tictactoe?room=${code}`);
    }
  }, [inputCode, roomCode, router]);

  const makeMove = useCallback(async (idx: number) => {
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
  }, [channelName, roomCode, state.winner, userId]);

  // Reset functionality removed as per product decision

  // Join helper inside component scope
  const joinAs = useCallback(async (preferredRole: Role | 'auto') => {
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
  }, [joinName, joining, roomCode, userId]);

  return (
    <main className="flex min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden flex-col bg-black text-white px-4 py-6 md:p-0">
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-xl">
        <h1 className="text-center text-2xl md:text-3xl font-extrabold tracking-tight mb-3 md:mb-2">Tic Tac Toe</h1>

        {!roomCode ? (
          <JoinPanel
            inputCode={inputCode}
            setInputCode={setInputCode}
            onCreate={startNewRoom}
            onJoin={joinRoom}
          />
        ) : (
          <div className="grid gap-2 md:gap-5">
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 md:p-3 flex flex-wrap md:flex-nowrap items-center justify-between text-white/70 text-sm gap-2 md:gap-4 overflow-x-auto">
              <div className="text-white/80">
                Room <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono">{roomCode}</span>
              </div>
              <span className="hidden sm:inline">·</span>
              <span className="inline-flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
                  aria-hidden
                />
                <span className="sr-only">{connected ? 'Online' : 'Connecting'}</span>
              </span>
              <span className="hidden sm:inline">·</span>
              <span><span className="hidden sm:inline">Online </span>{peers}</span>
              <span className="hidden sm:inline">·</span>
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
                {copied ? 'Copied!' : (<><span className="sm:hidden">Copy link</span><span className="hidden sm:inline">Copy link</span></>)}
              </button>
              <Tooltip.Provider disableHoverableContent>
                <Tooltip.Root open={showInviteHint}>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setShowInvite(true)}
                      className="rounded bg-white/10 hover:bg-white/20 px-2 py-1"
                    >
                      <span className="sm:hidden">Bring a friend</span>
                      <span className="hidden sm:inline">Bring a friend</span>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      align="center"
                      sideOffset={8}
                      className="z-[9999] rounded-xl animate-pulse bg-white text-black text-xs font-semibold px-3 py-2 shadow-2xl ring-2 ring-black/10 data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[side=top]:slide-in-from-bottom-1"
                    >
                      Click here to invite
                      <span className="hidden sm:inline text-[10px] font-normal text-black/60 ml-1">(share link)</span>
                      <Tooltip.Arrow className="fill-white drop-shadow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
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
                const nextAvatar = state.next === 'X' ? (state.avatars?.X || null) : (state.avatars?.O || null);
                return (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80">
                    {nextAvatar ? (
                      <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
                        <Image src={nextAvatar} alt="avatar" width={16} height={16} />
                      </span>
                    ) : null}
                    {nextName}'s turn
                  </span>
                );
              })()}
            </div>

            {/* Players summary */}
            <div className="text-center text-white/70 text-sm flex items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1">
                X:
                {state.avatars?.X ? (
                  <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
                    <Image src={state.avatars.X} alt="X avatar" width={16} height={16} />
                  </span>
                ) : null}
                <span className="font-semibold">{state.names?.X || '—'}</span>
              </span>
              <span className="text-white/40">·</span>
              <span className="inline-flex items-center gap-1">
                O:
                {state.avatars?.O ? (
                  <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
                    <Image src={state.avatars.O} alt="O avatar" width={16} height={16} />
                  </span>
                ) : null}
                <span className="font-semibold">{state.names?.O || '—'}</span>
              </span>
            </div>

            <div className="flex justify-center">
              <Board 
                board={state.board} 
                onMove={makeMove} 
                highlight={state.winner && state.winner !== 'Draw' ? winningLine(state.board) : null}
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
                <span className="ml-2 inline-flex items-center gap-1 text-white/60">(
                  {role === 'X' && state.avatars?.X ? (
                    <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
                      <Image src={state.avatars.X} alt="Your avatar" width={16} height={16} />
                    </span>
                  ) : null}
                  {role === 'O' && state.avatars?.O ? (
                    <span className="inline-block h-4 w-4 overflow-hidden rounded-full bg-white/10">
                      <Image src={state.avatars.O} alt="Your avatar" width={16} height={16} />
                    </span>
                  ) : null}
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
                      onClick={async () => {
                        if (!url) return;
                        setShareBusy(true);
                        setShareDone(null);
                        try {
                          if (navigator.share && window.isSecureContext) {
                            await navigator.share({ title: 'Join my Tic Tac Toe room', text: 'Let’s play!', url });
                            setShareDone('shared');
                          } else if (navigator.clipboard && window.isSecureContext) {
                            await navigator.clipboard.writeText(url);
                            setShareDone('copied');
                          } else {
                            // Fallback: open mailto as a last resort
                            const mail = `mailto:?subject=${encodeURIComponent('Join my Tic Tac Toe room')}&body=${encodeURIComponent(url)}`;
                            window.location.href = mail;
                          }
                        } catch {
                          // ignore
                        } finally {
                          setShareBusy(false);
                          // Reset feedback after a moment
                          if (shareDone !== null) {
                            setTimeout(() => setShareDone(null), 1500);
                          }
                        }
                      }}
                      className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold flex items-center disabled:opacity-60"
                      disabled={shareBusy}
                    ><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>{shareBusy ? 'Sharing…' : shareDone === 'copied' ? 'Copied!' : shareDone === 'shared' ? 'Shared!' : 'Share'}</button>
                    <button
                      onClick={() => setShowInvite(false)}
                      className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
                    >Close</button>
                  </div>
                  <div className="sr-only" aria-live="polite">
                    {shareDone === 'copied' ? 'Link copied to clipboard' : shareDone === 'shared' ? 'Share dialog opened' : ''}
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
                    {/* Current room players overview */}
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
                        <span className="font-medium">{state.names?.X || "—"}</span>
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
                        <span className="font-medium">{state.names?.O || "—"}</span>
                      </span>
                    </div>

                    {session?.user ? (
                      <>
                        <p className="text-white/70 mb-3 inline-flex items-center gap-2">
                          <span>Signed in as</span>
                          {session.user.image ? (
                            <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                              <Image src={session.user.image} alt="Your avatar" width={20} height={20} />
                            </span>
                          ) : null}
                          <span className="font-semibold">{session.user.name || "Player"}</span>.
                          <span>Your name will be used.</span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white/70 mb-4">Join quickly with an account, or continue without one.</p>
                        <div className="mb-4 grid gap-2">
                          <button
                            onClick={() => signIn("discord", { callbackUrl: socialCallbackUrl })}
                            className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
                          >
                            <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
                            Continue with Discord
                          </button>
                          <button
                            onClick={() => signIn("google", { callbackUrl: socialCallbackUrl })}
                            className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                          >
                            <Image src="icons/google.svg" alt="Google" width={20} height={20} />
                            Continue with Google
                          </button>
                        </div>
                        <div className="my-3 flex items-center gap-3 text-xs text-white/50">
                          <div className="h-px flex-1 bg-white/10" />
                          <span>or join without account</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <p className="text-white/70 mb-3">Enter your name. You will play as X.</p>
                      </>
                    )}
                    <input
                      autoFocus
                      value={session?.user?.name ?? joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="Player 1"
                      className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4"
                      disabled={!!session?.user}
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
                    {/* Current room players overview */}
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
                        <span className="font-medium">{state.names?.X || "—"}</span>
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
                        <span className="font-medium">{state.names?.O || "—"}</span>
                      </span>
                    </div>

                    {session?.user ? (
                      <p className="text-white/70 mb-4 inline-flex items-center gap-2">
                        <span>Signed in as</span>
                        {session.user.image ? (
                          <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                            <Image src={session.user.image} alt="Your avatar" width={20} height={20} />
                          </span>
                        ) : null}
                        <span className="font-semibold">{session.user.name || "Player"}</span>.
                        <span>Going to play with <span className="font-semibold">{xn}</span></span>
                      </p>
                    ) : (
                      <>
                        <p className="text-white/70 mb-4">Join with an account or continue as guest. Going to play with <span className="font-semibold">{xn}</span></p>
                        <div className="mb-4 grid gap-2">
                          <button
                            onClick={() => signIn("discord", { callbackUrl: socialCallbackUrl })}
                            className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
                          >
                            <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
                            Continue with Discord
                          </button>
                          <button
                            onClick={() => signIn("google", { callbackUrl: socialCallbackUrl })}
                            className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                          >
                            <Image src="icons/google.svg" alt="Google" width={20} height={20} />
                            Continue with Google
                          </button>
                        </div>
                        <div className="my-3 flex items-center gap-3 text-xs text-white/50">
                          <div className="h-px flex-1 bg-white/10" />
                          <span>or join without account</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>
                        <label className="text-white/70 text-sm">Your player name</label>
                      </>
                    )}
                    <input
                      autoFocus
                      value={session?.user?.name ?? joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="Player 2"
                      className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4 mt-1"
                      disabled={!!session?.user}
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
