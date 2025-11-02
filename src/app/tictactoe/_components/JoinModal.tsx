"use client";

import React, { memo } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";

export type Role = "X" | "O";

export type JoinModalProps = {
  roomCode: string;
  players: { X: string | null; O: string | null } | undefined;
  names: { X: string | null; O: string | null } | undefined;
  avatars: { X: string | null; O: string | null } | undefined;
  sessionPresent: boolean;
  sessionUserName: string | null;
  sessionUserImage: string | null;
  socialCallbackUrl: string;
  canSelectDaddy: boolean;
  joinMode: 'daddy' | 'free';
  setJoinMode: (m: 'daddy' | 'free') => void;
  joinName: string;
  setJoinName: (v: string) => void;
  joining: boolean;
  onClose: () => void;
  onJoinX: () => void;
  onJoinO: () => void;
  onCreateOwnRoom: () => void;
};

function JoinModalImpl(props: JoinModalProps) {
  const { players, names, avatars, sessionPresent, sessionUserName, sessionUserImage, socialCallbackUrl, canSelectDaddy, joinMode, setJoinMode, joinName, setJoinName, joining, onClose, onJoinX, onJoinO, onCreateOwnRoom } = props;
  const hasX = !!(players?.X);
  const hasO = !!(players?.O);
  const xn = names?.X || 'Player 1';
  const on = names?.O || 'Player 2';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl">
        {(!hasX && !hasO) ? (
          <>
            <h2 className="text-xl font-bold mb-3">Create your player</h2>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="text-white/50">X</span>
                {avatars?.X ? (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                    <Image src={avatars.X!} alt="X avatar" width={20} height={20} />
                  </span>
                ) : (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
                )}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-white/50">O</span>
                {avatars?.O ? (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                    <Image src={avatars.O!} alt="O avatar" width={20} height={20} />
                  </span>
                ) : (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
                )}
                <span className="font-medium inline-flex items-center gap-1">
                  {names?.O || "—"}
                </span>
              </span>
            </div>

            {sessionPresent ? (
              <>
                <p className="text-white/70 mb-3 inline-flex items-center gap-2">
                  <span>Signed in as</span>
                  {sessionUserImage ? (
                    <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                      <Image src={sessionUserImage} alt="Your avatar" width={20} height={20} />
                    </span>
                  ) : null}
                  <span className="font-semibold">{sessionUserName || "Player"}</span>.
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
              value={sessionPresent ? (sessionUserName ?? joinName) : joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Player 1"
              className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4"
              disabled={!!sessionPresent}
            />
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setJoinMode('free')}
                className={`rounded-xl border px-3 py-3 text-left ${joinMode==='free' ? 'border-white bg-white text-black' : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/10'}`}
              >
                <div className="text-sm font-semibold">Free Mode</div>
                <div className="text-xs text-white/60">Play for fun. No coins.</div>
              </button>
              <button
                type="button"
                onClick={() => canSelectDaddy && setJoinMode('daddy')}
                disabled={!canSelectDaddy}
                className={`rounded-xl border px-3 py-3 text-left ${joinMode==='daddy' ? 'border-amber-300 bg-amber-200 text-black' : 'border-amber-300/30 bg-amber-200/10 text-amber-200'} ${!canSelectDaddy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-200/20'}`}
                title={!canSelectDaddy ? 'Sign in and have at least 1 DaddyCoin' : 'Daddy Mode (costs 1 coin when an authenticated opponent joins)'}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={14} height={14} /> Daddy Mode
                </div>
                <div className="text-[11px] mt-1 opacity-80">
                  Costs 1 DaddyCoin when a signed-in opponent joins. Winner rewards: +2 (vs free) / +3 (vs daddy).
                </div>
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button disabled={joining} onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2">Cancel</button>
              <button disabled={joining} onClick={onJoinX} className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold disabled:opacity-60">{joining ? 'Joining…' : 'Start as X'}</button>
            </div>
          </>
        ) : hasX && !hasO ? (
          <>
            <h2 className="text-xl font-bold mb-3">Join game</h2>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <span className="inline-flex items-center gap-2">
                <span className="text-white/50">X</span>
                {avatars?.X ? (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                    <Image src={avatars.X!} alt="X avatar" width={20} height={20} />
                  </span>
                ) : (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
                )}
                <span className="font-medium">{names?.X || "—"}
                  {/* Daddy mode chips for X */}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="text-white/50">O</span>
                {avatars?.O ? (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                    <Image src={avatars.O!} alt="O avatar" width={20} height={20} />
                  </span>
                ) : (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10" />
                )}
                <span className="font-medium">{names?.O || "—"}</span>
              </span>
            </div>

            {sessionPresent ? (
              <p className="text-white/70 mb-4 inline-flex items-center gap-2">
                <span>Signed in as</span>
                {sessionUserImage ? (
                  <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
                    <Image src={sessionUserImage} alt="Your avatar" width={20} height={20} />
                  </span>
                ) : null}
                <span className="font-semibold">{sessionUserName || "Player"}</span>.
                <span>Going to play with <span className="font-semibold">{xn}</span></span>
              </p>
            ) : null}

            <div className="mb-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setJoinMode('free')} className={`rounded-xl border px-3 py-3 text-left ${joinMode==='free' ? 'border-white bg-white text-black' : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/10'}`}>
                <div className="text-sm font-semibold">Free Mode</div>
                <div className="text-xs text-white/60">Play for fun. No coins.</div>
              </button>
              <button type="button" onClick={() => canSelectDaddy && setJoinMode('daddy')} disabled={!canSelectDaddy} className={`rounded-xl border px-3 py-3 text-left ${joinMode==='daddy' ? 'border-amber-300 bg-amber-200 text-black' : 'border-amber-300/30 bg-amber-200/10 text-amber-200'} ${!canSelectDaddy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-200/20'}`} title={!canSelectDaddy ? 'Sign in and have at least 1 DaddyCoin' : 'Daddy Mode (costs 1 coin when an authenticated opponent joins)'}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Image src="/icons/daddycoin.svg" alt="DaddyCoin" width={14} height={14} /> Daddy Mode</div>
                <div className="text-[11px] mt-1 opacity-80">Costs 1 DaddyCoin when a signed-in opponent joins. Winner rewards: +2 (vs free) / +3 (vs daddy).</div>
              </button>
            </div>

            {!sessionPresent ? (
              <> 
                <p className="text-white/70 mb-4">Join with an account or continue as guest. Going to play with <span className="font-semibold">{xn}</span></p>
                <div className="mb-4 grid gap-2">
                  <button onClick={() => signIn("discord", { callbackUrl: socialCallbackUrl })} className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90">
                    <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
                    Join with Discord
                  </button>
                  <button onClick={() => signIn("google", { callbackUrl: socialCallbackUrl })} className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90">
                    <Image src="icons/google.svg" alt="Google" width={20} height={20} />
                    Join with Google
                  </button>
                </div>
                <div className="my-3 flex items-center gap-3 text-xs text-white/50">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or join without account</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <label className="text-white/70 text-sm">Your player name</label>
              </>
            ) : (
              <>
                <p className="text-white/70 mb-3">Enter your name. You will play as O.</p>
              </>
            )}
            <input autoFocus value={sessionPresent ? (sessionUserName ?? joinName) : joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="Player 2" className="w-full rounded-lg bg-white/10 px-4 py-2 outline-none mb-4 mt-1" disabled={!!sessionPresent} />
            <div className="flex gap-3 justify-between">
              <button disabled={joining} onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2">Watch instead</button>
              <button disabled={joining} onClick={onJoinO} className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold disabled:opacity-60">{joining ? 'Joining…' : 'Join as O'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-3">Room is full</h2>
            <p className="text-white/70 mb-4"><span className="font-semibold">{xn}</span> is playing with <span className="font-semibold">{on}</span></p>
            <div className="flex gap-3 justify-between">
              <button onClick={onClose} className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold">Watch them play</button>
              <button onClick={onCreateOwnRoom} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2">Create your own room</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const JoinModal = memo(JoinModalImpl);
