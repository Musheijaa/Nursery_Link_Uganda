CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'collected');--> statement-breakpoint
CREATE TYPE "public"."boundary_level" AS ENUM('district', 'sub_county');--> statement-breakpoint
CREATE TYPE "public"."certification_status" AS ENUM('certified', 'pending', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('self_pickup', 'order_and_deliver');--> statement-breakpoint
CREATE TYPE "public"."funder_type" AS ENUM('government', 'ngo', 'foundation', 'corporate');--> statement-breakpoint
CREATE TYPE "public"."growth_pace" AS ENUM('fast', 'moderate', 'slow');--> statement-breakpoint
CREATE TYPE "public"."news_category" AS ENUM('weather', 'market', 'policy', 'grant');--> statement-breakpoint
CREATE TYPE "public"."nursery_type" AS ENUM('private', 'commercial', 'community');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'escrow_held', 'dispatched', 'delivered', 'released', 'disputed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('verify', 'reset');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('collection', 'disbursement', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mtn_momo', 'airtel_money');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('mock', 'mtn_momo', 'airtel_money');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'successful', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('buyer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."shadow_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."species_category" AS ENUM('indigenous', 'agroforestry', 'exotic', 'ornamental', 'medicinal');--> statement-breakpoint
CREATE TYPE "public"."vehicle" AS ENUM('motorcycle', 'truck');--> statement-breakpoint
CREATE TABLE "admin_boundaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"level" "boundary_level" NOT NULL,
	"parent_id" uuid,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	CONSTRAINT "admin_boundaries_level_parent_name_key" UNIQUE NULLS NOT DISTINCT("level","parent_id","name"),
	CONSTRAINT "admin_boundaries_parent_level" CHECK (("admin_boundaries"."level" = 'district') = ("admin_boundaries"."parent_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"quantity_requested" integer NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_applications_campaign_user_key" UNIQUE("campaign_id","user_id"),
	CONSTRAINT "campaign_applications_quantity_positive" CHECK ("campaign_applications"."quantity_requested" > 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_items" (
	"campaign_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "campaign_items_campaign_id_species_id_pk" PRIMARY KEY("campaign_id","species_id"),
	CONSTRAINT "campaign_items_quantity_positive" CHECK ("campaign_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nursery_id" uuid NOT NULL,
	"title" text NOT NULL,
	"funder_name" text NOT NULL,
	"funder_type" "funder_type" NOT NULL,
	"purpose" text NOT NULL,
	"sub_county_id" uuid NOT NULL,
	"allocated_stock" integer NOT NULL,
	"remaining_stock" integer NOT NULL,
	"eligibility_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "campaigns_allocated_positive" CHECK ("campaigns"."allocated_stock" > 0),
	CONSTRAINT "campaigns_remaining_range" CHECK ("campaigns"."remaining_stock" >= 0 AND "campaigns"."remaining_stock" <= "campaigns"."allocated_stock"),
	CONSTRAINT "campaigns_dates_ordered" CHECK ("campaigns"."ends_at" > "campaigns"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "delivery_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle" "vehicle" NOT NULL,
	"max_items" integer NOT NULL,
	"base_fee" integer NOT NULL,
	"per_km" integer NOT NULL,
	"max_km" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "delivery_rates_max_items_positive" CHECK ("delivery_rates"."max_items" > 0),
	CONSTRAINT "delivery_rates_fees_nonneg" CHECK ("delivery_rates"."base_fee" >= 0 AND "delivery_rates"."per_km" >= 0),
	CONSTRAINT "delivery_rates_max_km_positive" CHECK ("delivery_rates"."max_km" > 0)
);
--> statement-breakpoint
CREATE TABLE "forest_loss_cells" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "forest_loss_cells_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"geom" geometry(Polygon, 4326) NOT NULL,
	"loss_pct" numeric(5, 2) NOT NULL,
	"loss_year_from" smallint NOT NULL,
	"loss_year_to" smallint NOT NULL,
	CONSTRAINT "forest_loss_cells_pct_range" CHECK ("forest_loss_cells"."loss_pct" BETWEEN 0 AND 100),
	CONSTRAINT "forest_loss_cells_years_ordered" CHECK ("forest_loss_cells"."loss_year_to" >= "forest_loss_cells"."loss_year_from")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nursery_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"quantity_available" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_nursery_species_key" UNIQUE("nursery_id","species_id"),
	CONSTRAINT "inventory_quantity_nonneg" CHECK ("inventory"."quantity_available" >= 0),
	CONSTRAINT "inventory_unit_price_positive" CHECK ("inventory"."unit_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" "news_category" NOT NULL,
	"body" text NOT NULL,
	"cover_url" text,
	"published_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "news_posts_slug_unique" UNIQUE("slug"),
	CONSTRAINT "news_posts_slug_format" CHECK ("news_posts"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "news_posts_published_has_date" CHECK (NOT "news_posts"."is_published" OR "news_posts"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "nurseries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "nursery_type" NOT NULL,
	"district_id" uuid NOT NULL,
	"sub_county_id" uuid NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"operator_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"payout_phone" text NOT NULL,
	"annual_capacity" integer NOT NULL,
	"seed_source" text,
	"certification_status" "certification_status" DEFAULT 'unverified' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nurseries_contact_phone_e164" CHECK ("nurseries"."contact_phone" ~ '^\+2567[0-9]{8}$'),
	CONSTRAINT "nurseries_payout_phone_e164" CHECK ("nurseries"."payout_phone" ~ '^\+2567[0-9]{8}$'),
	CONSTRAINT "nurseries_annual_capacity_nonneg" CHECK ("nurseries"."annual_capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"inventory_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"line_total" integer NOT NULL,
	CONSTRAINT "order_items_order_inventory_key" UNIQUE("order_id","inventory_id"),
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_positive" CHECK ("order_items"."unit_price_snapshot" > 0),
	CONSTRAINT "order_items_line_total" CHECK ("order_items"."line_total" = "order_items"."quantity" * "order_items"."unit_price_snapshot")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"nursery_id" uuid NOT NULL,
	"delivery_type" "delivery_type" NOT NULL,
	"delivery_point" geometry(Point, 4326),
	"delivery_address" text,
	"distance_km" numeric(8, 2),
	"delivery_fee" integer NOT NULL,
	"items_total" integer NOT NULL,
	"grand_total" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"paid_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_short_code_unique" UNIQUE("short_code"),
	CONSTRAINT "orders_short_code_format" CHECK ("orders"."short_code" ~ '^[A-Z0-9]{6}$'),
	CONSTRAINT "orders_totals_add_up" CHECK ("orders"."grand_total" = "orders"."items_total" + "orders"."delivery_fee"),
	CONSTRAINT "orders_amounts_valid" CHECK ("orders"."items_total" > 0 AND "orders"."delivery_fee" >= 0),
	CONSTRAINT "orders_distance_nonneg" CHECK ("orders"."distance_km" IS NULL OR "orders"."distance_km" >= 0),
	CONSTRAINT "orders_delivery_details" CHECK (("orders"."delivery_type" = 'self_pickup' AND "orders"."delivery_fee" = 0)
       OR ("orders"."delivery_type" = 'order_and_deliver' AND "orders"."delivery_point" IS NOT NULL AND "orders"."delivery_address" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_codes_phone_e164" CHECK ("otp_codes"."phone" ~ '^\+2567[0-9]{8}$'),
	CONSTRAINT "otp_codes_attempts_range" CHECK ("otp_codes"."attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_ref" text,
	"idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"msisdn" text NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"raw_callback" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_msisdn_e164" CHECK ("payments"."msisdn" ~ '^\+2567[0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "service_zones" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" uuid NOT NULL,
	"nursery_id" uuid NOT NULL,
	"km" smallint NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	CONSTRAINT "service_zones_run_nursery_km_key" UNIQUE("run_id","nursery_id","km"),
	CONSTRAINT "service_zones_km_values" CHECK ("service_zones"."km" IN (5, 10, 20))
);
--> statement-breakpoint
CREATE TABLE "shadow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "shadow_run_status" DEFAULT 'queued' NOT NULL,
	"params" jsonb NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shadow_zones" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shadow_zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" uuid NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL,
	"loss_pct" numeric(5, 2) NOT NULL,
	"area_km2" numeric(10, 3) NOT NULL,
	"district_id" uuid
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scientific_name" text NOT NULL,
	"common_name" text NOT NULL,
	"category" "species_category" NOT NULL,
	"growth_pace" "growth_pace" NOT NULL,
	"height_timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"canopy_notes" text,
	"root_notes" text,
	"ecological_zones" text[] DEFAULT '{}'::text[] NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "species_slug_unique" UNIQUE("slug"),
	CONSTRAINT "species_slug_format" CHECK ("species"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "species_local_names" (
	"species_id" uuid NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "species_local_names_species_id_language_pk" PRIMARY KEY("species_id","language")
);
--> statement-breakpoint
CREATE TABLE "species_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species_id" uuid NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'buyer' NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_e164" CHECK ("users"."phone" ~ '^\+2567[0-9]{8}$'),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "admin_boundaries" ADD CONSTRAINT "admin_boundaries_parent_id_admin_boundaries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."admin_boundaries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_applications" ADD CONSTRAINT "campaign_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_nursery_id_nurseries_id_fk" FOREIGN KEY ("nursery_id") REFERENCES "public"."nurseries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sub_county_id_admin_boundaries_id_fk" FOREIGN KEY ("sub_county_id") REFERENCES "public"."admin_boundaries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_nursery_id_nurseries_id_fk" FOREIGN KEY ("nursery_id") REFERENCES "public"."nurseries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_district_id_admin_boundaries_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."admin_boundaries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nurseries" ADD CONSTRAINT "nurseries_sub_county_id_admin_boundaries_id_fk" FOREIGN KEY ("sub_county_id") REFERENCES "public"."admin_boundaries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_nursery_id_nurseries_id_fk" FOREIGN KEY ("nursery_id") REFERENCES "public"."nurseries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_run_id_shadow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."shadow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_nursery_id_nurseries_id_fk" FOREIGN KEY ("nursery_id") REFERENCES "public"."nurseries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_runs" ADD CONSTRAINT "shadow_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_zones" ADD CONSTRAINT "shadow_zones_run_id_shadow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."shadow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shadow_zones" ADD CONSTRAINT "shadow_zones_district_id_admin_boundaries_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."admin_boundaries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_local_names" ADD CONSTRAINT "species_local_names_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_media" ADD CONSTRAINT "species_media_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_boundaries_geom_gix" ON "admin_boundaries" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "admin_boundaries_level_parent_idx" ON "admin_boundaries" USING btree ("level","parent_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "campaign_applications_campaign_status_idx" ON "campaign_applications" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "campaigns_sub_county_idx" ON "campaigns" USING btree ("sub_county_id");--> statement-breakpoint
CREATE INDEX "campaigns_nursery_idx" ON "campaigns" USING btree ("nursery_id");--> statement-breakpoint
CREATE INDEX "forest_loss_cells_geom_gix" ON "forest_loss_cells" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "inventory_species_idx" ON "inventory" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "news_posts_feed_idx" ON "news_posts" USING btree ("category","published_at" DESC NULLS LAST) WHERE "news_posts"."is_published";--> statement-breakpoint
CREATE INDEX "nurseries_location_gix" ON "nurseries" USING gist ("location");--> statement-breakpoint
CREATE INDEX "nurseries_district_idx" ON "nurseries" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "nurseries_sub_county_idx" ON "nurseries" USING btree ("sub_county_id");--> statement-breakpoint
CREATE INDEX "nurseries_name_trgm_idx" ON "nurseries" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "orders_user_created_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_nursery_idx" ON "orders" USING btree ("nursery_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_delivery_point_gix" ON "orders" USING gist ("delivery_point");--> statement-breakpoint
CREATE INDEX "otp_codes_lookup_idx" ON "otp_codes" USING btree ("phone","purpose","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_pending_idx" ON "payments" USING btree ("created_at") WHERE "payments"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments" USING btree ("provider","provider_ref") WHERE "payments"."provider_ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_successful_collection" ON "payments" USING btree ("order_id") WHERE "payments"."kind" = 'collection' AND "payments"."status" = 'successful';--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "service_zones_geom_gix" ON "service_zones" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "shadow_runs_created_idx" ON "shadow_runs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "shadow_zones_geom_gix" ON "shadow_zones" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "shadow_zones_run_idx" ON "shadow_zones" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "species_category_idx" ON "species" USING btree ("category");--> statement-breakpoint
CREATE INDEX "species_common_name_trgm_idx" ON "species" USING gin ("common_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "species_scientific_name_trgm_idx" ON "species" USING gin ("scientific_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "species_local_names_name_trgm_idx" ON "species_local_names" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "species_media_species_idx" ON "species_media" USING btree ("species_id","sort_order");