import "~/styles/globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { auth } from "~/server/auth";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Daddy Games",
  description: "Minimal multiplayer games.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-black text-white">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-black/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-extrabold tracking-tight">Daddy Games</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/tictactoe" className="text-white/80 hover:text-white">Tic Tac Toe</Link>
              <span className="text-white/30">|</span>
              <Link
                href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20"
              >
                {session ? "Sign out" : "Sign in"}
              </Link>
            </nav>
          </div>
        </header>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Analytics />
      </body>
    </html>
  );
}
