ALTER TABLE "nurseries" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "listing_note" text;--> statement-breakpoint
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_external_ref_unique" UNIQUE("external_ref");