import { postRouter } from "~/server/api/routers/post";
import { walletRouter } from "~/server/api/routers/wallet";
import { giftsRouter } from "~/server/api/routers/gifts";
import { prizesRouter } from "~/server/api/routers/prizes";
import { analyticsRouter } from "~/server/api/routers/analytics";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	post: postRouter,
	wallet: walletRouter,
	gifts: giftsRouter,
	prizes: prizesRouter,
	analytics: analyticsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
