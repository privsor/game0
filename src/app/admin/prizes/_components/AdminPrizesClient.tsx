"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { api } from "~/trpc/react";

type FlatRow = {
  prizeId: number;
  prizeTitle: string;
  prizeActive: number;
  prizeVendor: string | null;
  prizePrimaryImageUrl: string | null;
  prizeMedia?: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }> | null;
  variantId: number;
  label: string;
  coinCost: number;
  variantActive: number;
  sortOrder: number;
  variantPrimaryImageUrl?: string | null;
  variantMedia?: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }> | null;
  variantMetadata?: any;
  claimsUsed?: number | null;
  claimsLimit?: number | null;
  claimsLeft?: number | null;
};

export default function AdminPrizesClient() {
  const { data, refetch, isLoading } = api.prizes.listAll.useQuery();
  const createPrize = api.prizes.createPrize.useMutation();
  const updatePrize = api.prizes.updatePrize.useMutation();
  const togglePrizeActive = api.prizes.togglePrizeActive.useMutation();
  const removePrize = api.prizes.removePrize.useMutation();

  const createVariant = api.prizes.createVariant.useMutation();
  const updateVariant = api.prizes.updateVariant.useMutation();
  const toggleVariantActive = api.prizes.toggleVariantActive.useMutation();
  const removeVariant = api.prizes.removeVariant.useMutation();

  // Mobile: per-prize collapse state
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const toggleCollapsed = (id: number) =>
    setCollapsed((s) => ({ ...s, [id]: !s[id] }));

  const [prizeForm, setPrizeForm] = useState({
    title: "",
    description: "",
    vendor: "generic",
    vendorLogo: "",
    primaryImageUrl: "",
    imageUrl: "",
    videoUrl: "",
    active: true,
  });

  const [variantForm, setVariantForm] = useState({
    prizeId: 0,
    label: "",
    buttonLabel: "",
    coinCost: 0,
    sku: "",
    sortOrder: 0,
    active: true,
    primaryImageUrl: "",
    claimLimit: "" as number | "",
  });

  const grouped = useMemo(() => {
    const map = new Map<
      number,
      {
        prize: {
          id: number;
          title: string;
          active: number;
          vendor: string | null;
          primaryImageUrl: string | null;
          metadata?: any;
          media: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>;
        };
        variants: (FlatRow & { variantPrimaryImageUrl?: string | null; variantMedia?: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }> | null })[];
      }
    >();
    (data as any[] | undefined)?.forEach((r) => {
      const pid = r.prizeId as number;
      if (!map.has(pid)) {
        map.set(pid, {
          prize: {
            id: pid,
            title: r.prizeTitle as string,
            active: r.prizeActive as number,
            vendor: (r.prizeVendor as string) ?? null,
            primaryImageUrl: (r.prizePrimaryImageUrl as string) ?? null,
            metadata: (r as any).prizeMetadata ?? null,
            media: (r.prizeMedia as any[]) ?? [],
          },
          variants: [],
        });
      }
      // Only include variant rows if we actually have a variant id (left join can yield nulls)
      if (typeof r.variantId === "number") {
        map.get(pid)!.variants.push(r as FlatRow);
      }
    });
    return Array.from(map.values());
  }, [data]);

  const busy =
    createPrize.isPending ||
    updatePrize.isPending ||
    togglePrizeActive.isPending ||
    removePrize.isPending ||
    createVariant.isPending ||
    updateVariant.isPending ||
    toggleVariantActive.isPending ||
    removeVariant.isPending;

  const handleCreatePrize = async () => {
    if (!prizeForm.title) return alert("Prize title required");
    await createPrize.mutateAsync({
      title: prizeForm.title,
      description: prizeForm.description || undefined,
      vendor: prizeForm.vendor || "generic",
      vendorLogo: prizeForm.vendorLogo || undefined,
      primaryImageUrl: prizeForm.primaryImageUrl || undefined,
      imageUrl: prizeForm.imageUrl || undefined,
      videoUrl: prizeForm.videoUrl || undefined,
      active: !!prizeForm.active,
    } as any);
    setPrizeForm({ title: "", description: "", vendor: "generic", vendorLogo: "", primaryImageUrl: "", imageUrl: "", videoUrl: "", active: true });
    await refetch();
  };

  const handleCreateVariant = async () => {
    if (!variantForm.prizeId) return alert("Select a prize");
    if (!variantForm.label || variantForm.coinCost <= 0) return alert("Label and positive coin cost are required");
    await createVariant.mutateAsync({
      prizeId: Number(variantForm.prizeId),
      label: variantForm.label,
      buttonLabel: variantForm.buttonLabel || undefined,
      coinCost: Number(variantForm.coinCost),
      sku: variantForm.sku || undefined,
      sortOrder: Number(variantForm.sortOrder) || 0,
      active: !!variantForm.active,
      primaryImageUrl: variantForm.primaryImageUrl || undefined,
      metadata: typeof variantForm.claimLimit === "number" && !Number.isNaN(variantForm.claimLimit)
        ? ({ claimLimit: variantForm.claimLimit } as any)
        : undefined,
    } as any);
    setVariantForm({ prizeId: 0, label: "", buttonLabel: "", coinCost: 0, sku: "", sortOrder: 0, active: true, primaryImageUrl: "", claimLimit: "" });
    await refetch();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold">Admin: Prizes & Variants</h1>

      <section className="mb-10 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">Create Prize</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input value={prizeForm.title} onChange={(e) => setPrizeForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input value={prizeForm.vendor} onChange={(e) => setPrizeForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Vendor" className="rounded bg-black px-2 py-1" />
          <input value={prizeForm.vendorLogo} onChange={(e) => setPrizeForm((f) => ({ ...f, vendorLogo: e.target.value }))} placeholder="Vendor Logo URL (optional)" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input value={prizeForm.primaryImageUrl} onChange={(e) => setPrizeForm((f) => ({ ...f, primaryImageUrl: e.target.value }))} placeholder="Primary Image URL" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input value={prizeForm.imageUrl} onChange={(e) => setPrizeForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="Legacy Image URL (optional)" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input value={prizeForm.videoUrl} onChange={(e) => setPrizeForm((f) => ({ ...f, videoUrl: e.target.value }))} placeholder="Video URL (optional)" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={prizeForm.active} onChange={(e) => setPrizeForm((f) => ({ ...f, active: e.target.checked }))} /> Active
          </label>
          <button onClick={handleCreatePrize} disabled={busy} className="rounded bg-white px-3 py-1.5 font-semibold text-black hover:bg-white/90 disabled:opacity-50">
            {busy ? "Saving…" : "Create Prize"}
          </button>
        </div>
      </section>

      <section className="mb-10 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">Create Variant</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <select value={variantForm.prizeId} onChange={(e) => setVariantForm((f) => ({ ...f, prizeId: Number(e.target.value) }))} className="rounded bg-black px-2 py-1 md:col-span-2">
            <option value={0}>Select prize…</option>
            {grouped.map(({ prize }) => (
              <option key={prize.id} value={prize.id}>
                {prize.title}
              </option>
            ))}
          </select>
          <input value={variantForm.label} onChange={(e) => setVariantForm((f) => ({ ...f, label: e.target.value }))} placeholder="Variant Label" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input value={variantForm.buttonLabel} onChange={(e) => setVariantForm((f) => ({ ...f, buttonLabel: e.target.value }))} placeholder="Button Label (optional)" className="rounded bg-black px-2 py-1" />
          <input type="number" value={variantForm.coinCost} onChange={(e) => setVariantForm((f) => ({ ...f, coinCost: Number(e.target.value) }))} placeholder="Coin Cost" className="rounded bg-black px-2 py-1" />
          <input value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU (optional)" className="rounded bg-black px-2 py-1" />
          <input type="number" value={variantForm.sortOrder} onChange={(e) => setVariantForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} placeholder="Sort Order" className="rounded bg-black px-2 py-1" />
          <input value={variantForm.primaryImageUrl} onChange={(e) => setVariantForm((f) => ({ ...f, primaryImageUrl: e.target.value }))} placeholder="Variant Primary Image URL" className="rounded bg-black px-2 py-1 md:col-span-2" />
          <input
            type="number"
            value={variantForm.claimLimit as any}
            onChange={(e) => setVariantForm((f) => ({ ...f, claimLimit: e.target.value === "" ? "" : Number(e.target.value) }))}
            placeholder="Claim Limit (optional)"
            className="rounded bg-black px-2 py-1"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={variantForm.active} onChange={(e) => setVariantForm((f) => ({ ...f, active: e.target.checked }))} /> Active
          </label>
          <button onClick={handleCreateVariant} disabled={busy} className="rounded bg-white px-3 py-1.5 font-semibold text-black hover:bg-white/90 disabled:opacity-50">
            {busy ? "Saving…" : "Create Variant"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 font-semibold">All Prizes & Variants</h2>
        {isLoading ? (
          <div>Loading…</div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ prize, variants }) => (
              <div key={prize.id} className="rounded border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold leading-tight">{prize.title}</div>
                    <div className="text-xs text-white/50">Vendor: {prize.vendor ?? "-"}</div>
                  </div>
                  <div className="inline-flex flex-wrap items-center gap-2 md:ml-auto">
                    <button
                      onClick={async () => {
                        await togglePrizeActive.mutateAsync({ id: prize.id, active: prize.active ? false : true });
                        await refetch();
                      }}
                      disabled={busy}
                      className={`rounded px-2 py-1 text-xs font-semibold ${prize.active ? "bg-emerald-400 text-black" : "bg-gray-600 text-white"}`}
                    >
                      {prize.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete prize? This will remove it and its variants.")) return;
                        await removePrize.mutateAsync({ id: prize.id });
                        await refetch();
                      }}
                      disabled={busy}
                      className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline edit for prize fields (hidden when collapsed on mobile) */}
                <div className={`grid grid-cols-1 gap-3 p-3 md:grid-cols-6 ${(collapsed[prize.id] ?? true) ? "hidden md:grid" : ""}`}>
                  <input
                    defaultValue={prize.title}
                    onBlur={async (e) => {
                      if (e.target.value !== prize.title) {
                        await updatePrize.mutateAsync({ id: prize.id, title: e.target.value });
                        await refetch();
                      }
                    }}
                    className="rounded bg-black px-2 py-1 md:col-span-2"
                    placeholder="Prize title"
                  />
                  <input
                    defaultValue={prize.vendor ?? ""}
                    onBlur={async (e) => {
                      if (e.target.value !== (prize.vendor ?? "")) {
                        await updatePrize.mutateAsync({ id: prize.id, vendor: e.target.value || undefined });
                        await refetch();
                      }
                    }}
                    className="rounded bg-black px-2 py-1"
                    placeholder="Vendor"
                  />
                  <input
                    defaultValue={(prize as any).vendorLogo ?? ""}
                    onBlur={async (e) => {
                      if (e.target.value !== ((prize as any).vendorLogo ?? "")) {
                        await updatePrize.mutateAsync({ id: prize.id, vendorLogo: e.target.value || null });
                        await refetch();
                      }
                    }}
                    className="rounded bg-black px-2 py-1 md:col-span-2"
                    placeholder="Vendor logo URL"
                  />
                  <input
                    defaultValue={prize.primaryImageUrl ?? ""}
                    onBlur={async (e) => {
                      if (e.target.value !== (prize.primaryImageUrl ?? "")) {
                        await updatePrize.mutateAsync({ id: prize.id, primaryImageUrl: e.target.value || null });
                        await refetch();
                      }
                    }}
                    className="rounded bg-black px-2 py-1 md:col-span-2"
                    placeholder="Primary image URL"
                  />
                  {/* Base Wants (virtual wants for display) */}
                  <div className="flex flex-col">
                    <label className="text-xs text-white/60 mb-1">Base wants</label>
                    <input
                      type="number"
                      defaultValue={Number(((prize as any).metadata?.baseWants ?? 0))}
                      onBlur={async (e) => {
                        const next = Number(e.target.value || 0);
                        if (next !== Number(((prize as any).metadata?.baseWants ?? 0))) {
                          const nextMeta = { ...(((prize as any).metadata) || {}), baseWants: next } as any;
                          await updatePrize.mutateAsync({ id: prize.id, metadata: nextMeta });
                          await refetch();
                        }
                      }}
                      className="rounded bg-black px-2 py-1"
                      placeholder="Base wants"
                    />
                  </div>
                </div>

                {/* Prize Media Gallery Editor */}
                <div className={`p-3 ${(collapsed[prize.id] ?? true) ? "hidden md:block" : ""}`}>
                  <div className="mb-2 text-sm font-semibold">Prize Media</div>
                  <MediaEditor
                    items={prize.media}
                    onChange={async (items) => {
                      await updatePrize.mutateAsync({ id: prize.id, media: items as any });
                      await refetch();
                    }}
                  />
                </div>

                <div className={`p-3 ${(collapsed[prize.id] ?? true) ? "hidden md:block" : ""}`}>
                  {/* Desktop/tablet: table view */}
                  <table className="hidden min-w-full text-sm md:table">
                    <thead className="text-white/60">
                      <tr>
                        <th className="px-2 py-2 text-left">Variant</th>
                        <th className="px-2 py-2 text-left">Button Label</th>
                        <th className="px-2 py-2 text-left">Coin Cost</th>
                        <th className="px-2 py-2 text-left">Sort</th>
                        <th className="px-2 py-2 text-left">Primary Image</th>
                        <th className="px-2 py-2 text-left">Stock</th>
                        <th className="px-2 py-2 text-left">Active</th>
                        <th className="px-2 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.variantId} className="border-t border-white/10">
                          <td className="px-2 py-2">
                            <input
                              defaultValue={v.label}
                              onBlur={async (e) => {
                                if (e.target.value !== v.label) {
                                  await updateVariant.mutateAsync({ id: v.variantId, label: e.target.value });
                                  await refetch();
                                }
                              }}
                              className="w-56 rounded bg-black px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              defaultValue={(v as any).buttonLabel ?? ""}
                              onBlur={async (e) => {
                                if (e.target.value !== ((v as any).buttonLabel ?? "")) {
                                  await updateVariant.mutateAsync({ id: v.variantId, buttonLabel: e.target.value || null });
                                  await refetch();
                                }
                              }}
                              className="w-40 rounded bg-black px-2 py-1"
                              placeholder="Button label"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              defaultValue={v.coinCost}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== v.coinCost) {
                                  await updateVariant.mutateAsync({ id: v.variantId, coinCost: val });
                                  await refetch();
                                }
                              }}
                              className="w-28 rounded bg-black px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              defaultValue={v.sortOrder}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== v.sortOrder) {
                                  await updateVariant.mutateAsync({ id: v.variantId, sortOrder: val });
                                  await refetch();
                                }
                              }}
                              className="w-24 rounded bg-black px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              defaultValue={(v as any).variantPrimaryImageUrl ?? ""}
                              onBlur={async (e) => {
                                if (e.target.value !== ((v as any).variantPrimaryImageUrl ?? "")) {
                                  await updateVariant.mutateAsync({ id: v.variantId, primaryImageUrl: e.target.value || null });
                                  await refetch();
                                }
                              }}
                              className="w-56 rounded bg-black px-2 py-1"
                              placeholder="Variant primary image URL"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                defaultValue={(v as any).claimsLimit ?? ""}
                                onBlur={async (e) => {
                                  const raw = e.target.value;
                                  const next = raw === "" ? null : Number(raw);
                                  const nextMeta = { ...((v as any).variantMetadata || {}), claimLimit: next } as any;
                                  await updateVariant.mutateAsync({ id: v.variantId, metadata: nextMeta });
                                  await refetch();
                                }}
                                className="w-24 rounded bg-black px-2 py-1"
                                placeholder="Limit"
                              />
                              <div className="text-xs text-white/60">
                                Used: {Number((v as any).claimsUsed ?? 0)}{(v as any).claimsLimit != null ? ` / ${Number((v as any).claimsLimit)}` : ""}
                                {(v as any).claimsLimit != null ? ` • Left: ${Math.max(0, Number((v as any).claimsLeft ?? 0))}` : ""}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={async () => {
                                await toggleVariantActive.mutateAsync({ id: v.variantId, active: v.variantActive ? false : true });
                                await refetch();
                              }}
                              disabled={busy}
                              className={`rounded px-2 py-1 text-xs font-semibold ${v.variantActive ? "bg-emerald-400 text-black" : "bg-gray-600 text-white"}`}
                            >
                              {v.variantActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={async () => {
                                if (!confirm("Delete variant?")) return;
                                await removeVariant.mutateAsync({ id: v.variantId });
                                await refetch();
                              }}
                              disabled={busy}
                              className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                            >
                              Delete
                            </button>
                            <div className="mt-2">
                              <div className="mb-1 text-xs text-white/60">Variant Media</div>
                              <MediaEditor
                                items={((v as any).variantMedia as any[]) ?? []}
                                onChange={async (items) => {
                                  await updateVariant.mutateAsync({ id: v.variantId, media: items as any });
                                  await refetch();
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Mobile: stacked cards */}
                  <div className="md:hidden">
                    <div className={`space-y-4 ${(collapsed[prize.id] ?? true) ? "hidden" : "block"}`}>
                      {variants.map((v) => (
                        <div key={v.variantId} className="rounded border border-white/10 bg-black/30 p-3">
                          <div className="grid grid-cols-1 gap-3">
                            <input
                              defaultValue={v.label}
                              onBlur={async (e) => {
                                if (e.target.value !== v.label) {
                                  await updateVariant.mutateAsync({ id: v.variantId, label: e.target.value });
                                  await refetch();
                                }
                              }}
                              className="rounded bg-black px-2 py-1"
                              placeholder="Variant label"
                            />
                            <input
                              defaultValue={(v as any).buttonLabel ?? ""}
                              onBlur={async (e) => {
                                if (e.target.value !== ((v as any).buttonLabel ?? "")) {
                                  await updateVariant.mutateAsync({ id: v.variantId, buttonLabel: e.target.value || null });
                                  await refetch();
                                }
                              }}
                              className="rounded bg-black px-2 py-1"
                              placeholder="Button label"
                            />
                            <input
                              type="number"
                              defaultValue={v.coinCost}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== v.coinCost) {
                                  await updateVariant.mutateAsync({ id: v.variantId, coinCost: val });
                                  await refetch();
                                }
                              }}
                              className="rounded bg-black px-2 py-1"
                              placeholder="Coin cost"
                            />
                            <input
                              type="number"
                              defaultValue={v.sortOrder}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== v.sortOrder) {
                                  await updateVariant.mutateAsync({ id: v.variantId, sortOrder: val });
                                  await refetch();
                                }
                              }}
                              className="rounded bg-black px-2 py-1"
                              placeholder="Sort order"
                            />
                            <input
                              defaultValue={(v as any).variantPrimaryImageUrl ?? ""}
                              onBlur={async (e) => {
                                if (e.target.value !== ((v as any).variantPrimaryImageUrl ?? "")) {
                                  await updateVariant.mutateAsync({ id: v.variantId, primaryImageUrl: e.target.value || null });
                                  await refetch();
                                }
                              }}
                              className="rounded bg-black px-2 py-1"
                              placeholder="Variant primary image URL"
                            />
                            {/* Mobile: Stock editor */}
                            <div className="rounded border border-white/10 bg-black/20 p-2">
                              <div className="mb-1 text-xs text-white/60">Stock</div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  defaultValue={(v as any).claimsLimit ?? ""}
                                  onBlur={async (e) => {
                                    const raw = e.target.value;
                                    const next = raw === "" ? null : Number(raw);
                                    const nextMeta = { ...((v as any).variantMetadata || {}), claimLimit: next } as any;
                                    await updateVariant.mutateAsync({ id: v.variantId, metadata: nextMeta });
                                    await refetch();
                                  }}
                                  className="w-24 rounded bg-black px-2 py-1"
                                  placeholder="Limit"
                                />
                                <div className="text-xs text-white/60">
                                  Used: {Number((v as any).claimsUsed ?? 0)}
                                  {(v as any).claimsLimit != null ? ` / ${Number((v as any).claimsLimit)} • Left: ${Math.max(0, Number((v as any).claimsLeft ?? 0))}` : ""}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  await toggleVariantActive.mutateAsync({ id: v.variantId, active: v.variantActive ? false : true });
                                  await refetch();
                                }}
                                disabled={busy}
                                className={`rounded px-2 py-1 text-xs font-semibold ${v.variantActive ? "bg-emerald-400 text-black" : "bg-gray-600 text-white"}`}
                              >
                                {v.variantActive ? "Active" : "Inactive"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm("Delete variant?")) return;
                                  await removeVariant.mutateAsync({ id: v.variantId });
                                  await refetch();
                                }}
                                disabled={busy}
                                className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>

                            <div>
                              <div className="mb-1 text-xs text-white/60">Variant Media</div>
                              <MediaEditor
                                items={((v as any).variantMedia as any[]) ?? []}
                                onChange={async (items) => {
                                  await updateVariant.mutateAsync({ id: v.variantId, media: items as any });
                                  await refetch();
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/10 p-3">
                  <button
                    className="w-full rounded border border-white/20 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                    onClick={() => toggleCollapsed(prize.id)}
                    aria-label="Toggle details"
                  >
                    {(collapsed[prize.id] ?? true) ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// Simple inline media editor for arrays of {type, url, alt, sortOrder}
function MediaEditor({
  items,
  onChange,
}: {
  items: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>;
  onChange: (items: Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>) => void | Promise<void>;
}) {
  const [local, setLocal] = useState(items ?? []);

  // keep in sync when parent changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setLocal(items ?? []), [JSON.stringify(items ?? [])]);

  const updateItem = (idx: number, patch: Partial<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>) => {
    setLocal((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setLocal((prev) => prev.filter((_, i) => i !== idx));
  const addItem = () => setLocal((prev) => [...prev, { type: "image", url: "", alt: "", sortOrder: (prev.at(-1)?.sortOrder ?? 0) + 1 }]);

  const save = async () => {
    await onChange(local);
  };

  return (
    <div className="rounded border border-white/10 bg-black/30 p-2">
      <div className="space-y-3">
        {local.map((it, idx) => (
          <div key={idx} className="rounded border border-white/10 p-2">
            <div className="mb-2 flex items-center gap-3">
              <div className="relative h-14 w-20 overflow-hidden rounded bg-black/50">
                {it.type === "image" && it.url ? (
                  <Image src={it.url} alt={it.alt ?? "media"} fill className="object-cover" />
                ) : it.type === "video" && it.url ? (
                  <video src={it.url} className="h-full w-full object-cover" muted />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-white/40">No media</div>
                )}
              </div>
              <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-6">
                <select
                  value={it.type}
                  onChange={(e) => updateItem(idx, { type: e.target.value as any })}
                  className="rounded bg-black px-2 py-1"
                >
                  <option value="image">image</option>
                  <option value="video">video</option>
                </select>
                <input
                  value={it.url}
                  onChange={(e) => updateItem(idx, { url: e.target.value })}
                  placeholder="URL"
                  className="rounded bg-black px-2 py-1 md:col-span-3"
                />
                <input
                  value={it.alt ?? ""}
                  onChange={(e) => updateItem(idx, { alt: e.target.value })}
                  placeholder="Alt (optional)"
                  className="rounded bg-black px-2 py-1"
                />
                <input
                  type="number"
                  value={it.sortOrder ?? 0}
                  onChange={(e) => updateItem(idx, { sortOrder: Number(e.target.value) })}
                  placeholder="Sort"
                  className="rounded bg-black px-2 py-1"
                />
                <button onClick={() => removeItem(idx)} className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-400">
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={addItem} className="rounded bg-white px-3 py-1.5 text-black hover:bg-white/90">
          Add Media
        </button>
        <button onClick={save} className="rounded bg-emerald-400 px-3 py-1.5 font-semibold text-black hover:bg-emerald-300">
          Save
        </button>
      </div>
    </div>
  );
}
