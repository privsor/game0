"use client";

import React, { memo } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { ModeSelector } from "./_joinmodal/ModeSelector";
import BuyDaddyCoinsModal from "./BuyDaddyCoinsModal";

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
  joinMode: 'daddy' | 'free' | null;
  setJoinMode: (m: 'daddy' | 'free' | null) => void;
  daddyCoins?: number;
  onBuyDaddyCoins?: () => void;
  joinName: string;
  setJoinName: (v: string) => void;
  joining: boolean;
  onClose: () => void;
  onJoinX: () => void;
  onJoinO: () => void;
  onCreateOwnRoom: () => void;
};

// Small, focused internal components to reduce duplication and improve readability
const Divider: React.FC<{ label: string }> = ({ label }) => (
  <div className="my-3 flex items-center gap-3 text-xs text-white/50">
    <div className="h-px flex-1 bg-white/10" />
    <span>{label}</span>
    <div className="h-px flex-1 bg-white/10" />
  </div>
);

const AuthButtons: React.FC<{
  socialCallbackUrl: string;
  primaryDiscord?: string;
  primaryGoogle?: string;
  variant?: 'continue' | 'join';
  guestMode?: boolean;
  onToggleGuest?: () => void;
}>
  = ({ socialCallbackUrl, primaryDiscord, primaryGoogle, variant = 'join', guestMode = false, onToggleGuest }) => (
  <div className="mb-4 grid gap-2">
    {!guestMode ? (
      <>
        <button
          onClick={() => signIn("discord", { callbackUrl: socialCallbackUrl })}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
        >
          <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
          {primaryDiscord || (variant === 'join' ? 'Join with Discord' : 'Continue with Discord')}
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl: socialCallbackUrl })}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
        >
          <Image src="icons/google.svg" alt="Google" width={20} height={20} />
          {primaryGoogle || (variant === 'join' ? 'Join with Google' : 'Continue with Google')}
        </button>
        {onToggleGuest ? (
          <button
            type="button"
            onClick={onToggleGuest}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-medium text-white hover:bg-white/10"
          >
            Join as guest
          </button>
        ) : null}
      </>
    ) : (
      onToggleGuest ? (
        <button
          type="button"
          onClick={onToggleGuest}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-medium text-white hover:bg-white/10"
        >
          Use social accounts instead
        </button>
      ) : null
    )}
  </div>
);

 

const PlayersHeader: React.FC<{ avatars?: { X: string | null; O: string | null } | undefined; names?: { X: string | null; O: string | null } | undefined; showOName?: boolean }>
  = ({ avatars, names, showOName = true }) => (
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
      <span className="font-medium">{names?.X || '—'}</span>
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
      {showOName ? (
        <span className="font-medium inline-flex items-center gap-1">{names?.O || '—'}</span>
      ) : null}
    </span>
  </div>
);

const SignedInBanner: React.FC<{ sessionUserImage: string | null; sessionUserName: string | null; suffix?: React.ReactNode }>
  = ({ sessionUserImage, sessionUserName, suffix }) => (
  <p className="text-white/70 mb-3 inline-flex items-center gap-2">
    <span>Signed in as</span>
    {sessionUserImage ? (
      <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
        <Image src={sessionUserImage} alt="Your avatar" width={20} height={20} />
      </span>
    ) : null}
    <span className="font-semibold">{sessionUserName || 'Player'}</span>
    {/* {suffix ? <span>{suffix}</span> : null} */}
  </p>
);

const NameInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; autoFocus?: boolean; className?: string }>
  = ({ value, onChange, placeholder, disabled, autoFocus, className }) => (
  <input
    autoFocus={autoFocus}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full rounded-lg bg-white/10 px-4 py-2 outline-none ${className || ''}`}
    disabled={disabled}
  />
);

// Minimal toast inside modal
const Toast: React.FC<{ message: string; onClose: () => void }>= ({ message, onClose }) => {
  React.useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-white text-black px-3 py-2 text-sm shadow">
      {message}
    </div>
  );
};

function JoinModalImpl(props: JoinModalProps) {
  const { players, names, avatars, sessionPresent, sessionUserName, sessionUserImage, socialCallbackUrl, canSelectDaddy, joinMode, setJoinMode, daddyCoins = 0, onBuyDaddyCoins, joinName, setJoinName, joining, onClose, onJoinX, onJoinO, onCreateOwnRoom } = props;
  const hasX = !!(players?.X);
  const hasO = !!(players?.O);
  const xn = names?.X || 'Player 1';
  const on = names?.O || 'Player 2';
  const [guestMode, setGuestMode] = React.useState(false);
  const modeSelected = joinMode !== null;
  const daddyBlocked = joinMode === 'daddy' && (!sessionPresent || daddyCoins <= 0);
  const disableJoin = joining || !modeSelected || daddyBlocked;
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const [buyOpen, setBuyOpen] = React.useState(false);

  const handleAttemptJoin = (roleHandler: () => void) => {
    if (joining) return;
    if (!modeSelected) {
      setToastMsg('Select a mode first.');
      return;
    }
    if (daddyBlocked) {
      setToastMsg('You need DaddyCoins to play Daddy Mode. Buy some first.');
      return;
    }
    roleHandler();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center text-center z-50">
      <div className="relative w-full max-w-md rounded-xl backdrop-blur-sm border border-white/20 p-5 shadow-xl">
        {(!hasX && !hasO) ? (
          <>
            <h2 className="text-xl font-bold mb-3">Create your player</h2>
            <PlayersHeader avatars={avatars} names={names} />

            {sessionPresent ? (
              <>
                <SignedInBanner sessionUserImage={sessionUserImage} sessionUserName={sessionUserName} />
              </>
            ) : (
              <>
                {/* <p className="text-white/70 mb-4">Join quickly with an account, or continue without one.</p> */}
                <AuthButtons socialCallbackUrl={socialCallbackUrl} variant="join" guestMode={guestMode} onToggleGuest={() => setGuestMode(v => !v)} />
                {guestMode ? (
                  <>
                    <Divider label="or join without account" />
                    <p className="text-white/70 mb-3">Enter your name. You will play as X.</p>
                  </>
                ) : null}
              </>
            )}
            {(sessionPresent || guestMode) ? (
              <NameInput
                autoFocus
                value={sessionPresent ? (sessionUserName ?? joinName) : joinName}
                onChange={setJoinName}
                placeholder="Player 1"
                className="mb-4"
                disabled={!!sessionPresent}
              />
            ) : null}
            <ModeSelector
              joinMode={joinMode}
              setJoinMode={setJoinMode}
              canSelectDaddy={canSelectDaddy}
              isAuthed={sessionPresent}
              daddyCoins={daddyCoins}
              onBuyDaddyCoins={() => setBuyOpen(true)}
              onAuthCta={() => signIn()}
            />
            <div className="flex gap-3 justify-end">
              {/* <button
                aria-disabled={disableJoin}
                onClick={() => handleAttemptJoin(onJoinO)}
                className={`rounded border border-white/20 bg-white/5 text-white px-4 py-2 font-semibold ${disableJoin ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/10'}`}
              >
                {joining ? 'Joining…' : 'Start as O'}
              </button> */}
              <button
                aria-disabled={disableJoin}
                onClick={() => handleAttemptJoin(onJoinX)}
                className={`rounded bg-white text-black px-4 py-2 font-semibold ${disableJoin ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/90'}`}
              >
                {joining ? 'Joining…' : 'Start as X'}
              </button>
            </div>
          </>
        ) : hasX && !hasO ? (
          <>
            <h2 className="text-xl font-bold mb-3">Join game</h2>
            <PlayersHeader avatars={avatars} names={names} />

            {sessionPresent ? (
              <SignedInBanner
                sessionUserImage={sessionUserImage}
                sessionUserName={sessionUserName}
                suffix={<span>Going to play with <span className="font-semibold">{xn}</span></span>}
              />
            ) : null}


            {!sessionPresent ? (
              <> 
                {/* <p className="text-white/70 mb-4">Join with an account or continue as guest. Going to play with <span className="font-semibold">{xn}</span></p> */}
                <AuthButtons socialCallbackUrl={socialCallbackUrl} variant="join" guestMode={guestMode} onToggleGuest={() => setGuestMode(v => !v)} />
                {guestMode ? (
                  <>
                    <Divider label="or join without account" />
                    <label className="text-white/70 text-sm">Your player name</label>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {/* <p className="text-white/70 mb-3">Enter your name. You will play as O.</p> */}
              </>
            )}
            {(sessionPresent || guestMode) ? (
              <NameInput
                autoFocus
                value={sessionPresent ? (sessionUserName ?? joinName) : joinName}
                onChange={setJoinName}
                placeholder="Player 2"
                className="mb-4 mt-1"
                disabled={!!sessionPresent}
              />
            ) : null}
            
            <ModeSelector
              joinMode={joinMode}
              setJoinMode={setJoinMode}
              canSelectDaddy={canSelectDaddy}
              isAuthed={sessionPresent}
              daddyCoins={daddyCoins}
              onBuyDaddyCoins={() => setBuyOpen(true)}
              onAuthCta={() => signIn()}
            />

            <div className="flex gap-3 justify-between">
              <button disabled={joining} onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2">Watch instead</button>
              <button
                aria-disabled={disableJoin}
                onClick={() => handleAttemptJoin(onJoinO)}
                className={`rounded bg-white text-black px-4 py-2 font-semibold ${disableJoin ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/90'}`}
              >
                {joining ? 'Joining…' : 'Join as O'}
              </button>
            </div>
            
          </>
        ) : !hasX && hasO ? (
          <>
            <h2 className="text-xl font-bold mb-3">Join game</h2>
            <PlayersHeader avatars={avatars} names={names} />

            {sessionPresent ? (
              <SignedInBanner
                sessionUserImage={sessionUserImage}
                sessionUserName={sessionUserName}
                suffix={<span>Going to play with <span className="font-semibold">{on}</span></span>}
              />
            ) : null}

            {!sessionPresent ? (
              <> 
                <AuthButtons socialCallbackUrl={socialCallbackUrl} variant="join" guestMode={guestMode} onToggleGuest={() => setGuestMode(v => !v)} />
                {guestMode ? (
                  <>
                    <Divider label="or join without account" />
                    <label className="text-white/70 text-sm">Your player name</label>
                  </>
                ) : null}
              </>
            ) : null}
            {(sessionPresent || guestMode) ? (
              <NameInput
                autoFocus
                value={sessionPresent ? (sessionUserName ?? joinName) : joinName}
                onChange={setJoinName}
                placeholder="Player 2"
                className="mb-4 mt-1"
                disabled={!!sessionPresent}
              />
            ) : null}
            
            <ModeSelector
              joinMode={joinMode}
              setJoinMode={setJoinMode}
              canSelectDaddy={canSelectDaddy}
              isAuthed={sessionPresent}
              daddyCoins={daddyCoins}
              onBuyDaddyCoins={() => setBuyOpen(true)}
              onAuthCta={() => signIn()}
            />

            <div className="flex gap-3 justify-between">
              <button disabled={joining} onClick={onClose} className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2">Watch instead</button>
              <button
                aria-disabled={disableJoin}
                onClick={() => handleAttemptJoin(onJoinX)}
                className={`rounded bg-white text-black px-4 py-2 font-semibold ${disableJoin ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/90'}`}
              >
                {joining ? 'Joining…' : 'Join as X'}
              </button>
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
      {toastMsg ? <Toast message={toastMsg} onClose={() => setToastMsg(null)} /> : null}
      <BuyDaddyCoinsModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

export const JoinModal = memo(JoinModalImpl);
