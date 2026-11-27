DROP INDEX "species_category_idx";--> statement-breakpoint
DROP INDEX "news_posts_feed_idx";--> statement-breakpoint
ALTER TABLE "news_posts" ALTER COLUMN "category_slug" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "news_posts_title_trgm_idx" ON "news_posts" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "news_posts_fts_idx" ON "news_posts" USING gin (to_tsvector('english', "title" || ' ' || "body"));--> statement-breakpoint
CREATE INDEX "services_title_trgm_idx" ON "services" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "news_posts_feed_idx" ON "news_posts" USING btree ("category_slug","published_at" DESC NULLS LAST) WHERE "news_posts"."is_published";--> statement-breakpoint
ALTER TABLE "news_posts" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "species" DROP COLUMN "category";--> statement-breakpoint
DROP TYPE "public"."news_category";--> statement-breakpoint
DROP TYPE "public"."species_category";