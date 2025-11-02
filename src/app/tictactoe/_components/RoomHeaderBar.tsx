"use client";

import React, { memo } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

export type RoomHeaderBarProps = {
  roomCode: string;
  connected: boolean;
  peers: number;
  copied: boolean;
  onCopyLink: () => void;
  onInvite: () => void;
  showInviteHint: boolean;
};

function RoomHeaderBarImpl({ roomCode, connected, peers, copied, onCopyLink, onInvite, showInviteHint }: RoomHeaderBarProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 md:p-3 flex flex-wrap md:flex-nowrap items-center justify-between text-white/70 text-sm gap-2 md:gap-4 overflow-x-auto">
      <div className="text-white/80">
        Room <span className="ml-2 rounded bg-white/10 px-2 py-0.5 font-mono">{roomCode}</span>
      </div>
      <span className="hidden sm:inline">·</span>
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
          aria-hidden
        />
        <span className="sr-only">{connected ? 'Online' : 'Connecting'}</span>
      </span>
      <span className="hidden sm:inline">·</span>
      <span><span className="hidden sm:inline">Online </span>{peers}</span>
      <span className="hidden sm:inline">·</span>
      <button onClick={onCopyLink} className="rounded bg-white/10 hover:bg-white/20 px-2 py-1">
        {copied ? 'Copied!' : (<><span className="sm:hidden">Copy link</span><span className="hidden sm:inline">Copy link</span></>)}
      </button>
      <Tooltip.Provider disableHoverableContent>
        <Tooltip.Root open={showInviteHint}>
          <Tooltip.Trigger asChild>
            <button onClick={onInvite} className="rounded bg-white/10 hover:bg-white/20 px-2 py-1">
              <span className="sm:hidden">Bring a friend</span>
              <span className="hidden sm:inline">Bring a friend</span>
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="center"
              sideOffset={8}
              className="z-[9999] rounded-xl animate-pulse bg-white text-black text-xs font-semibold px-3 py-2 shadow-2xl ring-2 ring-black/10 data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[side=top]:slide-in-from-bottom-1"
            >
              Click here to invite
              <span className="hidden sm:inline text-[10px] font-normal text-black/60 ml-1">(share link)</span>
              <Tooltip.Arrow className="fill-white drop-shadow" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}

export const RoomHeaderBar = memo(RoomHeaderBarImpl);
