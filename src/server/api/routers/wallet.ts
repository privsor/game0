import { z } from "zod";
import { desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  wallets,
  walletTransactions,
  gifts,
  purchases,
  prizeVariants,
  prizes,
} from "~/server/db/schema";
import { publishWalletUpdate } from "~/server/lib/ablyServer";

export const walletRouter = createTRPCRouter({
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

      const newBalance = await ctx.db.transaction(async (tx) => {
        const current = (
          await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1)
        )[0];

        const nextBalance = (current?.balance ?? 0) + input.amount;

        if (!current) {
          await tx.insert(wallets).values({ userId, balance: nextBalance });
        } else {
          await tx
            .update(wallets)
            .set({ balance: nextBalance })
            .where(eq(wallets.userId, userId));
        }

        await tx.insert(walletTransactions).values({
          userId,
          amount: input.amount,
          type: "earn",
          reason: input.reason ?? "game_win",
          createdAt: ctx.now as any,
        });

        return nextBalance;
      });

      // Fire-and-forget Ably publish (do not block mutation)
      publishWalletUpdate(userId, {
        balance: newBalance,
        delta: input.amount,
        reason: input.reason ?? "game_win",
      }).catch(() => {});

      return { ok: true } as const;
    }),

  purchase: protectedProcedure
    .input(
      z.union([
        z.object({ prizeVariantId: z.number().int().positive(), giftId: z.never().optional() }),
        z.object({ giftId: z.number().int().positive(), prizeVariantId: z.never().optional() }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db.transaction(async (tx) => {
        // Load wallet and target purchasable
        const [wallet] = await Promise.all([
          tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1)
            .then((r) => r[0]),
        ]);

        let coinCost = 0;
        let purchaseGiftId: number | null = null;
        let purchaseVariantId: number | null = null;

        if ("prizeVariantId" in input && typeof (input as any).prizeVariantId === "number") {
          const variantId = (input as any).prizeVariantId as number;
          // Prize variant flow
          const variant = await tx
            .select({
              id: prizeVariants.id,
              coinCost: prizeVariants.coinCost,
              active: prizeVariants.active,
              prizeActive: prizes.active,
              prizeId: prizeVariants.prizeId,
            })
            .from(prizeVariants)
            .innerJoin(prizes, eq(prizes.id, prizeVariants.prizeId))
            .where(eq(prizeVariants.id, variantId))
            .limit(1)
            .then((r) => r[0]);
          if (!variant || variant.active !== 1 || variant.prizeActive !== 1) throw new Error("Prize variant not available");
          coinCost = variant.coinCost;
          purchaseVariantId = variant.id as unknown as number;
          purchaseGiftId = null; // legacy gift not used in this path
        } else {
          // Legacy gift flow
          const gift = await tx
            .select()
            .from(gifts)
            .where(eq(gifts.id, (input as any).giftId))
            .limit(1)
            .then((r) => r[0]);
          if (!gift || gift.active !== 1) throw new Error("Gift not available");
          coinCost = gift.coinCost;
          purchaseGiftId = gift.id as number;
        }

        const balance = wallet?.balance ?? 0;
        if (balance < coinCost) throw new Error("Insufficient Daddy Coins");

        const newBalance = balance - coinCost;

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
          amount: -coinCost,
          type: "spend",
          reason: purchaseVariantId ? `purchase:v${purchaseVariantId}` : `purchase:g${purchaseGiftId}`,
          createdAt: ctx.now as any,
        });

        // Generate a simple redemption code (in real app, integrate provider)
        const redemptionCode = `DADDY-${purchaseVariantId ?? purchaseGiftId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const [purchase] = await tx
          .insert(purchases)
          .values({ userId, giftId: purchaseGiftId as any, prizeVariantId: purchaseVariantId as any, redemptionCode, createdAt: ctx.now as any })
          .returning();
        if (!purchase) throw new Error("Failed to record purchase");

        return { newBalance, purchase } as const;
      });

      // Notify client(s) about updated balance via Ably
      publishWalletUpdate(userId, {
        balance: result.newBalance,
        reason: result.purchase.prizeVariantId ? `purchase:v${result.purchase.prizeVariantId}` : `purchase:g${result.purchase.giftId}`,
      }).catch(() => {});

      return result;
    }),
});
