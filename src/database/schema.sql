-- SQL snippet for manual Supabase execution (do not run via API route)
-- Schema Setup for E-commerce Platform
-- Last updated: 2026

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- USERS
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text UNIQUE NOT NULL,
  phone_number text,
  address text,
  city text,
  country text,
  role text CHECK (role IN ('client', 'admin')) DEFAULT 'client',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger: auto-insert user row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'client'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================
-- CATEGORIES
-- ========================
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================
-- PRODUCTS
-- ========================
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  -- Discount: set one or none. discount_price takes priority if both set.
  discount_price numeric(10, 2) CHECK (discount_price >= 0),
  discount_percentage numeric(5, 2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text CHECK (status IN ('active', 'draft', 'archived')) DEFAULT 'draft',
  is_featured boolean DEFAULT false,
  -- Variant options stored as JSON arrays
  colors jsonb DEFAULT NULL,  -- [{ "name": "Red", "hex": "#ff0000" }, ...]
  sizes  jsonb DEFAULT NULL,  -- ["S", "M", "L", "XL", ...]
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Run these on your existing Supabase database to add the new columns:
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors jsonb DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes  jsonb DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT NULL;

-- ========================
-- PRODUCT IMAGES
-- ========================
CREATE TABLE IF NOT EXISTS product_images (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,          -- full public URL
  storage_path text NOT NULL, -- Supabase Storage object path
  is_main boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enforce a single main image per product
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_main
  ON product_images (product_id)
  WHERE is_main = true;

-- ========================
-- ORDERS
-- ========================
CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  total_amount numeric(10, 2) NOT NULL,         -- always stored in MAD (base currency)
  currency_code text DEFAULT 'MAD',             -- customer-facing currency at order time
  exchange_rate numeric(12, 6) DEFAULT 1.0,     -- rate: 1 MAD → currency_code at order time
  shipping_address jsonb NOT NULL,              -- { full_name, phone, address, city, state, zip, country }
  cancelled_by text CHECK (cancelled_by IN ('customer', 'admin')) DEFAULT NULL,
  order_number BIGINT,                          -- 8-digit random app-generated ID shown to customers
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Run once to add columns to existing orders table (idempotent):
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency_code text DEFAULT 'MAD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 6) DEFAULT 1.0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by text CHECK (cancelled_by IN ('customer', 'admin')) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number BIGINT;
-- Update CHECK constraint to include 'confirmed' status (run once on existing DB):
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));
-- Backfill any NULL order_numbers and create unique index:
UPDATE orders SET order_number = floor(random() * 90000000 + 10000000)::bigint WHERE order_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_idx ON orders (order_number);

-- Run once to add city column to existing users table (idempotent):
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;

-- Run once: allow users to upsert their own profile row (needed for account settings save):
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can insert own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL
);

-- ========================
-- TRIGGER: updated_at
-- ========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ========================
-- ROW LEVEL SECURITY
-- ========================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON categories
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- Public can read active products; admins see everything
CREATE POLICY "Public reads active products" ON products
  FOR SELECT USING (
    status = 'active'
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins manage products" ON products
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product images visible with product" ON product_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_id
        AND (p.status = 'active'
          OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    )
  );
CREATE POLICY "Admins manage product images" ON product_images
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ========================
-- STORAGE BUCKET (run in Supabase Dashboard > Storage, or via SQL)
-- ========================
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('product-images', 'product-images', true)
--   ON CONFLICT (id) DO NOTHING;

-- Storage policies (create in Supabase Dashboard or add here):
-- CREATE POLICY "Public read product images" ON storage.objects
--   FOR SELECT USING (bucket_id = 'product-images');
-- CREATE POLICY "Admins upload product images" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'product-images'
--     AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
--   );
-- CREATE POLICY "Admins delete product images" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'product-images'
--     AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
--   );

