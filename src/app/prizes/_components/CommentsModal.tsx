"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export default function CommentsModal({
  open,
  onClose,
  prizeId,
  requireAuth,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  prizeId: number;
  requireAuth?: () => boolean; // return true if blocked by auth
  onChanged?: () => void;
}) {
  const { data, refetch, isLoading } = api.prizes.listComments.useQuery({ prizeId }, { enabled: open });
  const addComment = api.prizes.addComment.useMutation();
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!text.trim()) return;
    if (requireAuth && requireAuth()) return;
    try {
      await addComment.mutateAsync({ prizeId, text: text.trim() });
      setText("");
      await refetch();
      onChanged?.();
    } catch (e) {
      // ignore for now
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80">
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">Comments</div>
          <button onClick={onClose} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Close</button>
        </div>

        {isLoading ? (
          <div className="p-4 text-white/60">Loading…</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-4 text-white/60">No comments yet. Be the first!</div>
        ) : (
          <div className="space-y-3">
            {data?.map((c) => (
              <div key={c.id} className="rounded border border-white/10 bg-white/5 p-2">
                <div className="flex items-start gap-2">
                  <img src={(c as any).userImage ?? "/default-avatar.png"} alt={(c as any).userName ?? ""} className="h-7 w-7 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between min-w-0">
                      <div className="text-sm font-semibold truncate">{(c as any).userName ?? "Someone"}</div>
                      <div className="ml-3 shrink-0 text-[11px] text-white/60">{new Date(c.createdAt as unknown as string).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-sm leading-snug whitespace-pre-wrap break-words">{c.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md border-t border-white/10 bg-black/70 p-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded bg-white/10 px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={addComment.isPending || !text.trim()}
            className="rounded bg-white px-3 py-2 text-black disabled:opacity-50"
          >
            {addComment.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
