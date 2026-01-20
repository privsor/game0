"use client";

import { api } from "~/trpc/react";

export default function WantersModal({
  open,
  onClose,
  prizeId,
}: {
  open: boolean;
  onClose: () => void;
  prizeId: number;
}) {
  const { data, isLoading } = api.prizes.listWanters.useQuery({ prizeId }, { enabled: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80">
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">People who want this</div>
          <button onClick={onClose} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Close</button>
        </div>

        {isLoading ? (
          <div className="p-4 text-white/60">Loading…</div>
        ) : ((data as any)?.items?.length ?? 0) === 0 ? (
          <div className="p-4 text-white/60">No one yet. Be the first!</div>
        ) : (
          <>
            <div className="space-y-3">
              {(data as any).items?.map((w: any) => (
                <div key={w.userId + String(w.createdAt)} className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-2">
                  <img src={w.userImage ?? "/default-avatar.png"} alt={w.userName ?? ""} className="h-8 w-8 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold truncate">{w.userName ?? "User"}</div>
                    <div className="text-[11px] text-white/60">{new Date(w.createdAt as unknown as string).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            {Number((data as any)?.baseWants ?? 0) > 0 && (
              <div className="mt-4 rounded border border-white/10 bg-white/5 p-2 text-center text-xs text-white/70">
                +{Number((data as any).baseWants)} more players want this prize
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
