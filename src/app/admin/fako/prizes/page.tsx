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
      {/* Floating selector */}
      <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-black/70 backdrop-blur px-4 py-3 text-white shadow-lg w-[320px]">
        <div className="text-sm font-semibold mb-2">Act as Fako User</div>
        {loading ? (
          <div className="text-xs text-white/70">Loading…</div>
        ) : (
          <div className="space-y-2">
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
            {error && <div className="text-xs text-red-400">{error}</div>}
          </div>
        )}
      </div>

      {/* Current acting user badge */}
      <div className="fixed bottom-6 left-6 z-50 rounded-lg border border-white/10 bg-black/70 backdrop-blur px-3 py-2 text-xs text-white">
        Acting as: {effective ? (effective.name || effective.email || effective.id) : "self"}
      </div>

      {/* Existing Prize experience; remount on effective change */}
      <PrizeClient key={effective?.id || "self"} />
    </div>
  );
}
