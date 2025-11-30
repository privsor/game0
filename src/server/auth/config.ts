import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { db } from "~/server/db";
import {
	accounts,
	sessions,
	users,
	verificationTokens,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			// ...other properties
			// role: UserRole;
		} & DefaultSession["user"];
	}

	// interface User {
	//   // ...other properties
	//   // role: UserRole;
	// }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	providers: [
		DiscordProvider,
		GoogleProvider,
		Credentials({
			name: "Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			// v5 authorize receives the submitted credentials and should return a user or null
			authorize: async (credentials) => {
				const email = (credentials?.email || "").toString().trim().toLowerCase();
				const password = (credentials?.password || "").toString();
				if (!email || !password) return null;
				const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
				const user = existing[0];
				if (!user || !user.passwordHash) return null;
				const ok = await bcrypt.compare(password, user.passwordHash);
				if (!ok) return null;
				return { id: user.id, name: user.name, email: user.email, image: user.image } as any;
			},
		}),
		/**
		 * ...add more providers here.
		 *
		 * Most other providers require a bit more work than the Discord provider. For example, the
		 * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
		 * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
		 *
		 * @see https://next-auth.js.org/providers/github
		 */
	],
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens,
	}),
	callbacks: {
		signIn: async ({ user, account, profile }) => {
			// Allow credentials logins
			if (account?.provider === "credentials") return true;
			// For OAuth, require an email and prefer verified emails
			const email = (user?.email || (profile as any)?.email || "").toString().trim().toLowerCase();
			if (!email) return false;
			const verified =
				(profile as any)?.email_verified ?? (profile as any)?.verified_email ?? (profile as any)?.verified ?? true;
			return Boolean(verified);
		},
		session: ({ session, user }) => ({
			...session,
			user: {
				...session.user,
				id: user.id,
			},
		}),
	},
} satisfies NextAuthConfig;
