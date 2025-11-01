"use client";

import Link from "next/link";
import Image from "next/image";
import { api } from "~/trpc/react";

export default function WalletBalanceBadge() {
  const { data, isLoading } = api.wallet.getBalance.useQuery();
  const balance = data?.balance ?? 0;

  return (
    <Link
      href="/daddycoins"
      className="inline-flex items-start rounded-md border border-white/10 bg-white/5 px-2 py-0.5 hover:bg-white/10"
      title="View or top up your DaddyCoins"
    >
      <div className="flex flex-col leading-none">
        {/* <span className="text-[7px] space-x-1 tracking-[0.12em] text-white/60">
          DADDY COINS
        </span> */}
        <span className="mt-1 inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums">
          {isLoading ? "…" : balance}
          <Image src="/daddycoin.svg" width={24} height={24} alt="DaddyCoins" />
        </span>
      </div>
    </Link>
  );
}
