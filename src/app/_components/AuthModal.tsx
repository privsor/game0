"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { createPortal } from "react-dom";
import Image from "next/image";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  callbackUrl?: string;
};

export default function AuthModal({ open, onClose, callbackUrl = "/" }: AuthModalProps) {
  if (!open) return null;

  return createPortal(
    <div id="auth-modal" className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close auth modal"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Sign in to Daddy Games</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-sm text-white/60">
          Continue with one of the providers below to start playing.
        </p>

        <div className="grid gap-3">
          <button
            onClick={() => signIn("discord", { callbackUrl })}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
          >
            <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
            Continue with Discord
          </button>
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
          >
            <Image src="icons/google.svg" alt="Google" width={20} height={20} />
            Continue with Google
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>,
    document.body,
  );
}
