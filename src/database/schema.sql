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

