import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isAdminEmail } from "~/server/auth/admin";
import { gifts, coinPackages } from "~/server/db/schema";

function requireAdmin<T>(fn: (args: T) => Promise<any>) {
  return async (args: T & { ctx: any }) => {
    const email = args.ctx.session.user.email as string | undefined;
    if (!isAdminEmail(email)) {
      throw new Error("NOT_ADMIN");
    }
    return fn(args);
  };
}

export const adminRouter = createTRPCRouter({
  // Gifts
  listGifts: protectedProcedure.query(async ({ ctx }) => {
    if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
    const rows = await ctx.db.select().from(gifts).orderBy(gifts.id);
    return rows;
  }),

  createGift: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3),
        imageUrl: z.string().url().optional(),
        coinCost: z.number().int().positive(),
        vendor: z.string().default("amazon"),
        voucherAmount: z.number().int().optional(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
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

  setGiftActive: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
      await ctx.db
        .update(gifts)
        .set({ active: input.active ? 1 : 0 })
        .where(eq(gifts.id, input.id));
      return { ok: true } as const;
    }),

  deleteGift: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
      await ctx.db.delete(gifts).where(eq(gifts.id, input.id));
      return { ok: true } as const;
    }),

  // Coin Packages
  listCoinPackages: protectedProcedure
    .input(z.object({ currency: z.enum(["INR", "GBP"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
      if (input?.currency) {
        return ctx.db
          .select()
          .from(coinPackages)
          .where(eq(coinPackages.currency, input.currency))
          .orderBy(coinPackages.coins);
      }
      return ctx.db.select().from(coinPackages).orderBy(coinPackages.currency, coinPackages.coins);
    }),

  upsertCoinPackage: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        currency: z.enum(["INR", "GBP"]),
        coins: z.number().int().positive(),
        amountMinor: z.number().int().positive(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
      if (input.id) {
        await ctx.db
          .update(coinPackages)
          .set({
            currency: input.currency,
            coins: input.coins,
            amountMinor: input.amountMinor,
            active: input.active ? 1 : 0,
          })
          .where(eq(coinPackages.id, input.id));
        return { ok: true } as const;
      }
      const inserted = await ctx.db
        .insert(coinPackages)
        .values({
          currency: input.currency,
          coins: input.coins,
          amountMinor: input.amountMinor,
          active: input.active ? 1 : 0,
        })
        .returning();
      return inserted[0];
    }),

  deleteCoinPackage: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdminEmail(ctx.session.user.email)) throw new Error("NOT_ADMIN");
      await ctx.db.delete(coinPackages).where(eq(coinPackages.id, input.id));
      return { ok: true } as const;
    }),
});
