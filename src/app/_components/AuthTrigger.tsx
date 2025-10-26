"use client";

import React from "react";
import AuthModal from "./AuthModal";
import { signOut } from "next-auth/react";

type Props = {
  signedIn: boolean;
  size?: "sm" | "md";
  callbackUrl?: string;
};

export default function AuthTrigger({ signedIn, size = "md", callbackUrl }: Props) {
  const [open, setOpen] = React.useState(false);

  const commonClasses =
    "rounded bg-white/10 hover:bg-white/20 transition text-sm";
  const padding = size === "sm" ? "px-3 py-1.5" : "px-10 py-3";

  if (signedIn) {
    return (
      <button onClick={() => signOut()} className={`${commonClasses} ${padding}`}>
        Sign out
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${commonClasses} ${padding}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="auth-modal"
      >
        Sign in
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} callbackUrl={callbackUrl} />
    </>
  );
}
