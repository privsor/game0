import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { gifts, purchases } from "~/server/db/schema";

export const giftsRouter = createTRPCRouter({
  listActive: publicProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select()
      .from(gifts)
      .where(eq(gifts.active, 1))
      .orderBy(asc(gifts.coinCost))
      .limit(100);
    return items;
  }),

  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await ctx.db
      .select()
      .from(purchases)
      .where(eq(purchases.userId, userId))
      .orderBy(desc(purchases.createdAt))
      .limit(100);
    return rows;
  }),

  // Simple admin-only add gift (placeholder). Replace with a proper admin check in future.
  add: protectedProcedure
    .input(z.object({
      title: z.string().min(3),
      imageUrl: z.string().url().optional(),
      coinCost: z.number().int().positive(),
      vendor: z.string().default("amazon"),
      voucherAmount: z.number().int().optional(),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // naive check: restrict by email for now if needed
      const isAllowed = true; // TODO: integrate real admin role
      if (!isAllowed) throw new Error("Not authorized to add gifts");

      const inserted = await ctx.db
        .insert(gifts)
        .values({
          title: input.title,
          imageUrl: input.imageUrl,
          coinCost: input.coinCost,
          vendor: input.vendor,
          voucherAmount: input.voucherAmount,
          active: input.active ? 1 : 0,
        })
        .returning();

      return inserted[0];
    }),
});