-- ========================
-- ROW LEVEL SECURITY: Orders & Order Items
-- ========================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Authenticated users can view their own orders
CREATE POLICY "Users view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
-- Anyone can place an order (guest checkout: user_id may be null)
CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT WITH CHECK (true);
-- Admins can do everything (read, update status, etc.)
CREATE POLICY "Admins manage all orders" ON orders
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- Users can view items for their own orders
CREATE POLICY "Users view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
  );
-- Anyone can insert order items (mirrors the orders insert policy)
CREATE POLICY "Anyone can insert order items" ON order_items
  FOR INSERT WITH CHECK (true);
-- Admins can do everything
CREATE POLICY "Admins manage all order items" ON order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ========================
-- HERO SLIDES
-- ========================
CREATE TABLE IF NOT EXISTS hero_slides (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  image_url text NOT NULL,
  title text NOT NULL,
  cta_text text NOT NULL DEFAULT '',
  href text NOT NULL DEFAULT '/shop',   -- path without locale prefix (e.g. /shop)
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hero slides are public" ON hero_slides FOR SELECT USING (true);
CREATE POLICY "Admins manage hero slides" ON hero_slides
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ========================
-- ANNOUNCEMENT / PROMO BARS
-- ========================
-- Global storefront banners with full admin control:
--   • Multiple types: promotion / shipping / limited / social / notification
--   • Style: bg color, text color, font size, optional icon, optional border
--   • Behavior: position (top/bottom), sticky/static, scope (all/home), carousel
--   • Scheduling: start_at / end_at (auto-disable when expired)
--   • Priority ordering, dismissible flag, active flag
CREATE TABLE IF NOT EXISTS announcements (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Content
  type text NOT NULL DEFAULT 'notification'
    CHECK (type IN ('promotion', 'shipping', 'limited', 'social', 'notification', 'marquee')),
  text text NOT NULL DEFAULT '',
  icon_enabled boolean NOT NULL DEFAULT true,
  icon text,                                  -- e.g. 'megaphone' | 'truck' | 'clock' | 'bell' | 'whatsapp' | 'instagram'
  cta_text text,
  cta_href text,                              -- locale-less path (e.g. '/shop') or absolute URL

  -- Type-specific extras
  promo_code text,                            -- promotion: copy-able code
  social_whatsapp  text,                      -- social: WhatsApp number (no '+')
  social_facebook  text,                      -- social: Facebook page handle
  social_instagram text,                      -- social: Instagram handle
  social_tiktok    text,                      -- social: TikTok handle
  social_platforms text[] NOT NULL DEFAULT '{}'::text[],  -- enabled platform ids

  -- Marquee (scrolling banner) extras
  marquee_messages text[] NOT NULL DEFAULT '{}'::text[],     -- one or more messages to scroll
  marquee_speed integer NOT NULL DEFAULT 60                  -- pixels per second
    CHECK (marquee_speed >= 10 AND marquee_speed <= 400),
  marquee_direction text NOT NULL DEFAULT 'left'
    CHECK (marquee_direction IN ('left', 'right')),
  marquee_pause_on_hover boolean NOT NULL DEFAULT true,
  marquee_separator text NOT NULL DEFAULT '•',

  -- CTA / button display behavior (all types)
  cta_display_mode text NOT NULL DEFAULT 'swap'
    CHECK (cta_display_mode IN ('static', 'swap')),
  cta_swap_seconds integer NOT NULL DEFAULT 4
    CHECK (cta_swap_seconds >= 1 AND cta_swap_seconds <= 30),

  -- Style
  bg_color text NOT NULL DEFAULT '#111111',
  text_color text NOT NULL DEFAULT '#ffffff',
  font_size integer,                          -- px (10-24); null = default
  border_enabled boolean NOT NULL DEFAULT false,

  -- Behavior
  position text NOT NULL DEFAULT 'top'
    CHECK (position IN ('top', 'bottom')),
  behavior text NOT NULL DEFAULT 'sticky'
    CHECK (behavior IN ('static', 'sticky')),
  scope text NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all', 'home', 'product', 'cart', 'checkout', 'favorites', 'account', 'orders', 'order-confirmed', 'track-order', 'invoice', 'login', 'signup')),
  carousel_enabled boolean NOT NULL DEFAULT false,
  rotation_seconds integer NOT NULL DEFAULT 5
    CHECK (rotation_seconds >= 2 AND rotation_seconds <= 120),
  dismissible boolean NOT NULL DEFAULT true,

  -- Scheduling
  start_at timestamp with time zone,
  end_at   timestamp with time zone,

  -- Ordering & visibility
  priority integer NOT NULL DEFAULT 0,        -- lower = shown first
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance indexes for the public read path:
--   WHERE is_active = true
--     AND (start_at IS NULL OR start_at <= now())
--     AND (end_at   IS NULL OR end_at   >= now())
--   ORDER BY priority ASC, created_at ASC
CREATE INDEX IF NOT EXISTS announcements_active_priority_idx
  ON announcements (is_active, priority, created_at);
CREATE INDEX IF NOT EXISTS announcements_schedule_idx
  ON announcements (start_at, end_at)
  WHERE is_active = true;

-- Reuse the existing set_updated_at() trigger function
CREATE OR REPLACE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Idempotent column additions for existing installations (safe no-ops on fresh DBs).
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_facebook  text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_tiktok    text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_platforms text[] NOT NULL DEFAULT '{}'::text[];

-- Marquee additions (run on existing DBs to enable the scrolling-banner type)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_messages text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_speed integer NOT NULL DEFAULT 60;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_direction text NOT NULL DEFAULT 'left';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_pause_on_hover boolean NOT NULL DEFAULT true;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_separator text NOT NULL DEFAULT '•';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS marquee_scroll_mode text NOT NULL DEFAULT 'together'
  CHECK (marquee_scroll_mode IN ('together', 'individual'));

-- CTA swap behavior additions
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS cta_display_mode text NOT NULL DEFAULT 'swap'
  CHECK (cta_display_mode IN ('static', 'swap'));
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS cta_swap_seconds integer NOT NULL DEFAULT 4
  CHECK (cta_swap_seconds >= 1 AND cta_swap_seconds <= 30);

-- Carousel rotation speed (used by the global rotation-speed slider in the admin)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS rotation_seconds integer NOT NULL DEFAULT 5;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS carousel_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS dismissible boolean NOT NULL DEFAULT true;

-- Social announcement enhancements: custom button color, logo, business name, phone
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_btn_color text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_show_logo boolean NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_logo_url text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_show_name boolean NOT NULL DEFAULT false;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_business_name text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS social_show_phone boolean NOT NULL DEFAULT false;

-- Relax the type CHECK to include 'marquee' (drop+recreate; safe on fresh DBs too)
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_type_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_type_check
  CHECK (type IN ('promotion', 'shipping', 'limited', 'social', 'notification', 'marquee'));

-- Expand the scope CHECK to include all page-level scopes
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_scope_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_scope_check
  CHECK (scope IN ('all', 'home', 'product', 'cart', 'checkout', 'favorites', 'account', 'orders', 'order-confirmed', 'track-order', 'invoice', 'login', 'signup'));

-- Per-locale overrides for translatable text fields.
-- Shape: { "en": { "text": "...", "cta_text": "...", "marquee_messages": ["..."] }, "fr": {...}, ... }
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT NULL;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
-- Public can read only currently-active, in-schedule banners.
-- (Admins also covered by the broader admin policy below.)
CREATE POLICY "Public reads active announcements" ON announcements
  FOR SELECT USING (
    is_active = true
    AND (start_at IS NULL OR start_at <= timezone('utc'::text, now()))
    AND (end_at   IS NULL OR end_at   >= timezone('utc'::text, now()))
  );
CREATE POLICY "Admins manage announcements" ON announcements
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ========================================================================
-- ATOMIC FULL-REPLACE RPCs
-- ========================================================================
-- These functions wrap the DELETE-then-INSERT pattern used by the admin
-- "Save all" buttons in a single PL/pgSQL block. PostgreSQL runs every
-- top-level function call inside an implicit transaction, so a failure
-- partway through the INSERT automatically rolls back the DELETE — no
-- snapshot/restore dance required from the application layer.
--
-- They are SECURITY INVOKER (the default) so the caller's RLS policies
-- still apply. The admin routes call these via the session-aware
-- supabase server client, so only authenticated admins can mutate.
-- ========================================================================

-- Replace ALL hero_slides with the supplied JSON array.
-- Input shape: jsonb array of objects with keys
--   { image_url, title, cta_text, href, display_order, is_active }
CREATE OR REPLACE FUNCTION replace_hero_slides(p_slides jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_slides IS NULL OR jsonb_typeof(p_slides) <> 'array' THEN
    RAISE EXCEPTION 'p_slides must be a JSON array';
  END IF;

  DELETE FROM hero_slides;

  IF jsonb_array_length(p_slides) > 0 THEN
    INSERT INTO hero_slides (image_url, title, cta_text, href, display_order, is_active)
    SELECT
      COALESCE(item->>'image_url', ''),
      COALESCE(item->>'title', ''),
      COALESCE(item->>'cta_text', ''),
      COALESCE(item->>'href', '/shop'),
      COALESCE((item->>'display_order')::int, (idx - 1)::int),
      COALESCE((item->>'is_active')::boolean, true)
    FROM jsonb_array_elements(p_slides) WITH ORDINALITY AS t(item, idx);
  END IF;
END;
$$;

-- Replace ALL announcements with the supplied JSON array.
-- The admin route already sanitizes every field; this function trusts that
-- shape and just maps JSON keys → columns. Unknown / missing keys fall back
-- to the column defaults.
CREATE OR REPLACE FUNCTION replace_announcements(p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  DELETE FROM announcements;

  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO announcements (
      type, text, icon_enabled, icon,
      bg_color, text_color, font_size, border_enabled,
      cta_text, cta_href, promo_code,
      social_whatsapp, social_facebook, social_instagram, social_tiktok,
      social_platforms,
      marquee_messages, marquee_speed, marquee_direction,
      marquee_pause_on_hover, marquee_separator, marquee_scroll_mode,
      cta_display_mode, cta_swap_seconds,
      position, behavior, scope,
      carousel_enabled, rotation_seconds, dismissible,
      start_at, end_at, priority, is_active, translations
    )
    SELECT
      COALESCE(item->>'type', 'notification'),
      COALESCE(item->>'text', ''),
      COALESCE((item->>'icon_enabled')::boolean, true),
      NULLIF(item->>'icon', ''),
      COALESCE(item->>'bg_color', '#111111'),
      COALESCE(item->>'text_color', '#ffffff'),
      NULLIF(item->>'font_size', '')::int,
      COALESCE((item->>'border_enabled')::boolean, false),
      NULLIF(item->>'cta_text', ''),
      NULLIF(item->>'cta_href', ''),
      NULLIF(item->>'promo_code', ''),
      NULLIF(item->>'social_whatsapp', ''),
      NULLIF(item->>'social_facebook', ''),
      NULLIF(item->>'social_instagram', ''),
      NULLIF(item->>'social_tiktok', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'social_platforms', '[]'::jsonb))),
        '{}'::text[]
      ),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'marquee_messages', '[]'::jsonb))),
        '{}'::text[]
      ),
      COALESCE((item->>'marquee_speed')::int, 60),
      COALESCE(item->>'marquee_direction', 'left'),
      COALESCE((item->>'marquee_pause_on_hover')::boolean, true),
      COALESCE(item->>'marquee_separator', '•'),
      COALESCE(item->>'marquee_scroll_mode', 'together'),
      COALESCE(item->>'cta_display_mode', 'swap'),
      COALESCE((item->>'cta_swap_seconds')::int, 4),
      COALESCE(item->>'position', 'top'),
      COALESCE(item->>'behavior', 'sticky'),
      COALESCE(item->>'scope', 'all'),
      COALESCE((item->>'carousel_enabled')::boolean, false),
      COALESCE((item->>'rotation_seconds')::int, 5),
      COALESCE((item->>'dismissible')::boolean, true),
      NULLIF(item->>'start_at', '')::timestamptz,
      NULLIF(item->>'end_at', '')::timestamptz,
      COALESCE((item->>'priority')::int, (idx - 1)::int),
      COALESCE((item->>'is_active')::boolean, true),
      CASE WHEN item ? 'translations' AND jsonb_typeof(item->'translations') = 'object'
           THEN item->'translations'
           ELSE NULL
      END
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(item, idx);
  END IF;
