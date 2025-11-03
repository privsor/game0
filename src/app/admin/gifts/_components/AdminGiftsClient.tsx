"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

interface GiftRow {
  id: number;
  title: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  coinCost: number;
  vendor: string;
  voucherAmount?: number | null;
  active: number; // 1 or 0
}

export default function AdminGiftsClient() {
  const { data, refetch, isLoading } = api.gifts.listAll.useQuery();
  const addMutation = api.gifts.add.useMutation();
  const updateMutation = api.gifts.update.useMutation();
  const toggleMutation = api.gifts.toggleActive.useMutation();
  const removeMutation = api.gifts.remove.useMutation();

  const [form, setForm] = useState({
    title: "",
    imageUrl: "",
    videoUrl: "",
    coinCost: 0,
    vendor: "amazon",
    voucherAmount: 0,
    active: true,
  });

  const gifts: GiftRow[] = useMemo(() => (data as any) ?? [], [data]);

  const handleAdd = async () => {
    try {
      if (!form.title || form.coinCost <= 0) {
        alert("Title and positive coin cost are required");
        return;
      }
      await addMutation.mutateAsync({
        title: form.title,
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        coinCost: Number(form.coinCost),
        vendor: form.vendor || "amazon",
        voucherAmount: form.voucherAmount ? Number(form.voucherAmount) : undefined,
        active: !!form.active,
      });
      setForm({ title: "", imageUrl: "", videoUrl: "", coinCost: 0, vendor: "amazon", voucherAmount: 0, active: true });
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Failed to add gift");
    }
  };

  const handleToggle = async (g: GiftRow) => {
    try {
      await toggleMutation.mutateAsync({ id: g.id, active: g.active ? false : true });
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Failed to toggle");
    }
  };

  const handleUpdateField = async (id: number, patch: Partial<GiftRow>) => {
    try {
      const payload: any = { id };
      if (patch.title !== undefined) payload.title = patch.title;
      if (patch.imageUrl !== undefined) payload.imageUrl = patch.imageUrl || null;
      if (patch.videoUrl !== undefined) payload.videoUrl = patch.videoUrl || null;
      if (patch.coinCost !== undefined) payload.coinCost = Number(patch.coinCost);
      if (patch.vendor !== undefined) payload.vendor = patch.vendor;
      if (patch.voucherAmount !== undefined) payload.voucherAmount = patch.voucherAmount === null ? null : Number(patch.voucherAmount);
      if (patch.active !== undefined) payload.active = !!patch.active;
      await updateMutation.mutateAsync(payload);
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update");
    }
  };

  const handleRemove = async (id: number) => {
    try {
      if (!confirm("Delete this gift? This cannot be undone.")) return;
      await removeMutation.mutateAsync({ id });
      await refetch();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    }
  };

  const busy = addMutation.isPending || updateMutation.isPending || toggleMutation.isPending || removeMutation.isPending;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold">Admin: Gifts</h1>

      <section className="mb-10 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">Add Gift</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="rounded bg-black px-2 py-1 md:col-span-2"
          />
          <input
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            placeholder="Image URL"
            className="rounded bg-black px-2 py-1 md:col-span-2"
          />
          <input
            value={form.videoUrl}
            onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
            placeholder="Video URL (optional)"
            className="rounded bg-black px-2 py-1 md:col-span-2"
          />
          <input
            type="number"
            value={form.coinCost}
            onChange={(e) => setForm((f) => ({ ...f, coinCost: Number(e.target.value) }))}
            placeholder="Coin Cost"
            className="rounded bg-black px-2 py-1"
          />
          <input
            value={form.vendor}
            onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            placeholder="Vendor"
            className="rounded bg-black px-2 py-1"
          />
          <input
            type="number"
            value={form.voucherAmount}
            onChange={(e) => setForm((f) => ({ ...f, voucherAmount: Number(e.target.value) }))}
            placeholder="Voucher Amount"
            className="rounded bg-black px-2 py-1"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
          <button
            onClick={handleAdd}
            disabled={busy}
            className="rounded bg-white px-3 py-1.5 font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add Gift"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">All Gifts</h2>
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="px-2 py-2 text-left">ID</th>
                  <th className="px-2 py-2 text-left">Title</th>
                  <th className="px-2 py-2 text-left">Image URL</th>
                  <th className="px-2 py-2 text-left">Video URL</th>
                  <th className="px-2 py-2 text-left">Coin Cost</th>
                  <th className="px-2 py-2 text-left">Vendor</th>
                  <th className="px-2 py-2 text-left">Voucher Amt</th>
                  <th className="px-2 py-2 text-left">Active</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((g) => (
                  <tr key={g.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{g.id}</td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={g.title}
                        onBlur={(e) => e.target.value !== g.title && handleUpdateField(g.id, { title: e.target.value })}
                        className="w-56 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={g.imageUrl ?? ""}
                        onBlur={(e) => e.target.value !== (g.imageUrl ?? "") && handleUpdateField(g.id, { imageUrl: e.target.value || null })}
                        className="w-64 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={g.videoUrl ?? ""}
                        onBlur={(e) => e.target.value !== (g.videoUrl ?? "") && handleUpdateField(g.id, { videoUrl: e.target.value || null })}
                        className="w-64 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        defaultValue={g.coinCost}
                        onBlur={(e) => Number(e.target.value) !== g.coinCost && handleUpdateField(g.id, { coinCost: Number(e.target.value) })}
                        className="w-28 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={g.vendor}
                        onBlur={(e) => e.target.value !== g.vendor && handleUpdateField(g.id, { vendor: e.target.value })}
                        className="w-32 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        defaultValue={g.voucherAmount ?? 0}
                        onBlur={(e) => Number(e.target.value) !== (g.voucherAmount ?? 0) && handleUpdateField(g.id, { voucherAmount: Number(e.target.value) })}
                        className="w-28 rounded bg-black px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleToggle(g)}
                        disabled={busy}
                        className={`rounded px-2 py-1 text-xs font-semibold ${g.active ? "bg-emerald-400 text-black" : "bg-gray-600 text-white"}`}
                      >
                        {g.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleRemove(g.id)}
                        disabled={busy}
                        className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
