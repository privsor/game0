"use client";

import { useState } from "react";
import Link from "next/link";
import AuthTrigger from "./AuthTrigger";
import WalletBalanceBadge from "./WalletBalanceBadge";
import { usePathname } from "next/navigation";

export default function Header({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Hide global client header on all admin routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-2 py-1 gap-2">
        <Link href="/" className="font-extrabold tracking-tight">
          Daddy Games
        </Link>

        
        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/tictactoe" className="text-white/80 hover:text-white">
            Tic Tac Toe
          </Link>
          <span className="hidden text-white/30 md:inline">|</span>
          <Link href="/prizes" className="text-white/80 hover:text-white">
            Daddy's Prizes
          </Link>
          <span className="hidden text-white/30 md:inline">|</span>
          <Link href="/daddycoins" className="text-white/80 hover:text-white">
            Buy DaddyCoins
          </Link>
          <span className="hidden text-white/30 md:inline">|</span>
         
        </nav>

        {/* Mobile inline wallet badge */}
        <div className="flex items-center gap-2">
          <WalletBalanceBadge />
          <AuthTrigger signedIn={signedIn} size="sm" />
        


        {/* Mobile menu button */}
        <button
          type="button"
          aria-label="Toggle menu"
          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-white/10 bg-black/90 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            <Link href="/tictactoe" className="text-white/80 hover:text-white" onClick={() => setOpen(false)}>
              Tic Tac Toe
            </Link>
            <Link href="/prizes" className="text-white/80 hover:text-white" onClick={() => setOpen(false)}>
              Daddy's Prizes
            </Link>
            <Link href="/daddycoins" className="text-white/80 hover:text-white" onClick={() => setOpen(false)}>
              Buy DaddyCoins
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
