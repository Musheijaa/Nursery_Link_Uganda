-- Client content brief: move existing data into the new tables. Nothing is deleted here; the old
-- columns are dropped in the next migration only once their data has a new home.

-- 1. Tree categories (the seed keeps labels and order current; the rows must exist for the move below)
INSERT INTO "tree_categories" ("slug", "label", "sort_order") VALUES
  ('agroforestry', 'Agroforestry Species', 1),
  ('fruit', 'Fruit Trees', 2),
  ('timber', 'Timber Trees', 3),
  ('medicinal', 'Medicinal Trees', 4),
  ('ornamental', 'Ornamental Trees', 5),
  ('indigenous', 'Indigenous and Native Trees', 6),
  ('shade', 'Shade Trees', 7),
  ('multipurpose', 'Multipurpose Trees', 8),
  ('other', 'Other Species', 9)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

-- Old single category -> new categories. Coffee and cocoa (crops grown under trees) become agroforestry.
INSERT INTO "species_categories" ("species_id", "category_slug")
SELECT "id", CASE "category"::text
    WHEN 'indigenous' THEN 'indigenous'
    WHEN 'agroforestry' THEN 'agroforestry'
    WHEN 'ornamental' THEN 'ornamental'
    WHEN 'medicinal' THEN 'medicinal'
    WHEN 'exotic' THEN 'other'
    WHEN 'coffee' THEN 'agroforestry'
    WHEN 'cocoa' THEN 'agroforestry'
  END
FROM "species"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- 2. Species profile: the old notes go to the nearest new field (the old columns stay, so nothing is lost)
UPDATE "species" SET
  "appearance_and_identification" = COALESCE("appearance_and_identification", "canopy_notes"),
  "management_practices" = COALESCE("management_practices", "root_notes"),
  "growth_characteristics" = COALESCE("growth_characteristics", CASE "growth_pace"::text
    WHEN 'fast' THEN 'Grows fast.'
    WHEN 'moderate' THEN 'Grows at a moderate pace.'
    WHEN 'slow' THEN 'Grows slowly.'
  END),
  "climate_and_ecology" = COALESCE("climate_and_ecology", CASE WHEN cardinality("ecological_zones") > 0
    THEN 'Grows well in: ' || array_to_string("ecological_zones", ', ') || '.' END);
--> statement-breakpoint

-- 3. News categories (admin-editable from now on)
INSERT INTO "news_categories" ("slug", "label", "description", "sort_order") VALUES
  ('policy-sector', 'Policy & Sector News', 'Government policies, forestry news and sector developments.', 1),
  ('weather-seasonal', 'Weather & Seasonal Advisories', 'Climate updates, seasonal information and nursery-sector warnings.', 2),
  ('planting-restoration', 'Planting & Restoration Opportunities', 'Tree-growing campaigns and restoration opportunities.', 3),
  ('agroforestry-farming', 'Agroforestry & Sustainable Farming', 'Practical information on agroforestry and sustainable agricultural practices.', 4),
  ('training-events', 'Training, Workshops & Events', 'Relevant training opportunities, workshops and events.', 5),
  ('funding-partnerships', 'Funding & Partnerships', 'Funding opportunities, partnerships, grants and subsidies.', 6)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint

UPDATE "news_posts" SET
  "category_slug" = CASE "category"::text
    WHEN 'weather' THEN 'weather-seasonal'
    WHEN 'policy' THEN 'policy-sector'
    WHEN 'grant' THEN 'funding-partnerships'
    WHEN 'market' THEN 'agroforestry-farming'
  END,
  -- "market" has no matching new category: an admin should check these
  "needs_review" = ("category"::text = 'market');
--> statement-breakpoint

-- 4. One inbox: copy site feedback and the old planting-service requests into enquiries
INSERT INTO "enquiries" ("type", "status", "name", "phone", "email", "message", "consent", "details", "user_id",
                         "admin_note", "handled_by", "source_ref", "created_at", "updated_at")
SELECT 'feedback',
       CASE f."status"::text WHEN 'new' THEN 'new' WHEN 'read' THEN 'in_progress' ELSE 'closed' END::enquiry_status,
       COALESCE(u."full_name", f."name"),
       COALESCE(u."phone", CASE WHEN f."contact" ~ '^\+2567[0-9]{8}$' THEN f."contact" END),
       CASE WHEN f."contact" LIKE '%@%' THEN lower(f."contact") END,
       f."message", true,
       jsonb_strip_nulls(jsonb_build_object('kind', f."kind"::text, 'page', f."page", 'contact', f."contact")),
       f."user_id", f."admin_note", f."handled_by", 'feedback:' || f."id", f."created_at", f."updated_at"
FROM "feedback" f LEFT JOIN "users" u ON u."id" = f."user_id"
ON CONFLICT ("source_ref") DO NOTHING;
--> statement-breakpoint

INSERT INTO "enquiries" ("type", "status", "name", "phone", "district", "message", "consent", "services", "details", "user_id",
                         "admin_note", "handled_by", "source_ref", "created_at", "updated_at")
SELECT 'service',
       CASE r."status"::text WHEN 'new' THEN 'new' WHEN 'contacted' THEN 'in_progress' WHEN 'scheduled' THEN 'in_progress' ELSE 'closed' END::enquiry_status,
       u."full_name", u."phone", r."location",
       COALESCE(NULLIF(r."notes", ''), 'Asked for: ' || replace(r."service"::text, '_', ' ')),
       true,
       ARRAY[replace(r."service"::text, '_', ' ')],
       jsonb_strip_nulls(jsonb_build_object('old_service', r."service"::text, 'old_status', r."status"::text, 'land_acres', r."land_acres"::float8)),
       r."user_id", r."admin_note", r."handled_by", 'service_request:' || r."id", r."created_at", r."updated_at"
FROM "service_requests" r JOIN "users" u ON u."id" = r."user_id"
ON CONFLICT ("source_ref") DO NOTHING;
--> statement-breakpoint

-- 5. Keep updated_at current on the new tables, as on the others
CREATE TRIGGER enquiries_touch_updated_at BEFORE UPDATE ON enquiries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER partners_touch_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER page_content_touch_updated_at BEFORE UPDATE ON page_content FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER service_categories_touch_updated_at BEFORE UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
