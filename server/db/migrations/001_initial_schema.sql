-- Nursery Link Uganda: initial schema
-- Money is stored as whole Uganda shillings (UGX has no minor unit in practice).
-- Locations are PostGIS geography points (WGS 84) so distances come back in metres.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Reference data ─────────────────────────────────────────

CREATE TYPE region AS ENUM ('Central', 'Eastern', 'Northern', 'Western');

CREATE TABLE districts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  region      region NOT NULL,
  location    GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE TYPE species_category AS ENUM (
  'Indigenous timber', 'Fast-growing timber', 'Fruit tree', 'Shade & agroforestry', 'Medicinal & cultural'
);
CREATE TYPE growth_rate AS ENUM ('Fast', 'Moderate', 'Slow');

CREATE TABLE species (
  id               TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),
  common_name      TEXT NOT NULL,
  botanical_name   TEXT NOT NULL,
  category         species_category NOT NULL,
  is_native        BOOLEAN NOT NULL,
  description      TEXT NOT NULL,
  uses             TEXT[] NOT NULL DEFAULT '{}',
  regions          region[] NOT NULL,
  altitude_min_m   INTEGER NOT NULL CHECK (altitude_min_m >= 0),
  altitude_max_m   INTEGER NOT NULL CHECK (altitude_max_m >= altitude_min_m),
  growth_rate      growth_rate NOT NULL,
  time_to_harvest  TEXT NOT NULL,
  planting_tip     TEXT NOT NULL,
  image_key        TEXT NOT NULL
);

CREATE TABLE species_local_names (
  species_id  TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  language    TEXT NOT NULL,
  name        TEXT NOT NULL,
  PRIMARY KEY (species_id, language)
);

-- ── People and sessions ────────────────────────────────────

CREATE TYPE user_role AS ENUM ('buyer', 'nursery_owner', 'admin');

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalised Ugandan mobile, e.g. 0772123456
  phone          TEXT NOT NULL UNIQUE CHECK (phone ~ '^07[0-9]{8}$'),
  name           TEXT,
  role           user_role NOT NULL DEFAULT 'buyer',
  -- scrypt hash; only nursery owners and admins sign in with a password
  password_hash  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role = 'buyer' OR password_hash IS NOT NULL)
);

