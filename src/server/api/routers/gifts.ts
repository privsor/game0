import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, publicProcedure, adminProcedure } from "~/server/api/trpc";
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
  add: adminProcedure
    .input(z.object({
      title: z.string().min(3),
      imageUrl: z.string().url().optional(),
      videoUrl: z.string().url().optional(),
      coinCost: z.number().int().positive(),
      vendor: z.string().default("amazon"),
      voucherAmount: z.number().int().optional(),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {

      const inserted = await ctx.db
        .insert(gifts)
        .values({
          title: input.title,
          imageUrl: input.imageUrl,
          videoUrl: input.videoUrl,
          coinCost: input.coinCost,
          vendor: input.vendor,
          voucherAmount: input.voucherAmount,
          active: input.active ? 1 : 0,
        })
        .returning();

      return inserted[0];
    }),

  // Admin: list all gifts (active & inactive)
  listAll: adminProcedure.query(async ({ ctx }) => {

    const rows = await ctx.db
      .select()
      .from(gifts)
      .orderBy(desc(gifts.createdAt))
      .limit(200);
    return rows;
  }),

  // Admin: update gift fields
  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(3).optional(),
      imageUrl: z.string().url().optional().nullable(),
      videoUrl: z.string().url().optional().nullable(),
      coinCost: z.number().int().positive().optional(),
      vendor: z.string().optional(),
      voucherAmount: z.number().int().optional().nullable(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {

      const { id, ...rest } = input;
      // Map boolean active to integer if provided
      const payload: any = { ...rest };
      if (typeof rest.active === "boolean") {
        payload.active = rest.active ? 1 : 0;
      }

      const updated = await ctx.db
        .update(gifts)
        .set(payload)
        .where(eq(gifts.id, id))
        .returning();
      return updated[0];
    }),

  // Admin: toggle active
  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db
        .update(gifts)
        .set({ active: input.active ? 1 : 0 })
        .where(eq(gifts.id, input.id))
        .returning();
      return updated[0];
    }),

  // Admin: remove gift
  remove: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(gifts)
        .where(eq(gifts.id, input.id))
        .returning();
      return deleted[0];
    }),
});
