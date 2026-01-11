import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `game0_${name}`);

export const posts = createTable(
	"post",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		name: d.varchar({ length: 256 }),
		createdById: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
	}),
	(t) => [
		index("created_by_idx").on(t.createdById),
		index("name_idx").on(t.name),
	],
);

export const users = createTable(
	"user",
	(d) => ({
		id: d
			.varchar({ length: 255 })
			.notNull()
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: d.varchar({ length: 255 }),
		email: d.varchar({ length: 255 }).notNull(),
		// For Credentials provider
		passwordHash: d.varchar({ length: 255 }),
		emailVerified: d
			.timestamp({
				mode: "date",
				withTimezone: true,
			})
			.default(sql`CURRENT_TIMESTAMP`),
		image: d.varchar({ length: 255 }),
	}),
	(t) => [uniqueIndex("user_email_unique").on(t.email)]
);

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
}));

export const accounts = createTable(
	"account",
	(d) => ({
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.varchar({ length: 255 }).notNull(),
		providerAccountId: d.varchar({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.integer(),
		token_type: d.varchar({ length: 255 }),
		scope: d.varchar({ length: 255 }),
		id_token: d.text(),
		session_state: d.varchar({ length: 255 }),
	}),
	(t) => [
		primaryKey({ columns: [t.provider, t.providerAccountId] }),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"session",
	(d) => ({
		sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_token",
	(d) => ({
		identifier: d.varchar({ length: 255 }).notNull(),
		token: d.varchar({ length: 255 }).notNull(),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Helpful indexes/constraints
 

// DADDY COINS & GIFTS

// User wallet holds the current Daddy Coin balance
export const wallets = createTable(
	"wallet",
	(d) => ({
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.primaryKey()
			.references(() => users.id),
		balance: d.integer().notNull().default(0),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date()),
	}),
);

export const walletsRelations = relations(wallets, ({ one, many }) => ({
	user: one(users, { fields: [wallets.userId], references: [users.id] }),
	transactions: many(walletTransactions),
	purchases: many(purchases),
}));

// Transactions ledger for wallet changes
export const walletTransactions = createTable(
	"wallet_txn",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		amount: d.integer().notNull(), // positive for earn, negative for spend
		type: d.varchar({ length: 20 }).notNull(), // "earn" | "spend" | "adjust"
		reason: d.varchar({ length: 255 }),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	}),
	(t) => [index("wallet_txn_user_id_idx").on(t.userId)],
);

export const walletTransactionsRelations = relations(
	walletTransactions,
	({ one }) => ({
		user: one(users, {
			fields: [walletTransactions.userId],
			references: [users.id],
		}),
	}),
);

// Gift catalog (e.g., Amazon vouchers)
export const gifts = createTable(
	"gift",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		title: d.varchar({ length: 255 }).notNull(),
		imageUrl: d.text(),
		videoUrl: d.text(),
		coinCost: d.integer().notNull(),
		vendor: d.varchar({ length: 64 }).notNull().default("amazon"),
		voucherAmount: d.integer(), // e.g., amount of the voucher in local currency
		active: d.integer().notNull().default(1), // 1 = active, 0 = inactive
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date()),
	}),
	(t) => [index("gift_active_idx").on(t.active)],
);

export const giftsRelations = relations(gifts, ({ many }) => ({
	purchases: many(purchases),
}));

// Generalized Prizes (Products) and Variants (Purchasable options/tiers)
export const prizes = createTable(
	"prize",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		title: d.varchar({ length: 255 }).notNull(),
		description: d.text(),
		imageUrl: d.text(),
		videoUrl: d.text(),
		// Primary image and flexible media gallery (images/videos)
		primaryImageUrl: d.text(),
		media: d
			.jsonb()
			.$type<Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>>(),
		vendor: d.varchar({ length: 64 }).default("generic"),
		// Optional vendor logo to display in PrizeCard
		vendorLogo: d.text(),
		active: d.integer().notNull().default(1),
		metadata: d.jsonb(),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date()),
	}),
	(t) => [index("prize_active_idx").on(t.active)],
);

export const prizeVariants = createTable(
	"prize_variant",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		prizeId: d
			.integer()
			.notNull()
			.references(() => prizes.id),
		label: d.varchar({ length: 255 }).notNull(),
		// Optional short label for buttons
		buttonLabel: d.varchar({ length: 64 }),
		coinCost: d.integer().notNull(),
		sku: d.varchar({ length: 64 }),
		sortOrder: d.integer().notNull().default(0),
		active: d.integer().notNull().default(1),
		fulfillmentType: d.varchar({ length: 64 }),
		fulfillmentConfig: d.jsonb(),
		// Optional variant-specific media
		primaryImageUrl: d.text(),
		media: d
			.jsonb()
			.$type<Array<{ type: "image" | "video"; url: string; alt?: string; sortOrder?: number }>>(),
		metadata: d.jsonb(),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.$onUpdate(() => new Date()),
	}),
	(t) => [
		index("prize_variant_prize_id_idx").on(t.prizeId),
		index("prize_variant_active_idx").on(t.active),
		index("prize_variant_sort_idx").on(t.sortOrder),
	],
);

export const prizesRelations = relations(prizes, ({ many }) => ({
	variants: many(prizeVariants),
}));

export const prizeVariantsRelations = relations(prizeVariants, ({ one }) => ({
	prize: one(prizes, { fields: [prizeVariants.prizeId], references: [prizes.id] }),
}));

// Interaction tables
export const prizeWants = createTable(
	"prize_want",
	(d) => ({
		userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
		prizeId: d.integer().notNull().references(() => prizes.id),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	}),
	(t) => [
		primaryKey({ columns: [t.userId, t.prizeId] }),
		index("prize_want_prize_idx").on(t.prizeId),
	],
);

export const prizeComments = createTable(
	"prize_comment",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
		prizeId: d.integer().notNull().references(() => prizes.id),
		// Note: avoid TS circular type by not referencing prizeComments in its own initializer
		parentCommentId: d.integer(),
		text: d.text().notNull(),
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	}),
	(t) => [
		index("prize_comment_prize_idx").on(t.prizeId),
		index("prize_comment_parent_idx").on(t.parentCommentId),
	],
);

// Purchases connect users to gifts and store redemption data
export const purchases = createTable(
	"purchase",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		giftId: d
			.integer()
			.references(() => gifts.id),
		// Optionally reference a specific prize variant in the generalized schema
		prizeVariantId: d.integer().references(() => prizeVariants.id),
		redemptionCode: d.varchar({ length: 255 }), // revealed upon purchase
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	}),
	(t) => [
		index("purchase_user_id_idx").on(t.userId),
		index("purchase_gift_id_idx").on(t.giftId),
		index("purchase_variant_id_idx").on(t.prizeVariantId),
	],
);

export const purchasesRelations = relations(purchases, ({ one }) => ({
	user: one(users, { fields: [purchases.userId], references: [users.id] }),
	gift: one(gifts, { fields: [purchases.giftId], references: [gifts.id] }),
	variant: one(prizeVariants, { fields: [purchases.prizeVariantId], references: [prizeVariants.id] }),
}));