CREATE TABLE sessions (
  -- SHA-256 of the session token; the raw token only ever lives in the cookie
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE otp_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT NOT NULL CHECK (phone ~ '^07[0-9]{8}$'),
  code_hash    TEXT NOT NULL,
  attempts     SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

-- ── Nurseries and stock ────────────────────────────────────

CREATE TYPE registration_type AS ENUM ('NFA registered', 'MAAIF certified', 'District registered', 'Community group');
CREATE TYPE delivery_method AS ENUM ('Collect from nursery', 'Boda boda', 'Truck');
CREATE TYPE payment_network AS ENUM ('MTN MoMo', 'Airtel Money');
CREATE TYPE nursery_status AS ENUM ('pending', 'active', 'suspended');

CREATE TABLE nurseries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  owner_id             UUID NOT NULL REFERENCES users(id),
  name                 TEXT NOT NULL,
  operator_name        TEXT NOT NULL,
  phone                TEXT NOT NULL CHECK (phone ~ '^07[0-9]{8}$'),
  -- Where the nursery is paid; can differ from the contact phone
  payout_phone         TEXT NOT NULL CHECK (payout_phone ~ '^07[0-9]{8}$'),
  payout_network       payment_network NOT NULL,
  district_id          INTEGER NOT NULL REFERENCES districts(id),
  sub_county           TEXT NOT NULL,
  village              TEXT NOT NULL,
  location             GEOGRAPHY(POINT, 4326) NOT NULL,
  registration_type    registration_type NOT NULL,
  registration_number  TEXT NOT NULL,
  established_year     SMALLINT NOT NULL CHECK (established_year BETWEEN 1950 AND 2100),
  description          TEXT NOT NULL,
  opening_hours        TEXT NOT NULL,
  delivery_methods     delivery_method[] NOT NULL CHECK (cardinality(delivery_methods) > 0),
  status               nursery_status NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nurseries_location_idx ON nurseries USING GIST (location);
CREATE INDEX nurseries_district_idx ON nurseries (district_id) WHERE status = 'active';
CREATE INDEX nurseries_owner_idx ON nurseries (owner_id);

CREATE TYPE seedling_type AS ENUM ('Potted seedling', 'Root trainer', 'Grafted', 'Cutting');
CREATE TYPE batch_status AS ENUM ('Ready', 'Ready soon');

CREATE TABLE seedling_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id          UUID NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  species_id          TEXT NOT NULL REFERENCES species(id),
  seedling_type       seedling_type NOT NULL,
  age_months          SMALLINT NOT NULL CHECK (age_months > 0),
  height_cm           SMALLINT NOT NULL CHECK (height_cm > 0),
  unit_price_ugx      INTEGER NOT NULL CHECK (unit_price_ugx > 0),
  -- Never negative: stock reservation relies on this constraint as a last line of defence
  quantity_available  INTEGER NOT NULL CHECK (quantity_available >= 0),
  status              batch_status NOT NULL DEFAULT 'Ready',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX seedling_batches_nursery_idx ON seedling_batches (nursery_id);
CREATE INDEX seedling_batches_species_idx ON seedling_batches (species_id) WHERE quantity_available > 0;

-- ── Orders and payments ────────────────────────────────────

CREATE TYPE order_status AS ENUM (
  'awaiting_payment',   -- stock reserved, waiting for the buyer to approve on their phone
  'payment_failed',     -- declined or timed out; stock returned
  'payment_held',       -- paid; money held until delivery is confirmed
  'being_prepared',
  'on_the_way',         -- dispatched, or ready for collection
  'delivered',          -- buyer confirmed; payout to nursery started
  'problem_reported',   -- buyer raised an issue; money stays held
  'cancelled'
);

CREATE SEQUENCE order_number_seq START 1001;

CREATE TABLE orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number         TEXT NOT NULL UNIQUE,
  buyer_id             UUID NOT NULL REFERENCES users(id),
  buyer_name           TEXT NOT NULL,
  buyer_phone          TEXT NOT NULL CHECK (buyer_phone ~ '^07[0-9]{8}$'),
  nursery_id           UUID NOT NULL REFERENCES nurseries(id),
  delivery_method      delivery_method NOT NULL,
  delivery_district_id INTEGER NOT NULL REFERENCES districts(id),
  delivery_area        TEXT NOT NULL,
  delivery_landmark    TEXT NOT NULL DEFAULT '',
  distance_km          INTEGER NOT NULL CHECK (distance_km >= 0),
  seedlings_total_ugx  INTEGER NOT NULL CHECK (seedlings_total_ugx > 0),
  delivery_fee_ugx     INTEGER NOT NULL CHECK (delivery_fee_ugx >= 0),
  total_ugx            INTEGER NOT NULL CHECK (total_ugx = seedlings_total_ugx + delivery_fee_ugx),
  status               order_status NOT NULL DEFAULT 'awaiting_payment',
  -- Shown only to the buyer; the nursery enters it to confirm handover
  delivery_code        CHAR(4) NOT NULL CHECK (delivery_code ~ '^[0-9]{4}$'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ
);
CREATE INDEX orders_buyer_idx ON orders (buyer_id, created_at DESC);
CREATE INDEX orders_nursery_idx ON orders (nursery_id, created_at DESC);
CREATE INDEX orders_awaiting_idx ON orders (created_at) WHERE status = 'awaiting_payment';

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  batch_id        UUID NOT NULL REFERENCES seedling_batches(id),
  -- Species, type and price are copied so the order stays accurate if the batch changes later
  species_id      TEXT NOT NULL REFERENCES species(id),
  seedling_type   seedling_type NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_ugx  INTEGER NOT NULL CHECK (unit_price_ugx > 0),
  UNIQUE (order_id, batch_id)
);

