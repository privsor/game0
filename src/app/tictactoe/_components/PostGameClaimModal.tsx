"use client";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

export function PostGameClaimModal({
  open,
  onClose,
  room,
  claim,
  opponentName,
}: {
  open: boolean;
  onClose: () => void;
  room: string;
  claim: { amount: number; winnerRole: 'X'|'O'|null; expiresAt: number | null } | null;
  opponentName: string | null | undefined;
}) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const expired = useMemo(() => {
    if (!claim?.expiresAt) return false;
    return Date.now() > claim.expiresAt;
  }, [claim?.expiresAt]);

  useEffect(() => {
    if (!open) return;
    if (!session?.user) return;
    // Auto-claim once signed in
    (async () => {
      try {
        setBusy(true);
        const res = await fetch('/api/tictactoe/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room })
        });
        // ignoring response body; UI will refresh state from polling/ably
      } finally {
        setBusy(false);
      }
    })();
  }, [open, session?.user, room]);

  if (!open || !claim) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-5 text-white shadow-xl">
        <div className="mb-3 text-lg font-bold">Game finished</div>
        <p className="mb-3 text-white/80">
          {opponentName ? (
            <>
              <span className="font-semibold">{opponentName}</span> was on half Daddy mode.
            </>
          ) : (
            <>Opponent was on half Daddy mode.</>
          )}
        </p>
        {claim.amount > 0 ? (
          <p className="mb-4 text-emerald-300/90">
            You will get <span className="font-semibold">+{claim.amount} DaddyCoin{claim.amount>1?'s':''}</span> after you sign in.
          </p>
        ) : (
          <p className="mb-4 text-white/70">Sign in to continue.</p>
        )}

        {!session?.user ? (
          <div className="grid gap-2 mb-4">
            <button
              onClick={() => {
                try { localStorage.setItem('ttt-intent', JSON.stringify({ room, intent: 'claim_and_rejoin', role: claim?.winnerRole || null })); } catch {}
                signIn('discord', { callbackUrl: `/tictactoe?room=${room}` });
              }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
            >
              <Image src="/icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
              Sign in with Discord
            </button>
            <button
              onClick={() => {
                try { localStorage.setItem('ttt-intent', JSON.stringify({ room, intent: 'claim_and_rejoin', role: claim?.winnerRole || null })); } catch {}
                signIn('google', { callbackUrl: `/tictactoe?room=${room}` });
              }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            >
              <Image src="/icons/google.svg" alt="Google" width={20} height={20} />
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="mb-3 text-sm text-white/70">Settling your reward…</div>
        )}

        {expired ? (
          <div className="mb-3 text-xs text-red-300">This claim may have expired.</div>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
