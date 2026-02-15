import { z } from "zod";
import { desc, eq } from "drizzle-orm";

import { createTRPCRouter, publicProcedure, adminProcedure } from "~/server/api/trpc";
import { buttonClicks } from "~/server/db/schema";

function readHeader(headers: Headers, key: string): string | null {
	return headers.get(key) ?? headers.get(key.toLowerCase()) ?? headers.get(key.toUpperCase());
}

function normalizeCountry(v: string | null | undefined): string | null {
	if (!v) return null;
	const t = v.trim();
	if (!t) return null;
	if (t.toLowerCase() === "xx") return null;
	return t.toUpperCase();
}

function getGeoFromHeaders(headers: Headers): {
	country: string | null;
	region: string | null;
	city: string | null;
	timezone: string | null;
} {
	// Vercel
	const vercelCountry = normalizeCountry(readHeader(headers, "x-vercel-ip-country"));
	const vercelRegion = readHeader(headers, "x-vercel-ip-country-region")?.trim() || null;
	const vercelCity = readHeader(headers, "x-vercel-ip-city")?.trim() || null;
	const vercelTimezone = readHeader(headers, "x-vercel-ip-timezone")?.trim() || null;

	// Cloudflare
	const cfCountry = normalizeCountry(readHeader(headers, "cf-ipcountry"));
	const cfRegion = readHeader(headers, "cf-region")?.trim() || null;
	const cfCity = readHeader(headers, "cf-ipcity")?.trim() || null;
	const cfTimezone = readHeader(headers, "cf-timezone")?.trim() || null;

	return {
		country: vercelCountry ?? cfCountry ?? null,
		region: vercelRegion ?? cfRegion ?? null,
		city: vercelCity ?? cfCity ?? null,
		timezone: vercelTimezone ?? cfTimezone ?? null,
	};
}

export const analyticsRouter = createTRPCRouter({
	trackButtonClick: publicProcedure
		.input(
			z.object({
				event: z.string().min(1).max(128),
				source: z.string().min(1).max(64).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const geo = getGeoFromHeaders(ctx.headers);
			await ctx.db.insert(buttonClicks).values({
				event: input.event,
				source: input.source ?? null,
				userId: ctx.session?.user?.id ?? null,
				country: geo.country,
				region: geo.region,
				city: geo.city,
				timezone: geo.timezone,
			});
			return { ok: true };
		}),

	listButtonClicks: adminProcedure
		.input(
			z.object({
				event: z.string().min(1).max(128).optional(),
				limit: z.number().int().min(1).max(500).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const limit = input.limit ?? 200;
			if (input.event) {
				return ctx.db
					.select()
					.from(buttonClicks)
					.where(eq(buttonClicks.event, input.event))
					.orderBy(desc(buttonClicks.createdAt))
					.limit(limit);
			}
			return ctx.db.select().from(buttonClicks).orderBy(desc(buttonClicks.createdAt)).limit(limit);
		}),
});
