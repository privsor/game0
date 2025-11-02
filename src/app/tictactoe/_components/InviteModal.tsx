"use client";

import React, { memo } from "react";

type InviteModalProps = {
  roomCode: string;
  hostName: string;
  onClose: () => void;
  shareBusy: boolean;
  shareDone: null | 'copied' | 'shared';
  setShareBusy: (v: boolean) => void;
  setShareDone: (v: null | 'copied' | 'shared') => void;
};

function InviteModalImpl({ roomCode, hostName, onClose, shareBusy, shareDone, setShareBusy, setShareDone }: InviteModalProps) {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-xl text-center">
        <h2 className="text-xl font-bold mb-1">Scan to join {hostName}'s room</h2>
        <div className="text-white/60 text-sm mb-3">Room {roomCode}</div>
        <div className="flex items-center justify-center mb-4">
          {/* External QR image service for simplicity; can be replaced with local generator later */}
          <img src={qrSrc} alt="Room QR code" className="rounded bg-white/5 p-2" />
        </div>
        <div className="text-xs text-white/60 break-all mb-3 px-2">{url}</div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={async () => {
              if (!url) return;
              setShareBusy(true);
              setShareDone(null);
              try {
                if (navigator.share && window.isSecureContext) {
                  await navigator.share({ title: 'Join my Tic Tac Toe room', text: 'Let’s play!', url });
                  setShareDone('shared');
                } else if (navigator.clipboard && window.isSecureContext) {
                  await navigator.clipboard.writeText(url);
                  setShareDone('copied');
                } else {
                  const mail = `mailto:?subject=${encodeURIComponent('Join my Tic Tac Toe room')}&body=${encodeURIComponent(url)}`;
                  window.location.href = mail;
                }
              } catch {
                // ignore
              } finally {
                setShareBusy(false);
                if (shareDone !== null) {
                  setTimeout(() => setShareDone(null), 1500);
                }
              }
            }}
            className="rounded bg-white text-black hover:bg-white/90 px-4 py-2 font-semibold flex items-center disabled:opacity-60"
            disabled={shareBusy}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            {shareBusy ? 'Sharing…' : shareDone === 'copied' ? 'Copied!' : shareDone === 'shared' ? 'Shared!' : 'Share'}
          </button>
          <button
            onClick={onClose}
            className="rounded border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2"
          >Close</button>
        </div>
        <div className="sr-only" aria-live="polite">
          {shareDone === 'copied' ? 'Link copied to clipboard' : shareDone === 'shared' ? 'Share dialog opened' : ''}
        </div>
      </div>
    </div>
  );
}

export const InviteModal = memo(InviteModalImpl);
