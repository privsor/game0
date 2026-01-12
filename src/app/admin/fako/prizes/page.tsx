"use client";

import { useEffect, useState, useTransition } from "react";
import PrizeClient from "~/app/prizes/_components/PrizeClient";

type UserRow = { id: string; name: string | null; email: string; image: string | null };

export default function AdminFakoPrizesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [effective, setEffective] = useState<{ id: string; email: string; name: string | null; image: string | null } | null>(null);
  const [fakoNow, setFakoNow] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);

  async function fetchFakos() {
    try {
      setLoading(true);
      const res = await fetch("/admin/fako/users/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load fako users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchFakos(); }, []);
  useEffect(() => { void fetchEffective(); }, []);

  async function fetchEffective() {
    try {
      const res = await fetch("/admin/fako/effective", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setEffective(data.impersonating || null);
    } catch {}
  }

  async function applyImpersonation(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        if (userId) {
          const res = await fetch("/admin/fako/impersonate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "failed");
        } else {
          await fetch("/admin/fako/impersonate", { method: "DELETE" });
        }
        // Refresh effective status and remount PrizeClient via key
        await fetchEffective();
      } catch (e: any) {
        setError(e?.message || "Failed to set impersonation");
      }
    });
  }

  return (
    <div className="relative">
      {/* Floating 'My Controls' button */}
      <button
        aria-label="Open controls"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-rose-600 text-white shadow-lg h-12 w-12 flex items-center justify-center md:h-14 md:w-14"
      >
        ☰
      </button>

      {/* Slide-over Controls Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          {/* Panel */}
          <div className="relative m-0 mb-0 w-full rounded-t-2xl bg-neutral-900 text-white shadow-2xl md:mr-6 md:mb-6 md:w-[360px] md:rounded-xl border border-white/10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-sm font-semibold">My Controls</div>
              <button aria-label="Close controls" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-white/80 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-semibold">Act as Fako User</div>
                {loading ? (
                  <div className="text-xs text-white/70">Loading…</div>
                ) : (
                  <>
                    <select
                      className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} ({u.id})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-white text-black px-3 py-1.5 text-sm disabled:opacity-50"
                        disabled={!selected || isPending}
                        onClick={() => applyImpersonation(selected)}
                      >
                        {isPending ? "Applying…" : "Use Selected"}
                      </button>
                      <button
                        className="rounded border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50"
                        onClick={() => { setSelected(""); void applyImpersonation(""); }}
                      >
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Fako Clock */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="text-sm font-semibold">Fako Clock</div>
                <input
                  type="datetime-local"
                  className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm"
                  value={fakoNow}
                  onChange={(e) => setFakoNow(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded bg-white text-black px-3 py-1.5 text-sm disabled:opacity-50"
                    disabled={!fakoNow}
                    onClick={async () => {
                      try {
                        const iso = new Date(fakoNow).toISOString();
                        const res = await fetch("/admin/fako/time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ now: iso }) });
                        if (!res.ok) throw new Error("Failed to set time");
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    Apply Time
                  </button>
                  <button
                    className="rounded border border-white/30 px-3 py-1.5 text-sm"
                    onClick={async () => {
                      try {
                        await fetch("/admin/fako/time", { method: "DELETE" });
                        setFakoNow("");
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    Clear Time
                  </button>
                </div>
                <div className="text-[11px] text-white/60">When set, new interactions will be stamped with this time.</div>
              </div>

              {error && <div className="text-xs text-red-400">{error}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Current acting user badge */}
      <div className="fixed top-6 left-6 z-50 rounded-lg border border-white/10 bg-black/70 backdrop-blur px-3 py-2 text-xs text-white space-y-1 pointer-events-none">
        <div>Acting as: {effective ? (effective.name || effective.email || effective.id) : "self"}</div>
        <div>Time: {fakoNow ? new Date(fakoNow).toLocaleString() : "now"}</div>
      </div>

      {/* Existing Prize experience; remount on effective change */}
      <PrizeClient key={effective?.id || "self"} />
    </div>
  );
}
