"use client";

import React from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";

export type AuthenticationStepProps = {
  socialCallbackUrl: string;
  selectedMode: "daddy" | "free";
  sessionPresent: boolean;
  sessionUserName: string | null;
  sessionUserImage: string | null;
  joinName: string;
  setJoinName: (v: string) => void;
  guestMode: boolean;
  setGuestMode: (v: boolean) => void;
  onBack?: () => void;
  onContinue?: () => void;
};

const Divider: React.FC<{ label: string }> = ({ label }) => (
  <div className="my-3 flex items-center gap-3 text-xs text-white/50">
    <div className="h-px flex-1 bg-white/10" />
    <span>{label}</span>
    <div className="h-px flex-1 bg-white/10" />
  </div>
);

const NameInput: React.FC<{ 
  value: string; 
  onChange: (v: string) => void; 
  placeholder: string; 
  disabled?: boolean; 
  autoFocus?: boolean; 
  className?: string 
}> = ({ value, onChange, placeholder, disabled, autoFocus, className }) => (
  <input
    autoFocus={autoFocus}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full rounded-lg bg-white/10 px-4 py-2 outline-none ${className || ''}`}
    disabled={disabled}
  />
);

const SignedInBanner: React.FC<{ 
  sessionUserImage: string | null; 
  sessionUserName: string | null; 
}> = ({ sessionUserImage, sessionUserName }) => (
  <p className="text-white/70 mb-3 inline-flex items-center gap-2">
    <span>Signed in as</span>
    {sessionUserImage ? (
      <span className="inline-block h-5 w-5 overflow-hidden rounded-full bg-white/10">
        <Image src={sessionUserImage} alt="Your avatar" width={20} height={20} />
      </span>
    ) : null}
    <span className="font-semibold">{sessionUserName || 'Player'}</span>
  </p>
);

export function AuthenticationStep({
  socialCallbackUrl,
  selectedMode,
  sessionPresent,
  sessionUserName,
  sessionUserImage,
  joinName,
  setJoinName,
  guestMode,
  setGuestMode,
  onBack,
  onContinue
}: AuthenticationStepProps) {
  const getModeContext = () => {
    if (selectedMode === 'daddy') {
      return "Sign in to activate Daddy Mode and use your DaddyCoins";
    }
    return "Sign in to save your progress and play with friends";
  };

  return (
    <div className="">
      <div className="mb-3">
        <h2 className="text-xl font-bold tracking-wide text-slate-100">
          {selectedMode === 'daddy' ? 'Activate Daddy Mode' : 'Join to play'}
        </h2>
      </div>
      
      {sessionPresent ? (
        <SignedInBanner 
          sessionUserImage={sessionUserImage} 
          sessionUserName={sessionUserName} 
        />
      ) : (
        <>
          <p className="text-white/70 mb-4">{getModeContext()}</p>
          <div className="mb-4 grid gap-2">
            {!guestMode ? (
              <>
                <button
                  onClick={() => signIn("discord", { callbackUrl: socialCallbackUrl })}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
                >
                  <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
                  Join with Discord
                </button>
                <button
                  onClick={() => signIn("google", { callbackUrl: socialCallbackUrl })}
                  className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                >
                  <Image src="icons/google.svg" alt="Google" width={20} height={20} />
                  Join with Google
                </button>
                <button
                  type="button"
                  onClick={() => setGuestMode(!guestMode)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-medium text-white hover:bg-white/10"
                >
                  Join as guest
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setGuestMode(!guestMode)}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-medium text-white hover:bg-white/10"
              >
                Use social accounts instead
              </button>
            )}
          </div>
          {guestMode ? (
            <>
              <Divider label="or join without account" />
              <p className="text-white/70 mb-3">Enter your name. You will play as X.</p>
            </>
          ) : null}
        </>
      )}
      
      {(sessionPresent || guestMode) ? (
        <>
          <NameInput
            autoFocus
            value={sessionPresent ? (sessionUserName ?? joinName) : joinName}
            onChange={setJoinName}
            placeholder="Player 1"
            className="mb-4"
            disabled={!!sessionPresent}
          />
          {onContinue ? (
            <button
              onClick={onContinue}
              className="w-full rounded bg-white text-black px-4 py-2 font-semibold hover:bg-white/90"
            >
              Continue to mode selection
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
