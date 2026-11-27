CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."enquiry_type" AS ENUM('service', 'donation', 'partnership', 'contact', 'feedback');--> statement-breakpoint
CREATE TYPE "public"."giveaway_offer_type" AS ENUM('free', 'subsidised');--> statement-breakpoint
ALTER TYPE "public"."funder_type" ADD VALUE 'community';--> statement-breakpoint
ALTER TYPE "public"."funder_type" ADD VALUE 'other';--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "enquiry_type" NOT NULL,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"organization" text,
	"district" text,
	"message" text NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"service_category_id" uuid,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" uuid,
	"admin_note" text,
	"handled_by" uuid,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_source_ref_unique" UNIQUE("source_ref"),
	CONSTRAINT "enquiries_phone_e164" CHECK ("enquiries"."phone" IS NULL OR "enquiries"."phone" ~ '^\+2567[0-9]{8}$'),
	CONSTRAINT "enquiries_email_lower" CHECK ("enquiries"."email" IS NULL OR "enquiries"."email" = lower("enquiries"."email")),
	CONSTRAINT "enquiries_message_length" CHECK (char_length("enquiries"."message") BETWEEN 1 AND 5000)
);
--> statement-breakpoint
CREATE TABLE "news_categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "news_categories_slug_format" CHECK ("news_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "page_content" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text,
	"subtitle" text,
	"body" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"intro" text NOT NULL,
	"icon" text DEFAULT 'leaf' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "service_categories_slug_format" CHECK ("service_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "services_category_title_key" UNIQUE("category_id","title")
);
--> statement-breakpoint
CREATE TABLE "species_categories" (
	"species_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	CONSTRAINT "species_categories_species_id_category_slug_pk" PRIMARY KEY("species_id","category_slug")
);
--> statement-breakpoint
CREATE TABLE "tree_categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tree_categories_slug_format" CHECK ("tree_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_allocated_positive";--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "nursery_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "sub_county_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "offer_type" "giveaway_offer_type" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "subsidised_price" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "eligibility_requirements" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "application_procedure" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "application_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "distribution_locations" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "accepts_platform_applications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "category_slug" text;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "certification_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "certification_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "certification_body" text;--> statement-breakpoint
ALTER TABLE "nurseries" ADD COLUMN "certification_ref" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "botanical_family" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "appearance_and_identification" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "growth_characteristics" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "distribution_and_origin" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "soil_conditions" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "rainfall_requirements" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "climate_and_ecology" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "propagation_methods" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "planting_requirements" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "recommended_spacing" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "management_practices" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "economic_uses" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "environmental_benefits" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "agroforestry_applications" text;--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "other_uses" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_categories" ADD CONSTRAINT "species_categories_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_categories" ADD CONSTRAINT "species_categories_category_slug_tree_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."tree_categories"("slug") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "enquiries_status_created_idx" ON "enquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "enquiries_type_created_idx" ON "enquiries" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "species_categories_category_idx" ON "species_categories" USING btree ("category_slug");--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_category_slug_news_categories_slug_fk" FOREIGN KEY ("category_slug") REFERENCES "public"."news_categories"("slug") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_certification_verified_by_users_id_fk" FOREIGN KEY ("certification_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_allocated_nonneg" CHECK ("campaigns"."allocated_stock" >= 0);--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_platform_fields" CHECK (NOT "campaigns"."accepts_platform_applications" OR ("campaigns"."nursery_id" IS NOT NULL AND "campaigns"."sub_county_id" IS NOT NULL AND "campaigns"."allocated_stock" > 0));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_subsidised_price" CHECK (("campaigns"."offer_type" = 'subsidised') = ("campaigns"."subsidised_price" IS NOT NULL) AND ("campaigns"."subsidised_price" IS NULL OR "campaigns"."subsidised_price" > 0));--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_contact_phone_e164" CHECK ("campaigns"."contact_phone" IS NULL OR "campaigns"."contact_phone" ~ '^\+2567[0-9]{8}$');--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_contact_email_lower" CHECK ("campaigns"."contact_email" IS NULL OR "campaigns"."contact_email" = lower("campaigns"."contact_email"));--> statement-breakpoint
-- "Certified" now needs a recorded verification (client brief): nurseries marked certified without one become pending
UPDATE "nurseries" SET "certification_status" = 'pending' WHERE "certification_status" = 'certified';--> statement-breakpoint
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_certified_is_verified" CHECK (("nurseries"."certification_status" = 'certified') = ("nurseries"."certification_verified_at" IS NOT NULL AND "nurseries"."certification_body" IS NOT NULL));