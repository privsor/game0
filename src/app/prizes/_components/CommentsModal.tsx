"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";

export default function CommentsModal({
  open,
  onClose,
  prizeId,
  requireAuth,
  onChanged,
  canDelete,
}: {
  open: boolean;
  onClose: () => void;
  prizeId: number;
  requireAuth?: () => boolean; // return true if blocked by auth
  onChanged?: () => void;
  canDelete?: boolean;
}) {
  const { data, refetch, isLoading } = api.prizes.listComments.useQuery({ prizeId }, { enabled: open });
  const addComment = api.prizes.addComment.useMutation();
  const delComment = api.prizes.deleteComment.useMutation();
  const { data: session } = useSession();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string | null } | null>(null);
  const [local, setLocal] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [viewportRect, setViewportRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [bottomInset, setBottomInset] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // Optionally account for scrollbar width to avoid layout shift
    const scrollBarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarGap > 0) document.body.style.paddingRight = `${scrollBarGap}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  // Mobile keyboard handling with VisualViewport (iOS/Android)
  useEffect(() => {
    if (!open) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const update = () => {
      if (vv) {
        setViewportRect({
          top: Math.round(vv.offsetTop),
          left: Math.round(vv.offsetLeft),
          width: Math.round(vv.width),
          height: Math.round(vv.height),
        });
        const kb = Math.max(0, window.innerHeight - vv.height);
        setBottomInset(kb);
        // If keyboard is present, ensure the input stays adjacent to it by
        // nudging the scrollable area to the bottom after the viewport settles
        if (kb > 0) {
          setTimeout(() => {
            const sc = scrollRef.current;
            if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
          }, 50);
        }
      } else {
        setViewportRect(null);
        setBottomInset(0);
      }
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  // Sync local list when server data changes
  useEffect(() => {
    if (data) setLocal(data as any[]);
  }, [JSON.stringify(data ?? [])]);

  const tree = useMemo(() => {
    const byParent = new Map<number | null, any[]>();
    (local ?? []).forEach((c: any) => {
      const pid = (c.parentCommentId as number | null) ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(c);
    });
    // sort parents desc (newest first), children asc (older first) for readability
    const roots = (byParent.get(null) ?? []).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const childrenOf = (id: number) => (byParent.get(id) ?? []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return { roots, childrenOf };
  }, [JSON.stringify(local ?? [])]);

  if (!open) return null;

  const submit = async () => {
    if (!text.trim()) return;
    if (requireAuth && requireAuth()) return;
    // optimistic append
    const optimistic = {
      id: `temp-${Date.now()}`,
      userId: session?.user?.id ?? "me",
      userImage: (session?.user as any)?.image ?? null,
      userName: session?.user?.name ?? "You",
      text: text.trim(),
      createdAt: new Date().toISOString(),
      parentCommentId: replyTo?.id ?? null,
    } as any;
    setLocal((prev) => [optimistic, ...prev]);
    try {
      await addComment.mutateAsync({ prizeId, text: text.trim(), parentCommentId: replyTo?.id });
      setText("");
      setReplyTo(null);
      await refetch();
      onChanged?.();
    } catch (e) {
      // ignore for now
    } finally {
      // ensure local syncs with server
      const fresh = await refetch();
      if (fresh.data) setLocal(fresh.data as any[]);
    }
  };

  const removeLocalById = (id: number) => {
    setLocal((prev) => prev.filter((c: any) => Number(c.id) !== id && Number(c.parentCommentId ?? -1) !== id));
  };

  const content = (
    <div
      className="fixed z-[120] flex flex-col bg-black/80"
      role="dialog"
      aria-modal="true"
      style={
        viewportRect
          ? { top: viewportRect.top, left: viewportRect.left, width: viewportRect.width, height: viewportRect.height, position: "fixed" }
          : { inset: 0 as any }
      }
    >
      {/* Header: not part of the scrollable area */}
      <div className="mx-auto w-full max-w-md flex-none px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">Comments</div>
          <button onClick={onClose} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">Close</button>
        </div>
      </div>

      {/* Scrollable comments list */}
      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
      >

        {isLoading ? (
          <div className="p-4 text-white/60">Loading…</div>
        ) : (local?.length ?? 0) === 0 ? (
          <div className="p-4 text-white/60">No comments yet. Be the first!</div>
        ) : (
          <div className="space-y-3">
            {tree.roots.map((c: any) => (
              <div key={c.id} className="rounded border border-white/10 bg-black/5 backdrop-blur-md p-2">
                <div className="flex items-start gap-2">
                  <img src={(c as any).userImage ?? "/default-avatar.png"} alt={(c as any).userName ?? ""} className="h-7 w-7 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between min-w-0">
                      <div className="text-sm font-semibold truncate">{(c as any).userName ?? "Someone"}</div>
                      <div className="ml-3 shrink-0 text-[11px] text-white/60">{new Date(c.createdAt as unknown as string).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-sm leading-snug whitespace-pre-wrap break-words">{c.text}</div>
                    <div className="mt-1 text-xs text-white/60 flex items-center gap-1">
                      <button
                        className="rounded px-1 py-0.5 hover:bg-white/10"
                        onClick={() => {
                          setReplyTo({ id: Number(c.id), userName: c.userName });
                          // Focus the input to open the mobile keyboard and ensure visibility
                          setTimeout(() => {
                            inputRef.current?.focus();
                            const sc = scrollRef.current;
                            if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
                          }, 50);
                        }}
                      >
                        Reply
                      </button>
                      {canDelete && (
                        <button
                          className="rounded px-1 py-0.5 text-red-300 hover:bg-white/10"
                          onClick={async () => {
                            if (!confirm("Delete this comment and its direct replies?")) return;
                            removeLocalById(Number(c.id));
                            try {
                              await delComment.mutateAsync({ id: Number(c.id) });
                              await refetch();
                              onChanged?.();
                            } catch {}
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {/* children */}
                    {(tree.childrenOf(Number(c.id)) ?? []).length > 0 && (
                      <div className="mt-2 space-y-2">
                        {tree.childrenOf(Number(c.id)).map((r: any) => (
                          <div key={r.id} className="ml-8 flex items-start gap-2">
                            <img src={(r as any).userImage ?? "/default-avatar.png"} alt={(r as any).userName ?? ""} className="h-6 w-6 rounded-full object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between min-w-0">
                                <div className="text-xs font-semibold truncate">{(r as any).userName ?? "Someone"}</div>
                                <div className="ml-3 shrink-0 text-[10px] text-white/60">{new Date(r.createdAt as unknown as string).toLocaleString()}</div>
                              </div>
                              <div className="mt-0.5 text-xs leading-snug whitespace-pre-wrap break-words">{r.text}</div>
                              {canDelete && (
                                <div className="mt-0.5 text-[11px] text-white/60">
                                  <button
                                    className="rounded px-1 py-0.5 text-red-300 hover:bg-white/10"
                                    onClick={async () => {
                                      if (!confirm("Delete this reply?")) return;
                                      removeLocalById(Number(r.id));
                                      try {
                                        await delComment.mutateAsync({ id: Number(r.id) });
                                        await refetch();
                                        onChanged?.();
                                      } catch {}
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: input bar, kept independent and raised above keyboard via padding */}
      <div
        className="mx-auto w-full max-w-md border-t border-white/10 bg-black/70 p-3 flex-none"
        style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => {
              // Delay to allow keyboard animation then ensure visibility
              setTimeout(() => {
                // Ensure the scroll area snaps to the bottom so the input is visible
                const sc = scrollRef.current;
                if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
                else inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }, 150);
            }}
            placeholder={replyTo ? `Reply to ${replyTo.userName ?? "comment"}…` : "Add a comment…"}
            className="flex-1 rounded bg-white/10 px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none"
          />
          {replyTo && (
            <button onClick={() => setReplyTo(null)} className="rounded border border-white/20 px-2 py-2 text-xs text-white/70 hover:bg-white/10">Cancel</button>
          )}
          <button onClick={submit} disabled={addComment.isPending || !text.trim()} className="rounded bg-white px-3 py-2 text-black disabled:opacity-50">
            {addComment.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );

  // Render in a portal so it is not constrained by parent modals or transforms
  return mounted && typeof window !== "undefined" && document?.body
    ? createPortal(content, document.body)
    : content;
}
