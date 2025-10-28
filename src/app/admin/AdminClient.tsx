"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">{children}</div>
    </section>
  );
}

export default function AdminClient() {
  // Gifts
  const giftsQuery = api.admin.listGifts.useQuery(undefined, { retry: false });
  const createGift = api.admin.createGift.useMutation();
  const toggleGift = api.admin.setGiftActive.useMutation();
  const deleteGift = api.admin.deleteGift.useMutation();

  // Coin packages
  const [pkgCurrency, setPkgCurrency] = useState<"INR" | "GBP">("INR");
  const coinPkgsQuery = api.admin.listCoinPackages.useQuery({ currency: pkgCurrency }, { retry: false });
  const upsertPkg = api.admin.upsertCoinPackage.useMutation();
  const deletePkg = api.admin.deleteCoinPackage.useMutation();

  const [giftForm, setGiftForm] = useState({ title: "", imageUrl: "", coinCost: 100, vendor: "amazon", voucherAmount: 0, active: true });
  const [pkgForm, setPkgForm] = useState({ id: undefined as number | undefined, currency: "INR" as "INR" | "GBP", coins: 10, amountMinor: 100, active: true });

  useEffect(() => {
    setPkgForm((f) => ({ ...f, currency: pkgCurrency }));
  }, [pkgCurrency]);

  const isNotAdmin = giftsQuery.isError || coinPkgsQuery.isError;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Admin</h1>
      {isNotAdmin ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">You are not an admin.</div>
      ) : (
        <div className="space-y-8">
          <Section title="Gifts">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <table className="w-full text-sm">
                  <thead className="text-white/60">
                    <tr>
                      <th className="py-2 text-left">ID</th>
                      <th className="py-2 text-left">Title</th>
                      <th className="py-2 text-left">Coins</th>
                      <th className="py-2 text-left">Active</th>
                      <th className="py-2 text-left" />
                    </tr>
                  </thead>
                  <tbody>
                    {(giftsQuery.data ?? []).map((g) => (
                      <tr key={g.id} className="border-t border-white/10">
                        <td className="py-2">{g.id}</td>
                        <td className="py-2">{g.title}</td>
                        <td className="py-2">{g.coinCost}</td>
                        <td className="py-2">{g.active === 1 ? "Yes" : "No"}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={async () => {
                              await toggleGift.mutateAsync({ id: g.id as number, active: g.active !== 1 });
                              await giftsQuery.refetch();
                            }}
                            className="mr-2 rounded bg-white/20 px-2 py-1 text-xs"
                          >
                            Toggle
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete gift?")) return;
                              await deleteGift.mutateAsync({ id: g.id as number });
                              await giftsQuery.refetch();
                            }}
                            className="rounded bg-red-500/80 px-2 py-1 text-xs text-white"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Create Gift</h3>
                <div className="space-y-2">
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Title" value={giftForm.title} onChange={(e) => setGiftForm({ ...giftForm, title: e.target.value })} />
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Image URL" value={giftForm.imageUrl} onChange={(e) => setGiftForm({ ...giftForm, imageUrl: e.target.value })} />
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Coin Cost" type="number" value={giftForm.coinCost} onChange={(e) => setGiftForm({ ...giftForm, coinCost: Number(e.target.value) })} />
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Vendor" value={giftForm.vendor} onChange={(e) => setGiftForm({ ...giftForm, vendor: e.target.value })} />
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Voucher Amount (optional)" type="number" value={giftForm.voucherAmount} onChange={(e) => setGiftForm({ ...giftForm, voucherAmount: Number(e.target.value) })} />
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" checked={giftForm.active} onChange={(e) => setGiftForm({ ...giftForm, active: e.target.checked })} /> Active
                  </label>
                  <button
                    onClick={async () => {
                      await createGift.mutateAsync(giftForm as any);
                      setGiftForm({ title: "", imageUrl: "", coinCost: 100, vendor: "amazon", voucherAmount: 0, active: true });
                      await giftsQuery.refetch();
                    }}
                    className="w-full rounded bg-white px-3 py-2 text-black"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Coin Packages">
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-white/60">Currency</label>
              <select className="rounded bg-black px-2 py-1" value={pkgCurrency} onChange={(e) => setPkgCurrency(e.target.value as any)}>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <table className="w-full text-sm">
                  <thead className="text-white/60">
                    <tr>
                      <th className="py-2 text-left">ID</th>
                      <th className="py-2 text-left">Coins</th>
                      <th className="py-2 text-left">Amount (minor)</th>
                      <th className="py-2 text-left">Active</th>
                      <th className="py-2 text-left" />
                    </tr>
                  </thead>
                  <tbody>
                    {(coinPkgsQuery.data ?? []).map((p) => (
                      <tr key={p.id} className="border-t border-white/10">
                        <td className="py-2">{p.id}</td>
                        <td className="py-2">{p.coins}</td>
                        <td className="py-2">{p.amountMinor}</td>
                        <td className="py-2">{p.active === 1 ? "Yes" : "No"}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => setPkgForm({ id: p.id as number, currency: pkgCurrency, coins: p.coins as number, amountMinor: p.amountMinor as number, active: p.active === 1 })}
                            className="rounded bg-white/20 px-2 py-1 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete package?")) return;
                              await deletePkg.mutateAsync({ id: p.id as number });
                              await coinPkgsQuery.refetch();
                            }}
                            className="ml-2 rounded bg-red-500/80 px-2 py-1 text-xs"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">{pkgForm.id ? "Update Package" : "Create Package"}</h3>
                <div className="space-y-2">
                  <div className="text-sm text-white/70">Currency: {pkgForm.currency}</div>
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Coins" type="number" value={pkgForm.coins} onChange={(e) => setPkgForm({ ...pkgForm, coins: Number(e.target.value) })} />
                  <input className="w-full rounded bg-black/50 px-2 py-1" placeholder="Amount (minor units)" type="number" value={pkgForm.amountMinor} onChange={(e) => setPkgForm({ ...pkgForm, amountMinor: Number(e.target.value) })} />
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" checked={pkgForm.active} onChange={(e) => setPkgForm({ ...pkgForm, active: e.target.checked })} /> Active
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await upsertPkg.mutateAsync(pkgForm as any);
                        setPkgForm({ id: undefined, currency: pkgCurrency, coins: 10, amountMinor: 100, active: true });
                        await coinPkgsQuery.refetch();
                      }}
                      className="flex-1 rounded bg-white px-3 py-2 text-black"
                    >
                      {pkgForm.id ? "Update" : "Create"}
                    </button>
                    {pkgForm.id && (
                      <button
                        onClick={() => setPkgForm({ id: undefined, currency: pkgCurrency, coins: 10, amountMinor: 100, active: true })}
                        className="rounded bg-white/20 px-3 py-2"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}
    </main>
  );
}
