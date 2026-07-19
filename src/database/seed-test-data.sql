-- =====================================================================
-- SEED: 10 test categories + 50 test products (with 4-language
-- translations: en / fr / ar / dr) and one external image per product.
--
-- Safe to run in the Supabase SQL editor. Idempotent on categories
-- (ON CONFLICT). Re-running the product block will insert 50 MORE
-- products, so only run the product section once.
--
-- NOTE: the `categories` table has no translation column in the schema,
-- so category names are stored in English only. Product names AND
-- descriptions are fully translated into the 4 supported locales.
-- Images use picsum.photos (deterministic per product id).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) REQUIRED TABLES (safe no-op if they already exist)
--    NOTE: your query returned no rows for categories/products, meaning
--    the schema was not applied on this database. This block creates
--    only the tables the seed needs. For the full schema (RLS, triggers,
--    orders, etc.) run src/database/schema.sql.
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  short_description text,
  description text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  discount_price numeric(10, 2) CHECK (discount_price >= 0),
  discount_percentage numeric(5, 2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT products_discount_exclusive CHECK (
    discount_price IS NULL OR discount_percentage IS NULL
  ),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text CHECK (status IN ('active', 'draft', 'archived')) DEFAULT 'draft',
  is_featured boolean DEFAULT false,
  colors jsonb DEFAULT NULL,
  sizes  jsonb DEFAULT NULL,
  translations jsonb DEFAULT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  storage_path text NOT NULL,
  is_main boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_main
  ON public.product_images (product_id)
  WHERE is_main = true;

-- ---------------------------------------------------------------------
-- 1) CATEGORIES (10)
-- ---------------------------------------------------------------------
INSERT INTO public.categories (name, slug)
SELECT name, slug FROM (VALUES
  ('Vitamins & Supplements', 'vitamins-supplements'),
  ('Skincare',               'skincare'),
  ('Hair Care',              'hair-care'),
  ('Sports Nutrition',       'sports-nutrition'),
  ('Herbal & Natural',       'herbal-natural'),
  ('Baby & Kids',            'baby-kids'),
  ('Personal Care',          'personal-care'),
  ('Home & Wellness',        'home-wellness'),
  ('Beauty & Makeup',        'beauty-makeup'),
  ('Superfoods',             'superfoods')
) AS t(name, slug)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) PRODUCTS (50 = 5 per category) + IMAGES
-- ---------------------------------------------------------------------
WITH cat_i18n(slug, noun_en, noun_fr, noun_ar, noun_dr) AS (
  VALUES
    ('vitamins-supplements', 'Vitamin',         'Vitamine',              'فيتامين',              'فيتامين'),
    ('skincare',             'Face Cream',       'Crème visage',          'كريم للوجه',           'كريم ديال الوجه'),
    ('hair-care',            'Hair Serum',       'Sérum capillaire',      'سيروم للشعر',          'سيروم ديال الشعر'),
    ('sports-nutrition',     'Protein Powder',   'Protéine en poudre',    'مسحوق بروتين',         'بودرة ديال البروتين'),
    ('herbal-natural',       'Herbal Extract',   'Extrait végétal',       'خلاصة عشبية',          'خلاصة ديال الأعشاب'),
    ('baby-kids',            'Baby Care',        'Soin bébé',             'عناية بالطفل',         'عناية ديال الدراري'),
    ('personal-care',        'Body Wash',        'Gel douche',            'غسول للجسم',           'غسول ديال الجسم'),
    ('home-wellness',        'Aroma Diffuser',   'Diffuseur d''arômes',   'موزّع عطري',           'ديفيزور ديال الريحة'),
    ('beauty-makeup',        'Lipstick',         'Rouge à lèvres',        'أحمر شفاه',            'روج ديال الشفاه'),
    ('superfoods',           'Superfood Blend',  'Mélange superaliment',  'خليط غذائي خارق',      'خليط ديال السوبرفود')
),
new_products AS (
  INSERT INTO public.products (
    category_id, name, short_description, description,
    price, discount_percentage, stock, status, is_featured, translations
  )
  SELECT
    c.id,
    -- base (English) columns
    'Premium ' || ci.noun_en || ' ' || n::text,
    'High-quality ' || ci.noun_en || ' for everyday use.',
    'This premium ' || ci.noun_en || ' is carefully formulated to deliver excellent results every day. Test product number ' || n::text || '.',
    round((49.99 + n * 20)::numeric, 2),
    CASE WHEN n % 2 = 0 THEN 15 ELSE NULL END,   -- 15% discount on even items
    25 + n * 3,
    'active',
    (n = 1),                                     -- first item of each category is featured
    jsonb_build_object(
      'en', jsonb_build_object(
        'name',              'Premium ' || ci.noun_en || ' ' || n::text,
        'short_description', 'High-quality ' || ci.noun_en || ' for everyday use.',
        'description',       'This premium ' || ci.noun_en || ' is carefully formulated to deliver excellent results every day. Test product number ' || n::text || '.'
      ),
      'fr', jsonb_build_object(
        'name',              ci.noun_fr || ' Premium ' || n::text,
        'short_description', ci.noun_fr || ' de haute qualité pour un usage quotidien.',
        'description',       'Ce ' || ci.noun_fr || ' premium est soigneusement formulé pour offrir d''excellents résultats chaque jour. Produit de test numéro ' || n::text || '.'
      ),
      'ar', jsonb_build_object(
        'name',              ci.noun_ar || ' ممتاز ' || n::text,
        'short_description', ci.noun_ar || ' عالي الجودة للاستعمال اليومي.',
        'description',       'هذا ' || ci.noun_ar || ' الممتاز مُصمَّم بعناية لتقديم نتائج رائعة كل يوم. منتج تجريبي رقم ' || n::text || '.'
      ),
      'dr', jsonb_build_object(
        'name',              ci.noun_dr || ' ممتاز ' || n::text,
        'short_description', ci.noun_dr || ' جودة عالية للاستعمال اليومي.',
        'description',       'هاد ' || ci.noun_dr || ' الممتاز مصايب بعناية باش يعطيك أحسن النتائج كل نهار. منتج ديال التجربة رقم ' || n::text || '.'
      )
    )
  FROM public.categories c
  JOIN cat_i18n ci ON ci.slug = c.slug
  CROSS JOIN generate_series(1, 5) AS n
  RETURNING id
)
INSERT INTO public.product_images (product_id, url, storage_path, is_main, display_order)
SELECT
  id,
  'https://picsum.photos/seed/' || id::text || '/600/600',
  'seed/' || id::text || '.jpg',
  true,
  0
FROM new_products;