END;
$$;

-- ========================================================================
-- DYNAMIC PRODUCT SECTIONS  (Product Page Builder)
-- ========================================================================
-- Two scopes:
--   1. GLOBAL DEFAULTS  → singleton row in `product_section_defaults`
--      stores the ordered list of section descriptors used by every
--      product whose `use_default_sections = true`.
--   2. PER-PRODUCT       → `products.sections_config` (jsonb) overrides
--      the defaults for a single product when `use_default_sections = false`.
--
-- A "section descriptor" is an object of shape:
--   {
--     "id": "uuid-or-slug",         -- stable client-generated id
--     "type": "description"|"gallery"|"specifications"|"shipping"
--           |"reviews"|"ratings"|"faq"|"rich_text"|"image_text"
--           |"video"|"banner"|"related_products"|"custom",
--     "enabled": true,
--     "order": 0,
--     "config":  { ... type-specific layout/style options ... },
--     "content": { ... type-specific content (title, body, items) ... },
--     "translations": { "en": { ...content overrides... }, "fr": {...}, ... }
--   }
--
-- The application layer owns validation (see product-sections module);
-- the DB only enforces shape (jsonb) and provides safe RPCs.
-- ========================================================================

-- Per-product columns. Defaults preserve backward compatibility:
--   • use_default_sections=true → product uses global defaults
--   • sections_config=null      → no overrides
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS use_default_sections boolean NOT NULL DEFAULT true;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sections_config jsonb DEFAULT NULL;

