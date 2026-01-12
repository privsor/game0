"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

// Server action lives in the same file using the React Server Actions convention
// We export a stub client that calls the server action via form action prop.

export default function FakoUsersAdminPage() {
  const [username, setUsername] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  type UserRow = { id: string; name: string | null; email: string; image: string | null };
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { name?: string; image?: string }>>({});

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
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Fako Users Admin</h1>
      <p className="text-sm text-gray-600">Create lightweight test users. The user id and email are auto-derived.</p>

      <div className="space-y-4">
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

      <div className="pt-8">
        <h2 className="text-xl font-semibold mb-3">Existing Fako Users</h2>
        {loadingList ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">No fako users yet.</p>
        ) : (
          <div className="space-y-4">
            {users.map((u) => {
              const e = edit[u.id] || {};
              return (
                <div key={u.id} className="rounded border p-3">
                  <div className="text-xs text-gray-500">{u.id}</div>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Name</label>
                      <input
                        className="mt-1 w-full rounded border px-3 py-2"
                        defaultValue={u.name || ""}
                        onChange={(ev) => setEdit((prev) => ({ ...prev, [u.id]: { ...prev[u.id], name: ev.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Profile Image URL</label>
                      <input
                        className="mt-1 w-full rounded border px-3 py-2"
                        defaultValue={u.image || ""}
                        onChange={(ev) => setEdit((prev) => ({ ...prev, [u.id]: { ...prev[u.id], image: ev.target.value } }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-gray-500">{u.email}</span>
                    <button
                      onClick={() => onSave(u)}
                      disabled={saving === u.id}
                      className="ml-auto rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      {saving === u.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
