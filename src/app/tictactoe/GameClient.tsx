  "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { getChannel } from "~/lib/ably";
import { Board } from "./_components/Board";
import type { Cell } from "./_components/Board";
import { JoinPanel } from "./_components/JoinPanel";
import { JoinModal } from "./_components/JoinModal";
import { StatusBadges } from "./_components/StatusBadges";
import { PlayersSummary } from "./_components/PlayersSummary";
import { WinnerBanner } from "./_components/WinnerBanner";
import { InviteModal } from "./_components/InviteModal";
import { ScanQRModal } from "./_components/ScanQRModal";
import { RoomHeaderBar } from "./_components/RoomHeaderBar";
import { calculateWinner, winningLine, initialState } from "./_utils/game";
import type { Role, GameState } from "./_types";
import dynamic from "next/dynamic";
import { useAblyPresence } from "./_hooks/useAblyPresence";

import { signIn, useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import Image from "next/image";

// Types moved to ./_types

// Dynamically import heavy/rarely used modal to keep initial bundle smaller
const PostGameClaimModal = dynamic(() => import("./_components/PostGameClaimModal").then(m => m.PostGameClaimModal), { ssr: false, loading: () => null });

type WireEvent =
  | { type: "state"; state: GameState & { turn?: number; players?: { X: string | null; O: string | null }, names?: { X: string | null; O: string | null }, avatars?: { X: string | null; O: string | null } } };

// calculateWinner and winningLine moved to ./_utils/game

// initialState moved to ./_utils/game

export default function GameClient() {
  const { data: session } = useSession();
  // Wallet balance to gate Daddy Mode selection (requires auth and >=1 coin)
  const { data: balData } = api.wallet.getBalance.useQuery(undefined, { enabled: !!session?.user });
  const myBalance = balData?.balance ?? 0;
  const canSelectDaddy = !!session?.user && myBalance >= 1;
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
  const [joinMode, setJoinMode] = useState<'daddy'|'free'|null>(null);
  const socialCallbackUrl = `/tictactoe?room=${roomCode}`;
  const joinPromptedRef = useRef(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showScanQR, setShowScanQR] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareDone, setShareDone] = useState<null | 'copied' | 'shared'>(null);
  // Tooltip for invite button when only Player 1 is present
  const [showInviteHint, setShowInviteHint] = useState(false);
  const [showClaim, setShowClaim] = useState(false); // retained for onClose, but open is derived
  // Track peers count locally to avoid presence.get on every presence event
  const peersCountRef = useRef(0);
  // Refs for values used inside effects without causing re-subscribe churn
  const roomCodeRef = useRef(roomCode);
  const userIdRef = useRef("");
  // Memoize board highlight to avoid recomputation and prop identity churn
  const highlight = useMemo(() => (
    state.winner && state.winner !== 'Draw' ? winningLine(state.board) : null
  ), [state.winner, state.board]);

  // Presence via hook: compute channel from room
  const channelName = useMemo(() => roomCode ? `room-${roomCode}` : null, [roomCode]);
  const { connected: hookConnected, peers: hookPeers } = useAblyPresence(channelName);
  useEffect(() => { setConnected(hookConnected); }, [hookConnected]);
  useEffect(() => { setPeers(hookPeers); }, [hookPeers]);

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
    const controller = new AbortController();

    (async () => {
      // Fetch current state and role from server
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          // eslint-disable-next-line no-console
          console.log('[TTT] tick state claim', data?.state?.claim, 'winner', data?.state?.winner);
          if (data.ok) {
            setState({
              board: data.state.board,
              next: data.state.next,
              winner: data.state.winner ?? null,
              players: data.state.players ?? { X: null, O: null },
              names: data.state.names ?? { X: null, O: null },
              avatars: data.state.avatars ?? { X: null, O: null },
              coinsMode: data.state.coinsMode ?? { X: false, O: false },
              coinsModePending: data.state.coinsModePending ?? { X: false, O: false },
              claim: data.state.claim ?? null,
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
      // eslint-disable-next-line no-console
      console.log('[TTT] subscribing to channel', channelName);
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
        // eslint-disable-next-line no-console
        console.log('[TTT] ably message', { name: msg?.name, data: msg?.data });
        const data = msg.data as WireEvent;
        if (!data) return;
        if (data.type === "state") {
          // eslint-disable-next-line no-console
          console.log('[TTT] ably state claim', data.state?.claim, 'winner', data.state?.winner);
          const incoming = {
            board: data.state.board,
            next: data.state.next,
            winner: data.state.winner ?? null,
            players: data.state.players ?? { X: null, O: null },
            names: data.state.names ?? { X: null, O: null },
            avatars: data.state.avatars ?? { X: null, O: null },
            coinsMode: data.state.coinsMode ?? { X: false, O: false },
            coinsModePending: data.state.coinsModePending ?? { X: false, O: false },
            claim: data.state.claim ?? null,
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

      ch.subscribe('state', onMessage);
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
      controller.abort();
      unsub?.();
    };
  }, [channelName, roomCode, userId]);

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
          // eslint-disable-next-line no-console
          console.log('[TTT] tick state claim', data?.state?.claim, 'winner', data?.state?.winner);
          if (data?.ok) {
            setState((prev) => {
              const incoming = {
                board: data.state.board,
                next: data.state.next,
                winner: data.state.winner ?? null,
                players: data.state.players ?? prev.players ?? { X: null, O: null },
                names: data.state.names ?? prev.names ?? { X: null, O: null },
                avatars: data.state.avatars ?? prev.avatars ?? { X: null, O: null },
                coinsMode: data.state.coinsMode ?? prev.coinsMode ?? { X: false, O: false },
                coinsModePending: data.state.coinsModePending ?? prev.coinsModePending ?? { X: false, O: false },
              } as GameState;
              const sameBoard = prev.board.length === incoming.board.length && prev.board.every((v, i) => v === incoming.board[i]);
              const sameNext = prev.next === incoming.next;
              const sameWinner = prev.winner === incoming.winner;
              const samePlayers = (prev.players?.X ?? null) === (incoming.players?.X ?? null) && (prev.players?.O ?? null) === (incoming.players?.O ?? null);
              const sameNames = (prev.names?.X ?? null) === (incoming.names?.X ?? null) && (prev.names?.O ?? null) === (incoming.names?.O ?? null);
              const sameAvatars = (prev.avatars?.X ?? null) === (incoming.avatars?.X ?? null) && (prev.avatars?.O ?? null) === (incoming.avatars?.O ?? null);
              const sameCoins = (prev.coinsMode?.X ?? false) === (incoming.coinsMode?.X ?? false)
                && (prev.coinsMode?.O ?? false) === (incoming.coinsMode?.O ?? false)
                && (prev.coinsModePending?.X ?? false) === (incoming.coinsModePending?.X ?? false)
                && (prev.coinsModePending?.O ?? false) === (incoming.coinsModePending?.O ?? false);
              if (sameBoard && sameNext && sameWinner && samePlayers && sameNames && sameAvatars && sameCoins) return prev;
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

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[TTT] mode flags', {
      coinsMode: state.coinsMode,
      coinsModePending: state.coinsModePending,
      players: state.players,
      names: state.names,
      avatars: state.avatars,
    });
  }, [state.coinsMode?.X, state.coinsMode?.O, state.coinsModePending?.X, state.coinsModePending?.O]);

  // Log avatar changes explicitly
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[TTT] avatars', state.avatars, state.coinsModePending);
  }, [state.avatars?.X, state.avatars?.O]);

  // Log claim changes explicitly

  // Fallback: if game ended but claim is missing, refetch state once to hydrate claim
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!state.winner || state.claim || !roomCode) return;
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (aborted) return;
        if (data?.ok && data.state?.claim) {
          setState((prev) => ({ ...prev, claim: data.state.claim } as any));
        }
      } catch {}
    })();
    return () => { aborted = true; };
  }, [state.winner, state.claim, roomCode, userId]);

  // Derive modal open directly from state to avoid races
  const claimOpen = useMemo(() => {
    if (!state.winner) return false;
    const c = state.claim;
    if (!c || !c.amount) return false;
    if (!session?.user) return true;
    return role === c.winnerRole;
  }, [state.winner, state.claim?.amount, state.claim?.winnerRole, session?.user, role]);

  // Post-auth intent processor: claim -> authping -> rejoin seat
  useEffect(() => {
    (async () => {
      if (!session?.user) return;
      let raw: string | null = null;
      try { raw = localStorage.getItem('ttt-intent'); } catch {}
      if (!raw) return;
      let intent: any = null;
      try { intent = JSON.parse(raw); } catch { intent = null; }
      if (!intent || intent.intent !== 'claim_and_rejoin') return;
      if (!roomCode || intent.room !== roomCode) return;
      // 1) Settle claim, ignore errors
      try {
        await fetch('/api/tictactoe/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: roomCode }) });
      } catch {}
      // 2) Auth ping to promote half->full and charge idempotently
      try {
        await fetch('/api/tictactoe/authping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: roomCode }) });
      } catch {}
      // 3) Attempt rejoin to preferredRole
      const preferredRole = (intent.role === 'X' || intent.role === 'O') ? intent.role : 'auto';
      try {
        const res = await fetch('/api/tictactoe/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room: roomCode, userId, name: joinName || session?.user?.name || 'Player', preferredRole }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok) {
            setState((prev) => ({
              board: data.state.board,
              next: data.state.next,
              winner: data.state.winner ?? null,
              players: data.state.players ?? prev.players ?? { X: null, O: null },
              names: data.state.names ?? prev.names ?? { X: null, O: null },
              avatars: data.state.avatars ?? prev.avatars ?? { X: null, O: null },
              coinsMode: data.state.coinsMode ?? prev.coinsMode ?? { X: false, O: false },
              coinsModePending: data.state.coinsModePending ?? prev.coinsModePending ?? { X: false, O: false },
              claim: data.state.claim ?? prev.claim ?? null,
            } as GameState));
            setRole(data.userRole);
          }
        }
      } catch {}
      // 4) Clear intent
      try { localStorage.removeItem('ttt-intent'); } catch {}
    })();
  }, [session?.user, roomCode, userId, joinName]);

  // Log join mode selection changes
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[TTT] joinMode selected', joinMode);
  }, [joinMode]);

  // Ensure join modal shows freshest state immediately
  useEffect(() => {
    if (!showJoin) return;
    (async () => {
      try {
        const res = await fetch(`/api/tictactoe/state?room=${roomCode}&userId=${userId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok) {
            setState((prev) => ({
              board: data.state.board,
              next: data.state.next,
              winner: data.state.winner ?? null,
              players: data.state.players ?? prev.players ?? { X: null, O: null },
              names: data.state.names ?? prev.names ?? { X: null, O: null },
              avatars: data.state.avatars ?? prev.avatars ?? { X: null, O: null },
              coinsMode: data.state.coinsMode ?? prev.coinsMode ?? { X: false, O: false },
              coinsModePending: data.state.coinsModePending ?? prev.coinsModePending ?? { X: false, O: false },
            } as GameState));
          }
        }
      } catch {}
    })();
  }, [showJoin, roomCode, userId]);

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
    if (!joinMode) { // ensure a mode is chosen
      setShowJoin(true);
      return;
    }
    setJoining(true);
    // Persist name immediately for better UX
    try { localStorage.setItem('ttt-name', joinName); } catch {}
    // Close modal immediately to reduce perceived latency
    setShowJoin(false);
    try {
      const payload = { room: roomCode, userId, name: joinName, preferredRole, mode: joinMode };
      // eslint-disable-next-line no-console
      console.log('[TTT] join: sending', payload);
      const res = await fetch('/api/tictactoe/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        // eslint-disable-next-line no-console
        console.log('[TTT] join: response', data);
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
  }, [joinName, joinMode, joining, roomCode, userId]);

  return (
    <main className="flex min-h-screen md:fixed md:inset-0 md:h-screen md:overflow-hidden flex-col bg-black text-white px-4 py-6 md:p-0">
      <PostGameClaimModal
        open={claimOpen}
        onClose={() => setShowClaim(false)}
        room={roomCode}
        claim={state.claim ?? null}
        opponentName={role === 'X' ? state.names?.O : role === 'O' ? state.names?.X : (state.names?.X || state.names?.O || null)}
        opponentAvatar={role === 'X' ? state.avatars?.O : role === 'O' ? state.avatars?.X : (state.avatars?.X || state.avatars?.O || null)}
      />
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full max-w-xl">
        <h1 className="text-center text-2xl md:text-3xl font-extrabold tracking-tight mb-3 md:mb-2">Tic Tac Toe</h1>

        {!roomCode ? (
          <JoinPanel
            inputCode={inputCode}
            setInputCode={setInputCode}
            onCreate={startNewRoom}
            onJoin={joinRoom}
            onScanQR={() => setShowScanQR(true)}
          />
        ) : (
          <div className="grid gap-2 md:gap-5">
            
            <RoomHeaderBar
              roomCode={roomCode}
              connected={connected}
              peers={peers}
              copied={copied}
              onCopyLink={() => {
                const url = typeof window !== "undefined" ? window.location.href : "";
                navigator.clipboard?.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => {});
              }}
              onInvite={() => setShowInvite(true)}
              showInviteHint={showInviteHint}
            />

            {/* Status badges */}
            <StatusBadges
              players={state.players}
              role={role}
              winner={state.winner}
              next={state.next}
              names={state.names}
              avatars={state.avatars}
            />

            {/* Players summary */}
            <PlayersSummary
              names={state.names}
              avatars={state.avatars}
              coinsMode={state.coinsMode}
              coinsModePending={state.coinsModePending}
            />

            <div className="flex justify-center">
              <Board 
                board={state.board} 
                onMove={makeMove} 
                highlight={highlight}
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
                  <span className="inline-flex items-center gap-1">
                    {role === 'X' ? (state.names?.X || '') : (state.names?.O || '')}
                    {(role === 'X' ? state.coinsMode?.X : state.coinsMode?.O) ? (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/10 px-2 py-0.5 text-[10px] text-amber-200">
                        <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
                        Daddy mode
                      </span>
                    ) : (role === 'X' ? state.coinsModePending?.X : state.coinsModePending?.O) ? (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-200/5 px-2 py-0.5 text-[10px] text-amber-200/80">
                        <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} />
                        1/2 Daddy mode
                      </span>
                    ) : null}
                  </span>
                )</span>
              ) : null}
              <span className="mx-2 text-white/40">·</span>
              Next <span className="font-bold">{state.next}</span>{' '}
              <span className="text-white/60">(
                {state.next === 'X' ? (state.names?.X || 'Player 1') : (state.names?.O || 'Player 2')}
              )</span>
            </div>

            {/* DaddyCoins Mode toggle removed by product decision */}

            <div className="min-h-[2.25rem] text-center">
              <WinnerBanner winner={state.winner} />
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
        <InviteModal
          roomCode={roomCode}
          hostName={state.names?.X || 'Player 1'}
          onClose={() => setShowInvite(false)}
          shareBusy={shareBusy}
          shareDone={shareDone}
          setShareBusy={setShareBusy}
          setShareDone={setShareDone}
        />
      )}
        </div>
      </div>
      
      {/* Scan QR modal */}
      {!roomCode && showScanQR && (
        <ScanQRModal
          onClose={() => setShowScanQR(false)}
          onScanSuccess={(code) => {
            setShowScanQR(false);
            // Get default name from localStorage or use "Player 2"
            let defaultName = "Player 2";
            try {
              const stored = localStorage.getItem("ttt-name");
              if (stored?.trim()) defaultName = stored.trim();
            } catch {}
            setJoinName(defaultName);
            // Set default mode to free for QR joins
            setJoinMode('free');
            // Set room and navigate
            setRoomCode(code);
            router.replace(`/tictactoe?room=${code}`);
          }}
        />
      )}

      {/* Join modal */}
      {roomCode && showJoin && (
        <JoinModal
          roomCode={roomCode}
          players={state.players}
          names={state.names}
          avatars={state.avatars}
          sessionPresent={!!session?.user}
          sessionUserName={session?.user?.name ?? null}
          sessionUserImage={session?.user?.image ?? null}
          socialCallbackUrl={socialCallbackUrl}
          canSelectDaddy={canSelectDaddy}
          joinMode={joinMode}
          setJoinMode={setJoinMode}
          daddyCoins={myBalance}
          onBuyDaddyCoins={() => router.push('/profile')}
          joinName={joinName}
          setJoinName={setJoinName}
          joining={joining}
          onClose={() => setShowJoin(false)}
          onJoinX={() => joinAs('X')}
          onJoinO={() => joinAs('O')}
          onCreateOwnRoom={() => { setRoomCode(""); setState(initialState()); setRole(null); router.replace('/tictactoe'); }}
        />
      )}
    </main>
  );
}
