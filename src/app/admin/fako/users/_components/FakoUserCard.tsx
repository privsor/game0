"use client";

import React from "react";

export type FakoUserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  balance?: number | null;
};

export default function FakoUserCard({
  user,
  edit,
  setEdit,
  saving,
  expanded,
  setExpanded,
  onSave,
  onAdjust,
}: {
  user: FakoUserRow;
  edit: Record<string, { name?: string; image?: string; delta?: string; reason?: string }>;
  setEdit: React.Dispatch<React.SetStateAction<Record<string, { name?: string; image?: string; delta?: string; reason?: string }>>>;
  saving: string | null;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSave: (u: FakoUserRow) => Promise<void> | void;
  onAdjust: (u: FakoUserRow) => Promise<void> | void;
}) {
  const u = user;
  const e = edit[u.id] || {};
  return (
    <div className="rounded border p-0 overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white/5 border-b">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={u.image || "/avatar.svg"} alt={u.name || u.email} className="h-9 w-9 rounded-full object-cover bg-white/10" />
        <div className="min-w-0">
          <div className="font-medium truncate">{u.name || u.email}</div>
          <div className="text-[11px] text-gray-500 truncate">{u.id}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-gray-500">Bal:</div>
          <div className="font-mono text-sm">{u.balance ?? 0}</div>
          <button
            onClick={() => setExpanded((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
            className="rounded border border-white/20 px-2 py-1 text-xs"
          >
            {expanded[u.id] ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {expanded[u.id] && (
        <div className="p-3 space-y-3">
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
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xs text-gray-500 truncate">{u.email}</span>
            <button onClick={() => onSave(u)} disabled={saving === u.id} className="ml-auto rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
              {saving === u.id ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">Wallet</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs text-gray-600">Balance:</div>
              <div className="font-mono text-sm">{u.balance ?? 0}</div>
              <input
                className="ml-auto w-24 rounded border px-2 py-1 text-sm"
                placeholder="Δ e.g. 5"
                value={edit[u.id]?.delta ?? ""}
                onChange={(ev) => setEdit((prev) => ({ ...prev, [u.id]: { ...prev[u.id], delta: ev.target.value } }))}
              />
              <input
                className="w-40 rounded border px-2 py-1 text-sm"
                placeholder="Reason (opt)"
                value={edit[u.id]?.reason ?? ""}
                onChange={(ev) => setEdit((prev) => ({ ...prev, [u.id]: { ...prev[u.id], reason: ev.target.value } }))}
              />
              <button onClick={() => onAdjust(u)} disabled={saving === u.id + "#bal"} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
                {saving === u.id + "#bal" ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
