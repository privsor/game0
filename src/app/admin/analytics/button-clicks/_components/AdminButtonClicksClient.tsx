"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";

function formatTime(v: unknown): string {
	try {
		const d = v instanceof Date ? v : new Date(String(v));
		if (Number.isNaN(d.getTime())) return "-";
		return d.toLocaleString();
	} catch {
		return "-";
	}
}

export default function AdminButtonClicksClient() {
	const { data, isLoading, refetch } = api.analytics.listButtonClicks.useQuery({
		event: "daddymode_view_more_prizes_click",
		limit: 200,
	});

	const rows = useMemo(() => {
		return (data ?? []).map((r) => ({
			id: (r as any).id as number,
			createdAt: (r as any).createdAt,
			country: ((r as any).country as string | null) ?? null,
			region: ((r as any).region as string | null) ?? null,
			city: ((r as any).city as string | null) ?? null,
			timezone: ((r as any).timezone as string | null) ?? null,
			userId: ((r as any).userId as string | null) ?? null,
			source: ((r as any).source as string | null) ?? null,
		}));
	}, [data]);

	return (
		<main className="mx-auto max-w-6xl px-4 py-8">
			<div className="mb-6 flex items-center justify-between gap-3">
				<h1 className="text-2xl font-extrabold">Admin: Button Clicks</h1>
				<button
					type="button"
					onClick={() => refetch()}
					className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
				>
					Refresh
				</button>
			</div>

			<div className="rounded-lg border border-white/10 bg-white/5 p-4">
				<div className="mb-3 text-sm text-white/70">
					Event: <span className="font-mono text-white">daddymode_view_more_prizes_click</span>
				</div>

				{isLoading ? (
					<div>Loading…</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="text-white/60">
								<tr>
									<th className="px-2 py-2 text-left">Time</th>
									<th className="px-2 py-2 text-left">Location</th>
									<th className="px-2 py-2 text-left">Timezone</th>
									<th className="px-2 py-2 text-left">User</th>
									<th className="px-2 py-2 text-left">Source</th>
								</tr>
							</thead>
							<tbody>
								{rows.length === 0 ? (
									<tr>
										<td className="px-2 py-3 text-white/60" colSpan={5}>
											No events yet.
										</td>
									</tr>
								) : (
									rows.map((r) => (
										<tr key={r.id} className="border-t border-white/10">
											<td className="px-2 py-2 whitespace-nowrap">{formatTime(r.createdAt)}</td>
											<td className="px-2 py-2">
												{[r.city, r.region, r.country].filter(Boolean).join(", ") || "-"}
											</td>
											<td className="px-2 py-2">{r.timezone || "-"}</td>
											<td className="px-2 py-2">{r.userId || "anon"}</td>
											<td className="px-2 py-2">{r.source || "-"}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</main>
	);
}
