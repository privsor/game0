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
  opponentAvatar,
}: {
  open: boolean;
  onClose: () => void;
  room: string;
  claim: { amount: number; winnerRole: 'X'|'O'|null; expiresAt: number | null } | null;
  opponentName: string | null | undefined;
  opponentAvatar?: string | null | undefined;
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
    <div className="fixed inset-0 z-50 text-center flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-5 text-white shadow-xl">
        <div className="mb-3 text-lg font-bold">You won!</div>
        <p className="mb-3 text-white/80">
          {opponentName ? (
            <>
              {opponentAvatar ? (
                <Image src={opponentAvatar} alt="Opponent avatar" width={18} height={18} className="inline-block rounded-full mr-1 align-[-3px]" />
              ) : null}
              <span className="font-semibold">{opponentName}</span> was on half Daddy mode
            </>
          ) : (
            <>Opponent was on half Daddy mode.</>
          )}
        </p>
        <p className="mb-3 text-white/80">But will become Full Daddy Mode if you sign in</p>
        <p className="mb-3 text-white/80">which means...</p>
        {claim.amount > 0 ? (
          <p className="mb-4 text-emerald-300/90">
            You will get <span className="inline-flex items-center gap-1 font-semibold">+{claim.amount} <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={14} height={14} /></span> daddy coins after you sign in.
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

        {/* Top prizes (hook) */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/70 mb-1">Top prizes in Daddy's Prizes</div>
          <div className="text-xs text-white flex flex-col items-center gap-2 flex-wrap">
            <span className="font-medium text-white">Apple iPhone 17 Pro Max</span>
            <DealsRotator />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// Local rotator: minimal, one discount at a time, slide-in right + fade
function DealsRotator() {
  const deals = useMemo(() => ([
    { discount: "100% discount voucher", price: 1000 },
    { discount: "75% discount voucher", price: 750 },
    { discount: "50% discount voucher", price: 500 },
    { discount: "25% discount voucher", price: 250 },
  ]), []);
  const [i, setI] = useState(0);
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setI(v => (v + 1) % deals.length); setK(x => x + 1); }, 2200);
    return () => clearInterval(t);
  }, [deals.length]);
  const d = deals[i]!;
  return (
    <div className="relative">
      <span key={k} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] animate-slideIn">
        <span>{d.discount}</span>
        <span className="flex items-center gap-1 whitespace-nowrap"><span className="font-semibold">{d.price}</span> <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={12} height={12} /></span>
      </span>
      <style jsx>{`
        .animate-slideIn { animation: slideIn 420ms ease-out; }
        @keyframes slideIn { 0% { opacity: 0; transform: translateX(16px); } 100% { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}
