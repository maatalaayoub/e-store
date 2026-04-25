-- SQL snippet for manual Supabase execution (do not run via API route)
-- Schema Setup for E-commerce Platform

CREATE TABLE if not exists users (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text unique not null,
  phone_number text,
  address text,
  role text check (role in ('client', 'admin')) default 'client',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to automatically add new signups (Email, Google, Facebook) to the users table
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

CREATE TABLE if not exists categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE if not exists products (
  id uuid default uuid_generate_v4() primary key,
  category_id uuid references categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_urls text[], -- Supabase storage paths
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete restrict,
  status text check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')) default 'pending',
  total_amount numeric(10, 2) not null,
  shipping_address jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE if not exists order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null
);

-- Basic RLS for products (Public read, authenticated Admin write)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." 
  ON products FOR SELECT USING (true);
  
-- Assume an "admin" role or metadata approach for actual insert/update policy
