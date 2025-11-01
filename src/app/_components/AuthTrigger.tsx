"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import AuthModal from "./AuthModal";
import { useSession } from "next-auth/react";

type Props = {
  signedIn: boolean;
  size?: "sm" | "md";
  callbackUrl?: string;
};

export default function AuthTrigger({ signedIn, size = "md", callbackUrl }: Props) {
  const [open, setOpen] = React.useState(false);
  const { data: session } = useSession();

  // Sizes for compact vs regular
  const padding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";

  // If user is signed in (from prop) prefer session info to render avatar link
  if (signedIn) {
    const avatar = session?.user?.image || "/profileicon.svg";
    const name = session?.user?.name || "Profile";
    return (
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 rounded-full border border-white/0 bg-white/5 hover:bg-white/10"
        title="View profile"
      >
        <Image
          src={avatar}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
        {size !== "sm" && <span className="text-sm">{name}</span>}
      </Link>
    );
  }

  // Signed out: show profile icon + "Log in" that opens the modal
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 ${padding}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="auth-modal"
      >
        <Image src="/profileicon.svg" alt="Log in" width={18} height={18} className="opacity-90" />
        <span className="text-sm">Log in</span>
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} callbackUrl={callbackUrl} />
    </>
  );
}
