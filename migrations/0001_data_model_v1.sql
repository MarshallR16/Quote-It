-- =====================================================
-- Quote-IT data model v1
--
-- Adds:
--   - quotes.posted_for_week_id (text, NOT NULL after backfill)
--   - quotes.rolled_over_from_week_id (text, nullable)
--   - quotes_week_score_idx, quotes_author_idx
--   - votes uniq_votes_quote_user
--   - weekly_winners.week_id (text, unique, NOT NULL after backfill)
--   - weekly_winners.winner_user_id (varchar, NOT NULL after backfill)
--   - product_variant enum ('white' | 'black' | 'gold_winner')
--   - products.variant (NOT NULL after backfill), products.is_exclusive
--   - prize_status enum ('unclaimed' | 'claimed' | 'expired')
--   - prizes table
--   - comments + comment_votes tables
--   - orders.is_prize_fulfillment (replaces is_complimentary)
--
-- Migrates:
--   - existing complimentary orders -> prizes rows; drops is_complimentary
--
-- Wrapped in a single transaction so partial failure is recoverable.
-- =====================================================

BEGIN;

-- Pin session timezone for the duration of this migration so the ISO-week
-- backfills (`to_char(..., 'IYYY"-W"IW')`) match the app-side `isoWeekId()`
-- helper, which always uses UTC. SET LOCAL is reverted at COMMIT.
SET LOCAL TIME ZONE 'UTC';

-- -----------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------

CREATE TYPE product_variant AS ENUM ('white', 'black', 'gold_winner');
CREATE TYPE prize_status AS ENUM ('unclaimed', 'claimed', 'expired');

-- -----------------------------------------------------
-- 2. quotes: week tracking
-- -----------------------------------------------------

ALTER TABLE quotes
  ADD COLUMN posted_for_week_id text,
  ADD COLUMN rolled_over_from_week_id text;

-- Backfill from created_at using ISO week: e.g. "2026-W18"
UPDATE quotes SET posted_for_week_id = to_char(created_at, 'IYYY"-W"IW');

ALTER TABLE quotes ALTER COLUMN posted_for_week_id SET NOT NULL;

CREATE INDEX quotes_week_score_idx ON quotes (posted_for_week_id, vote_count DESC);
CREATE INDEX quotes_author_idx ON quotes (author_id);

-- -----------------------------------------------------
-- 3. votes: enforce one vote per (quote, user)
-- -----------------------------------------------------

-- Defensive: collapse any duplicate (quote_id, user_id) rows that may exist
-- in dev/staging. Production should already be unique - this is a no-op there.
DELETE FROM votes a
USING votes b
WHERE a.id < b.id
  AND a.quote_id = b.quote_id
  AND a.user_id = b.user_id;

CREATE UNIQUE INDEX uniq_votes_quote_user ON votes (quote_id, user_id);

-- -----------------------------------------------------
-- 4. weekly_winners: stable week_id + denormalized author
-- -----------------------------------------------------

ALTER TABLE weekly_winners
  ADD COLUMN week_id text,
  ADD COLUMN winner_user_id varchar REFERENCES users(id);

UPDATE weekly_winners
SET week_id = to_char(week_start_date, 'IYYY"-W"IW');

UPDATE weekly_winners w
SET winner_user_id = q.author_id
FROM quotes q
WHERE q.id = w.quote_id
  AND w.winner_user_id IS NULL;

ALTER TABLE weekly_winners
  ALTER COLUMN week_id SET NOT NULL,
  ALTER COLUMN winner_user_id SET NOT NULL,
  ADD CONSTRAINT weekly_winners_week_id_unique UNIQUE (week_id);

-- -----------------------------------------------------
-- 5. products: variant enum + is_exclusive
-- -----------------------------------------------------

ALTER TABLE products
  ADD COLUMN variant product_variant,
  ADD COLUMN is_exclusive boolean NOT NULL DEFAULT false;

-- Map existing products by name. The current code creates products with
-- " (Winner's Gold Edition)" suffix for gold tees, "Gold Edition" elsewhere,
-- and white variants for everything else. No 'black' producer exists yet.
UPDATE products SET variant = 'gold_winner' WHERE name ILIKE '%gold%edition%' OR name ILIKE '%gold edition%';
UPDATE products SET variant = 'white' WHERE variant IS NULL;