-- Singleton table holding the global default sections.
CREATE TABLE IF NOT EXISTS product_section_defaults (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed the singleton row if missing.
INSERT INTO product_section_defaults (sections)
SELECT '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM product_section_defaults);

ALTER TABLE product_section_defaults ENABLE ROW LEVEL SECURITY;

-- Public can read the singleton; admins can mutate.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_section_defaults' AND policyname = 'Section defaults are public') THEN
    EXECUTE 'CREATE POLICY "Section defaults are public" ON product_section_defaults FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_section_defaults' AND policyname = 'Admins manage section defaults') THEN
    EXECUTE 'CREATE POLICY "Admins manage section defaults" ON product_section_defaults FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin''))';
  END IF;
END $$;

-- Atomic upsert: replace the singleton row's sections array.
CREATE OR REPLACE FUNCTION replace_product_section_defaults(p_sections jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_sections IS NULL OR jsonb_typeof(p_sections) <> 'array' THEN
    RAISE EXCEPTION 'p_sections must be a JSON array';
  END IF;

  IF EXISTS (SELECT 1 FROM product_section_defaults) THEN
    UPDATE product_section_defaults
       SET sections = p_sections,
           updated_at = timezone('utc'::text, now());
  ELSE
    INSERT INTO product_section_defaults (sections) VALUES (p_sections);
  END IF;
END;
$$;

