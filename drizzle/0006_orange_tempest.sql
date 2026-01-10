ALTER TABLE "game0_prize_variant" ADD COLUMN "primaryImageUrl" text;--> statement-breakpoint
ALTER TABLE "game0_prize_variant" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "game0_prize" ADD COLUMN "primaryImageUrl" text;--> statement-breakpoint
ALTER TABLE "game0_prize" ADD COLUMN "media" jsonb;