UPDATE products SET is_exclusive = true WHERE variant = 'gold_winner';

ALTER TABLE products ALTER COLUMN variant SET NOT NULL;

CREATE INDEX products_weekly_winner_idx ON products (weekly_winner_id);

-- -----------------------------------------------------
-- 6. prizes
-- -----------------------------------------------------

CREATE TABLE prizes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_winner_id varchar NOT NULL REFERENCES weekly_winners(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id varchar NOT NULL REFERENCES products(id),
  status prize_status NOT NULL DEFAULT 'unclaimed',
  expires_at timestamp NOT NULL,
  claimed_at timestamp,
  order_id varchar REFERENCES orders(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_prizes_weekly_winner ON prizes (weekly_winner_id);
CREATE INDEX prizes_user_idx ON prizes (user_id);
CREATE INDEX prizes_status_expiry_idx ON prizes (status, expires_at);

-- -----------------------------------------------------
-- 7. orders: is_prize_fulfillment replaces is_complimentary
-- -----------------------------------------------------

ALTER TABLE orders ADD COLUMN is_prize_fulfillment boolean NOT NULL DEFAULT false;

-- Carry over the flag for existing rows so historical lookups still work.
UPDATE orders SET is_prize_fulfillment = true WHERE is_complimentary = true;

-- -----------------------------------------------------
-- 8. Migrate existing complimentary orders -> prizes
--
-- Strategy:
--   - completed comp orders: create a 'claimed' prize linked to the existing order
--   - awaiting_address / failed / printful_error / pending comp orders:
--     create a 'unclaimed' or 'expired' prize and DELETE the order row
--     (they were placeholders, not real fulfillments)
-- -----------------------------------------------------

-- 8a. completed comp orders -> claimed prizes (preserve order)
INSERT INTO prizes (weekly_winner_id, user_id, product_id, status, expires_at, claimed_at, order_id, created_at)
SELECT
  p.weekly_winner_id,
  o.user_id,
  o.product_id,
  'claimed'::prize_status,
  o.created_at + interval '14 days',
  o.created_at,
  o.id,
  o.created_at
FROM orders o
JOIN products p ON p.id = o.product_id
WHERE o.is_complimentary = true
  AND o.status = 'completed'
  AND p.weekly_winner_id IS NOT NULL
ON CONFLICT (weekly_winner_id) DO NOTHING;

-- 8b. unfulfilled comp orders -> unclaimed/expired prizes; delete the orders
WITH unfulfilled AS (
  SELECT
    o.id AS order_id,
    o.user_id,
    o.product_id,
    o.created_at,
    p.weekly_winner_id
  FROM orders o
  JOIN products p ON p.id = o.product_id
  WHERE o.is_complimentary = true
    AND o.status <> 'completed'
    AND p.weekly_winner_id IS NOT NULL
)
INSERT INTO prizes (weekly_winner_id, user_id, product_id, status, expires_at, created_at)
SELECT
  weekly_winner_id,
  user_id,
  product_id,
  CASE WHEN created_at + interval '14 days' < now() THEN 'expired'::prize_status
       ELSE 'unclaimed'::prize_status
  END,
  created_at + interval '14 days',
  created_at
FROM unfulfilled
ON CONFLICT (weekly_winner_id) DO NOTHING;

DELETE FROM orders
WHERE is_complimentary = true
  AND status <> 'completed';

-- 8c. drop the old flag now that data has migrated
ALTER TABLE orders DROP COLUMN is_complimentary;

-- -----------------------------------------------------
-- 9. comments
-- -----------------------------------------------------

CREATE TABLE comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id varchar NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  edited_at timestamp,
  deleted_at timestamp
);

CREATE INDEX comments_quote_created_idx ON comments (quote_id, created_at DESC);

-- -----------------------------------------------------
-- 10. comment_votes
-- -----------------------------------------------------

CREATE TABLE comment_votes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id varchar NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_comment_votes_comment_user ON comment_votes (comment_id, user_id);

COMMIT;
