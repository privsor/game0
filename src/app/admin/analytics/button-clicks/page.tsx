import { HydrateClient, api } from "~/trpc/server";
import AdminButtonClicksClient from "./_components/AdminButtonClicksClient";

export default async function AdminButtonClicksPage() {
	await api.analytics.listButtonClicks.prefetch({
		event: "daddymode_view_more_prizes_click",
		limit: 200,
	});
	return (
		<HydrateClient>
			<AdminButtonClicksClient />
		</HydrateClient>
	);
}
