ALTER TABLE "admin_boundaries" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "admin_boundaries" ADD CONSTRAINT "admin_boundaries_code_unique" UNIQUE("code");