-- Append-only history of every status change, for support and disputes
CREATE TABLE order_events (
  id          BIGSERIAL PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      order_status NOT NULL,
  actor_id    UUID REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events (order_id, created_at);

CREATE TYPE payment_direction AS ENUM ('collection', 'payout');
CREATE TYPE payment_provider AS ENUM ('simulated', 'mtn_momo', 'airtel_money');
CREATE TYPE payment_status AS ENUM ('pending', 'successful', 'failed');

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  direction           payment_direction NOT NULL,
  provider            payment_provider NOT NULL,
  network             payment_network NOT NULL,
  phone               TEXT NOT NULL CHECK (phone ~ '^07[0-9]{8}$'),
  amount_ugx          INTEGER NOT NULL CHECK (amount_ugx > 0),
  -- Reference we send to the provider (idempotency key) and theirs, if different
  reference           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  provider_reference  TEXT,
  status              payment_status NOT NULL DEFAULT 'pending',
  failure_reason      TEXT,
  provider_response   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments (order_id);
-- At most one successful collection and one successful payout per order
CREATE UNIQUE INDEX payments_one_success_idx ON payments (order_id, direction) WHERE status = 'successful';

-- ── Free seedling programmes ───────────────────────────────

CREATE TYPE sponsor_type AS ENUM ('NGO', 'Company', 'Community organisation', 'Government');
CREATE TYPE programme_status AS ENUM ('Open', 'Opening soon', 'Closed');

CREATE TABLE programmes (
  id                 TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]+$'),
  title              TEXT NOT NULL,
  sponsor_name       TEXT NOT NULL,
  sponsor_type       sponsor_type NOT NULL,
  description        TEXT NOT NULL,
  max_per_applicant  INTEGER NOT NULL CHECK (max_per_applicant > 0),
  total_seedlings    INTEGER NOT NULL CHECK (total_seedlings > 0),
  seedlings_claimed  INTEGER NOT NULL DEFAULT 0 CHECK (seedlings_claimed BETWEEN 0 AND total_seedlings),
  requirements       TEXT[] NOT NULL DEFAULT '{}',
  deadline           DATE NOT NULL,
  status             programme_status NOT NULL DEFAULT 'Open'
);

-- No rows means the programme is open to every district
CREATE TABLE programme_districts (
  programme_id  TEXT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  district_id   INTEGER NOT NULL REFERENCES districts(id),
  PRIMARY KEY (programme_id, district_id)
);

CREATE TABLE programme_species (
  programme_id  TEXT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  species_id    TEXT NOT NULL REFERENCES species(id),
  PRIMARY KEY (programme_id, species_id)
);

CREATE TABLE programme_collection_nurseries (
  programme_id  TEXT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  nursery_id    UUID NOT NULL REFERENCES nurseries(id),
  PRIMARY KEY (programme_id, nursery_id)
);

CREATE TYPE voucher_status AS ENUM ('issued', 'redeemed', 'cancelled');

CREATE TABLE vouchers (
  code                 TEXT PRIMARY KEY CHECK (code ~ '^NLV-[0-9]{3}-[0-9]{3}$'),
  programme_id         TEXT NOT NULL REFERENCES programmes(id),
  applicant_name       TEXT NOT NULL,
  phone                TEXT NOT NULL CHECK (phone ~ '^07[0-9]{8}$'),
  district_id          INTEGER NOT NULL REFERENCES districts(id),
  seedlings            INTEGER NOT NULL CHECK (seedlings > 0),
  status               voucher_status NOT NULL DEFAULT 'issued',
  issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at          TIMESTAMPTZ,
  redeemed_nursery_id  UUID REFERENCES nurseries(id),
  -- One application per phone number per programme
  UNIQUE (programme_id, phone),
  CHECK ((status = 'redeemed') = (redeemed_at IS NOT NULL))
);

-- ── Planting-gap data ──────────────────────────────────────

CREATE TABLE forest_loss_areas (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  district_id               INTEGER NOT NULL REFERENCES districts(id),
  location                  GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_km                 NUMERIC(5, 1) NOT NULL CHECK (radius_km > 0),
  forest_loss_ha            INTEGER NOT NULL CHECK (forest_loss_ha >= 0),
  drivers                   TEXT[] NOT NULL DEFAULT '{}',
  recommended_species_ids   TEXT[] NOT NULL DEFAULT '{}',
  is_illustrative           BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE district_demand (
  district_id      INTEGER PRIMARY KEY REFERENCES districts(id),
  annual_demand    INTEGER NOT NULL CHECK (annual_demand >= 0),
  forest_loss_ha   INTEGER NOT NULL CHECK (forest_loss_ha >= 0),
  is_illustrative  BOOLEAN NOT NULL DEFAULT true
);

-- ── Housekeeping ───────────────────────────────────────────

CREATE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nurseries_touch BEFORE UPDATE ON nurseries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER seedling_batches_touch BEFORE UPDATE ON seedling_batches FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER orders_touch BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER payments_touch BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
