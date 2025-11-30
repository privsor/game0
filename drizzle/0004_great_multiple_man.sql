ALTER TABLE "game0_user" ADD COLUMN "passwordHash" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "game0_user" USING btree ("email");