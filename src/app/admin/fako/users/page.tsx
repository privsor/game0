"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import FakoUserCard, { type FakoUserRow } from "./_components/FakoUserCard";

// Server action lives in the same file using the React Server Actions convention
// We export a stub client that calls the server action via form action prop.

export default function FakoUsersAdminPage() {
  const [username, setUsername] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  type UserRow = { id: string; name: string | null; email: string; image: string | null; balance?: number | null };
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { name?: string; image?: string; delta?: string; reason?: string }>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);

  const derived = useMemo(() => {
    const u = (username || "").trim();
    const safe = u.replace(/\s+/g, "-").toLowerCase();
    const id = safe ? `fako-${safe}` : "";
    const email = safe ? `${safe}@fako.non` : "";
    return { id, email };
  }, [username]);

  async function onSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/admin/fako/users/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, imageUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || "Failed to create user");
        } else {
          setMessage("User created successfully");
          setUsername("");
          setImageUrl("");
          // refresh list
          void fetchList();
        }
      } catch (e: any) {
        setError(e?.message || "Request failed");
      }
    });
  }

  async function fetchList() {
    try {
      setLoadingList(true);
      const res = await fetch("/admin/fako/users/list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setUsers(data.users || []);
    } catch (e: any) {
      // non-fatal
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void fetchList();
  }, []);

  async function onAdjust(u: UserRow) {
    const patch = edit[u.id] || {};
    const deltaNum = Number(patch.delta || "0");
    if (!Number.isFinite(deltaNum) || !deltaNum) {
      setError("Enter a non-zero numeric delta");
      return;
    }
    setSaving(u.id + "#bal");
    try {
      const res = await fetch("/admin/fako/users/wallet/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, delta: Math.trunc(deltaNum), reason: (patch.reason || "").trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setEdit((prev) => ({ ...prev, [u.id]: { ...prev[u.id], delta: "", reason: "" } }));
      void fetchList();
    } catch (e: any) {
      setError(e?.message || "Adjust failed");
    } finally {
      setSaving(null);
    }
  }

  async function onSave(u: UserRow) {
    const patch = edit[u.id] || {};
    setSaving(u.id);
    try {
      const res = await fetch("/admin/fako/users/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, name: patch.name ?? u.name ?? "", image: patch.image ?? u.image ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setEdit((prev) => ({ ...prev, [u.id]: {} }));
      void fetchList();
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 pt-20 space-y-6">
      {/* Top fixed bar */}
      <div className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-3">
          <div className="font-semibold">Fako Users</div>
          <button onClick={() => setShowCreate(true)} className="ml-auto rounded bg-white text-black px-3 py-1.5 text-sm">Create Fako User</button>
        </div>
      </div>
      {/* Legacy title/desc hidden */}
      <h1 className="hidden text-2xl font-semibold">Fako Users Admin</h1>
      <p className="hidden text-sm text-gray-600">Create lightweight test users. The user id and email are auto-derived.</p>

      {/* Inline create UI hidden; using modal */}
      <div className="space-y-4 hidden">
        <div>
          <label className="block text-sm font-medium">Username</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="e.g. alice"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Profile Image URL (optional)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500">Derived User ID</label>
            <input className="mt-1 w-full rounded border bg-gray-900 px-3 py-2" value={derived.id} readOnly />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Derived Email</label>
            <input className="mt-1 w-full rounded border bg-gray-900 px-3 py-2" value={derived.email} readOnly />
          </div>
        </div>

        <button
          onClick={() => onSubmit(new FormData())}
          disabled={!derived.id || !derived.email || isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create User"}
        </button>

        {message && <p className="text-green-600 text-sm">{message}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="pt-2">
        <h2 className="text-xl font-semibold mb-3">Existing Fako Users</h2>
        {loadingList ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">No fako users yet.</p>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <FakoUserCard
                key={u.id}
                user={u as FakoUserRow}
                edit={edit}
                setEdit={setEdit}
                saving={saving}
                expanded={expanded}
                setExpanded={setExpanded}
                onSave={onSave as any}
                onAdjust={onAdjust as any}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Fako User modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative w-[92%] max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Create Fako User</div>
              <button onClick={() => setShowCreate(false)} className="rounded px-2 py-1 text-white/80 hover:text-white">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Username</label>
                <input className="mt-1 w-full rounded border px-3 py-2" placeholder="e.g. alice" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Profile Image URL (optional)</label>
                <input className="mt-1 w-full rounded border px-3 py-2" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500">Derived User ID</label>
                  <input className="mt-1 w-full rounded border bg-gray-900 px-3 py-2" value={derived.id} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Derived Email</label>
                  <input className="mt-1 w-full rounded border bg-gray-900 px-3 py-2" value={derived.email} readOnly />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="rounded border border-white/30 px-3 py-1.5 text-sm">Cancel</button>
                <button onClick={() => onSubmit(new FormData())} disabled={!derived.id || !derived.email || isPending} className="rounded bg-white text-black px-3 py-1.5 text-sm disabled:opacity-50">
                  {isPending ? "Creating..." : "Create"}
                </button>
              </div>
              {message && <p className="text-emerald-400 text-xs">{message}</p>}
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
