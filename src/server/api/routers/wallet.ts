import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import {
  wallets,
  walletTransactions,
  gifts,
  purchases,
  coinPackages,
} from "~/server/db/schema";

export const walletRouter = createTRPCRouter({
  listCoinPackages: publicProcedure
    .input(z.object({ currency: z.enum(["INR", "GBP"]) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(coinPackages)
        .where(eq(coinPackages.currency, input.currency))
        .orderBy(asc(coinPackages.coins));
      return rows.filter((r) => r.active === 1);
    }),
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Ensure wallet exists
    const existing = (
      await ctx.db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1)
    )[0];

    if (!existing) {
      await ctx.db.insert(wallets).values({ userId, balance: 0 });
      return { balance: 0 } as const;
    }

    return { balance: existing.balance } as const;
  }),

  getTransactions: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const txns = await ctx.db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);
    return txns;
  }),

  // Temporary helper to add coins (e.g., after a game win)
  earn: protectedProcedure
    .input(z.object({ amount: z.number().int().positive(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      await ctx.db.transaction(async (tx) => {
        const current = (
          await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1)
        )[0];

        const newBalance = (current?.balance ?? 0) + input.amount;

        if (!current) {
          await tx.insert(wallets).values({ userId, balance: newBalance });
        } else {
          await tx
            .update(wallets)
            .set({ balance: newBalance })
            .where(eq(wallets.userId, userId));
        }

        await tx.insert(walletTransactions).values({
          userId,
          amount: input.amount,
          type: "earn",
          reason: input.reason ?? "game_win",
        });
      });

      return { ok: true } as const;
    }),

  purchase: protectedProcedure
    .input(z.object({ giftId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db.transaction(async (tx) => {
        // Load wallet & gift
        const [wallet, gift] = await Promise.all([
          tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1)
            .then((r) => r[0]),
          tx
            .select()
            .from(gifts)
            .where(eq(gifts.id, input.giftId))
            .limit(1)
            .then((r) => r[0]),
        ]);

        if (!gift || gift.active !== 1) throw new Error("Gift not available");

        const balance = wallet?.balance ?? 0;
        if (balance < gift.coinCost) throw new Error("Insufficient Daddy Coins");

        const newBalance = balance - gift.coinCost;

        if (!wallet) {
          await tx.insert(wallets).values({ userId, balance: newBalance });
        } else {
          await tx
            .update(wallets)
            .set({ balance: newBalance })
            .where(eq(wallets.userId, userId));
        }

        await tx.insert(walletTransactions).values({
          userId,
          amount: -gift.coinCost,
          type: "spend",
          reason: `purchase:g${gift.id}`,
        });

        // Generate a simple redemption code (in real app, integrate provider)
        const redemptionCode = `DADDY-${gift.id}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const inserted = await tx
          .insert(purchases)
          .values({ userId, giftId: gift.id, redemptionCode })
          .returning();

        return { newBalance, purchase: inserted[0] } as const;
      });

      return result;
    }),
});
