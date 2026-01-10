"use client";

import { api } from "~/trpc/react";

export default function WinnersModal({
  open,
  onClose,
  prizeId,
}: {
  open: boolean;
  onClose: () => void;
  prizeId: number;
}) {
  const { data, isLoading } = api.prizes.listWinners.useQuery({ prizeId }, { enabled: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80">
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">Winners</div>
          <button onClick={onClose} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Close</button>
        </div>

        {isLoading ? (
          <div className="p-4 text-white/60">Loading…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-4 text-white/60">No winners yet.</div>
        ) : (
          <div className="space-y-3">
            {data?.map((w) => (
              <div key={w.id} className="rounded border border-white/10 bg-white/5 p-2">
                <div className="flex items-center gap-2">
                  <img src={(w as any).userImage ?? "/default-avatar.png"} alt={(w as any).userName ?? ""} className="h-7 w-7 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold truncate">{(w as any).userName ?? "User"}</div>
                    <div className="text-[11px] text-white/60">{new Date(w.createdAt as unknown as string).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
