import { and, asc, desc, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { prizeVariants, prizes, prizeWants, prizeComments, purchases, users } from "~/server/db/schema";

// Helper to coalesce media fields
const coalesceExpr = (primary: any, fallback: any) => sql`${primary} IS NOT NULL AND ${primary} <> '' ? ${primary} : ${fallback}`;

export const prizesRouter = createTRPCRouter({
  // Public: flattened variants list for the shop grid
  listActiveVariants: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: prizeVariants.id, // expose variant id as id for simplicity
        prizeId: prizeVariants.prizeId,
        title: prizes.title,
        label: prizeVariants.label,
        buttonLabel: prizeVariants.buttonLabel,
        coinCost: prizeVariants.coinCost,
        vendor: prizes.vendor,
        vendorLogo: prizes.vendorLogo,
        // Prefer variant primary image, fallback to prize primary, then old single image
        imageUrl: sql<string>`COALESCE(${prizeVariants.primaryImageUrl}, ${prizes.primaryImageUrl}, ${prizes.imageUrl})`,
        // Prefer first video from media if present later; for now just fallback to prize.videoUrl
        videoUrl: prizes.videoUrl,
        // Return media blobs too if the client needs galleries
        variantMedia: prizeVariants.media,
        prizeMedia: prizes.media,
      })
      .from(prizeVariants)
      .innerJoin(prizes, eq(prizes.id, prizeVariants.prizeId))
      .where(and(eq(prizes.active, 1), eq(prizeVariants.active, 1)))
      .orderBy(asc(prizeVariants.sortOrder), asc(prizeVariants.coinCost))
      .limit(200);

    return rows;
  }),

  // Public: grouped prizes with nested active variants
  listGrouped: publicProcedure.query(async ({ ctx }) => {
    const prizesRows = await ctx.db
      .select({
        id: prizes.id,
        title: prizes.title,
        description: prizes.description,
        vendor: prizes.vendor,
        vendorLogo: prizes.vendorLogo,
        primaryImageUrl: prizes.primaryImageUrl,
        imageUrl: prizes.imageUrl,
        videoUrl: prizes.videoUrl,
        media: prizes.media,
      })
      .from(prizes)
      .where(eq(prizes.active, 1))
      .orderBy(asc(prizes.id))
      .limit(200);

    if (prizesRows.length === 0) return [] as any[];

    const prizeIds = prizesRows.map((p) => p.id);
    const variantsRows = await ctx.db
      .select({
        id: prizeVariants.id,
        prizeId: prizeVariants.prizeId,
        label: prizeVariants.label,
        buttonLabel: prizeVariants.buttonLabel,
        coinCost: prizeVariants.coinCost,
        active: prizeVariants.active,
        sortOrder: prizeVariants.sortOrder,
        primaryImageUrl: prizeVariants.primaryImageUrl,
        media: prizeVariants.media,
      })
      .from(prizeVariants)
      .where(and(eq(prizeVariants.active, 1), inArray(prizeVariants.prizeId, prizeIds)))
      .orderBy(asc(prizeVariants.prizeId), asc(prizeVariants.sortOrder), asc(prizeVariants.coinCost));

    const grouped = prizesRows.map((p) => ({
      ...p,
      sponsor: p.vendor, // alias for UI; we can rename later in schema
      sponsorLogo: p.vendorLogo,
      variants: variantsRows.filter((v) => v.prizeId === p.id).map((v) => ({
        ...v,
        imageUrl: v.primaryImageUrl ?? p.primaryImageUrl ?? p.imageUrl,
        videoUrl: p.videoUrl, // simple fallback for now
      })),
    }));

    return grouped;
  }),

  // Admin: list all prizes with variants (include prizes without variants)
  listAll: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        prizeId: prizes.id,
        prizeTitle: prizes.title,
        prizeActive: prizes.active,
        prizeVendor: prizes.vendor,
        prizeVendorLogo: prizes.vendorLogo,
        prizePrimaryImageUrl: prizes.primaryImageUrl,
        prizeMedia: prizes.media,
        variantId: prizeVariants.id,
        label: prizeVariants.label,
        buttonLabel: prizeVariants.buttonLabel,
        coinCost: prizeVariants.coinCost,
        variantActive: prizeVariants.active,
        sortOrder: prizeVariants.sortOrder,
        variantPrimaryImageUrl: prizeVariants.primaryImageUrl,
        variantMedia: prizeVariants.media,
      })
      .from(prizes)
      .leftJoin(prizeVariants, eq(prizes.id, prizeVariants.prizeId))
      .orderBy(desc(prizes.createdAt), asc(prizeVariants.sortOrder));
    return rows;
  }),

  // Admin: create prize
  createPrize: adminProcedure
    .input(z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      vendor: z.string().default("generic").optional(),
      vendorLogo: z.string().url().optional(),
      primaryImageUrl: z.string().url().optional(),
      imageUrl: z.string().url().optional(),
      videoUrl: z.string().url().optional(),
      active: z.boolean().default(true).optional(),
      metadata: z.any().optional(),
      media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url(), alt: z.string().optional(), sortOrder: z.number().int().optional() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(prizes).values({
        title: input.title,
        description: input.description,
        vendor: input.vendor ?? "generic",
        vendorLogo: input.vendorLogo,
        primaryImageUrl: input.primaryImageUrl,
        imageUrl: input.imageUrl,
        videoUrl: input.videoUrl,
        active: input.active ? 1 : 0,
        metadata: input.metadata as any,
        media: input.media as any,
      }).returning();
      return row;
    }),

  // Admin: create variant
  createVariant: adminProcedure
    .input(z.object({
      prizeId: z.number().int().positive(),
      label: z.string().min(1),
      buttonLabel: z.string().max(64).optional(),
      coinCost: z.number().int().positive(),
      sku: z.string().optional(),
      sortOrder: z.number().int().optional(),
      active: z.boolean().default(true).optional(),
      primaryImageUrl: z.string().url().optional(),
      media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url(), alt: z.string().optional(), sortOrder: z.number().int().optional() })).optional(),
      metadata: z.any().optional(),
      fulfillmentType: z.string().optional(),
      fulfillmentConfig: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(prizeVariants).values({
        prizeId: input.prizeId,
        label: input.label,
        buttonLabel: input.buttonLabel,
        coinCost: input.coinCost,
        sku: input.sku,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ? 1 : 0,
        primaryImageUrl: input.primaryImageUrl,
        media: input.media as any,
        metadata: input.metadata as any,
        fulfillmentType: input.fulfillmentType,
        fulfillmentConfig: input.fulfillmentConfig as any,
      }).returning();
      return row;
    }),

  // Admin: update prize
  updatePrize: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().optional(),
      description: z.string().optional().nullable(),
      vendor: z.string().optional(),
      vendorLogo: z.string().url().optional().nullable(),
      primaryImageUrl: z.string().url().optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      videoUrl: z.string().url().optional().nullable(),
      active: z.boolean().optional(),
      metadata: z.any().optional(),
      media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url(), alt: z.string().optional(), sortOrder: z.number().int().optional() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input as any;
      const payload: any = { ...rest };
      if (typeof rest.active === "boolean") payload.active = rest.active ? 1 : 0;
      const [row] = await ctx.db.update(prizes).set(payload).where(eq(prizes.id, id)).returning();
      return row;
    }),

  // Admin: update variant
  updateVariant: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      label: z.string().optional(),
      buttonLabel: z.string().max(64).optional().nullable(),
      coinCost: z.number().int().positive().optional(),
      sku: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
      active: z.boolean().optional(),
      primaryImageUrl: z.string().url().optional().nullable(),
      media: z.array(z.object({ type: z.enum(["image", "video"]), url: z.string().url(), alt: z.string().optional(), sortOrder: z.number().int().optional() })).optional(),
      metadata: z.any().optional(),
      fulfillmentType: z.string().optional().nullable(),
      fulfillmentConfig: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input as any;
      const payload: any = { ...rest };
      if (typeof rest.active === "boolean") payload.active = rest.active ? 1 : 0;
      const [row] = await ctx.db.update(prizeVariants).set(payload).where(eq(prizeVariants.id, id)).returning();
      return row;
    }),

  // Interaction APIs
  getInteraction: publicProcedure
    .input(z.object({ prizeId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const wantRow = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(prizeWants)
        .where(eq(prizeWants.prizeId, input.prizeId));
      const commentsRow = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(prizeComments)
        .where(eq(prizeComments.prizeId, input.prizeId));
      const winnersRow = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(purchases)
        .innerJoin(prizeVariants, eq(purchases.prizeVariantId, prizeVariants.id))
        .where(eq(prizeVariants.prizeId, input.prizeId));
      const wantCount = Number(wantRow[0]?.count ?? 0);
      const commentsCount = Number(commentsRow[0]?.count ?? 0);
      const winnersCount = Number(winnersRow[0]?.count ?? 0);

      // recent interactors (avatars)
      const recentWanters = await ctx.db
        .select({ userId: prizeWants.userId, image: users.image, name: users.name })
        .from(prizeWants)
        .innerJoin(users, eq(users.id, prizeWants.userId))
        .where(eq(prizeWants.prizeId, input.prizeId))
        .orderBy(desc(prizeWants.createdAt))
        .limit(5);
      const recentCommenters = await ctx.db
        .select({ userId: prizeComments.userId, image: users.image, name: users.name })
        .from(prizeComments)
        .innerJoin(users, eq(users.id, prizeComments.userId))
        .where(eq(prizeComments.prizeId, input.prizeId))
        .orderBy(desc(prizeComments.createdAt))
        .limit(5);
      const recentWinners = await ctx.db
        .select({ userId: purchases.userId, image: users.image, name: users.name })
        .from(purchases)
        .innerJoin(users, eq(users.id, purchases.userId))
        .innerJoin(prizeVariants, eq(purchases.prizeVariantId, prizeVariants.id))
        .where(eq(prizeVariants.prizeId, input.prizeId))
        .orderBy(desc(purchases.createdAt))
        .limit(5);
      let wantedByMe = false;
      if (ctx.session?.user?.id) {
        const me = await ctx.db
          .select({ userId: prizeWants.userId })
          .from(prizeWants)
          .where(and(eq(prizeWants.prizeId, input.prizeId), eq(prizeWants.userId, ctx.session.user.id)))
          .limit(1);
        wantedByMe = me.length > 0;
      }
      return {
        want: wantCount,
        comments: commentsCount,
        winners: winnersCount,
        wantedByMe,
        recentWanters,
        recentCommenters,
        recentWinners,
      };
    }),

  toggleWant: protectedProcedure
    .input(z.object({ prizeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.db
        .select({ userId: prizeWants.userId })
        .from(prizeWants)
        .where(and(eq(prizeWants.prizeId, input.prizeId), eq(prizeWants.userId, userId)))
        .limit(1);
      if (existing.length) {
        await ctx.db.delete(prizeWants).where(and(eq(prizeWants.prizeId, input.prizeId), eq(prizeWants.userId, userId)));
        return { wanted: false };
      } else {
        await ctx.db.insert(prizeWants).values({ prizeId: input.prizeId, userId, createdAt: ctx.now as any });
        return { wanted: true };
      }
    }),

  addComment: protectedProcedure
    .input(z.object({ prizeId: z.number().int().positive(), text: z.string().min(1).max(500), parentCommentId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(prizeComments).values({ prizeId: input.prizeId, userId: ctx.session.user.id, text: input.text, parentCommentId: input.parentCommentId, createdAt: ctx.now as any }).returning();
      return row;
    }),

  listComments: publicProcedure
    .input(z.object({ prizeId: z.number().int().positive(), limit: z.number().int().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: prizeComments.id,
          text: prizeComments.text,
          userId: prizeComments.userId,
          createdAt: prizeComments.createdAt,
          parentCommentId: prizeComments.parentCommentId,
          userImage: users.image,
          userName: users.name,
        })
        .from(prizeComments)
        .innerJoin(users, eq(users.id, prizeComments.userId))
        .where(eq(prizeComments.prizeId, input.prizeId))
        .orderBy(desc(prizeComments.createdAt))
        .limit(input.limit ?? 20);
      return rows;
    }),

  // Admin: delete a comment (and direct replies) for moderation
  deleteComment: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      // delete direct children first to avoid orphans in simple UIs
      await ctx.db.delete(prizeComments).where(eq(prizeComments.parentCommentId, input.id));
      const [row] = await ctx.db.delete(prizeComments).where(eq(prizeComments.id, input.id)).returning();
      return row ?? { id: input.id } as any;
    }),

  listWanters: publicProcedure
    .input(z.object({ prizeId: z.number().int().positive(), limit: z.number().int().min(1).max(200).optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ userId: prizeWants.userId, createdAt: prizeWants.createdAt, userImage: users.image, userName: users.name })
        .from(prizeWants)
        .innerJoin(users, eq(users.id, prizeWants.userId))
        .where(eq(prizeWants.prizeId, input.prizeId))
        .orderBy(desc(prizeWants.createdAt))
        .limit(input.limit ?? 50);
      return rows;
    }),

  listWinners: publicProcedure
    .input(z.object({ prizeId: z.number().int().positive(), limit: z.number().int().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: purchases.id,
          userId: purchases.userId,
          createdAt: purchases.createdAt,
          userImage: users.image,
          userName: users.name,
        })
        .from(purchases)
        .innerJoin(users, eq(users.id, purchases.userId))
        .innerJoin(prizeVariants, eq(purchases.prizeVariantId, prizeVariants.id))
        .where(eq(prizeVariants.prizeId, input.prizeId))
        .orderBy(desc(purchases.createdAt))
        .limit(input.limit ?? 20);
      return rows;
    }),

  // Admin toggles and deletes
  togglePrizeActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(prizes).set({ active: input.active ? 1 : 0 }).where(eq(prizes.id, input.id)).returning();
      return row;
    }),

  toggleVariantActive: adminProcedure
    .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(prizeVariants).set({ active: input.active ? 1 : 0 }).where(eq(prizeVariants.id, input.id)).returning();
      return row;
    }),

  removePrize: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.delete(prizes).where(eq(prizes.id, input.id)).returning();
      return row;
    }),

  removeVariant: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.delete(prizeVariants).where(eq(prizeVariants.id, input.id)).returning();
      return row;
    }),
});
