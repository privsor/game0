import { relations, sql } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
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

export const users = createTable("user", (d) => ({
	id: d
		.varchar({ length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: d.varchar({ length: 255 }),
	email: d.varchar({ length: 255 }).notNull(),
	emailVerified: d
		.timestamp({
			mode: "date",
			withTimezone: true,
		})
		.default(sql`CURRENT_TIMESTAMP`),
	image: d.varchar({ length: 255 }),
}));

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
			.notNull()
			.references(() => gifts.id),
		redemptionCode: d.varchar({ length: 255 }), // revealed upon purchase
		createdAt: d
			.timestamp({ withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	}),
	(t) => [
		index("purchase_user_id_idx").on(t.userId),
		index("purchase_gift_id_idx").on(t.giftId),
	],
);

export const purchasesRelations = relations(purchases, ({ one }) => ({
	user: one(users, { fields: [purchases.userId], references: [users.id] }),
	gift: one(gifts, { fields: [purchases.giftId], references: [gifts.id] }),
}));

// Coin packages for purchase (admin-managed)
export const coinPackages = createTable(
	"coin_package",
	(d) => ({
		id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
		currency: d.varchar({ length: 8 }).notNull(), // "INR" | "GBP"
		coins: d.integer().notNull(),
		amountMinor: d.integer().notNull(), // paise for INR, pence for GBP
		active: d.integer().notNull().default(1),
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
		index("coin_pkg_currency_idx").on(t.currency),
		index("coin_pkg_active_idx").on(t.active),
	],
);
