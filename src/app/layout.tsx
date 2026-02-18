import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { auth } from "~/server/auth";
import { Analytics } from "@vercel/analytics/react";
import Providers from "./_components/Providers";
import Header from "./_components/Header";

export const metadata: Metadata = {
  title: "Daddy Games",
  description: "Old boring games our dads use to play",
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
        <Providers>
          <TRPCReactProvider>
            <Header signedIn={!!session} />
            {children}
          </TRPCReactProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
