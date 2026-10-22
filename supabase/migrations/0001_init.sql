-- Clipzy: initial schema.
-- Run once in Supabase → SQL Editor (or with `supabase db push`).
-- Every table is owned by a user and protected by row level security:
-- a signed-in user can only see and change their own rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- API keys (encrypted by the app server with AES-256-GCM; the database never
-- sees a plaintext key). One key per provider per user.
-- ---------------------------------------------------------------------------

create table public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider    text not null check (provider in ('anthropic', 'gemini', 'fal', 'elevenlabs')),
  ciphertext  text not null,
  last4       text not null,
  status      text not null default 'untested' check (status in ('untested', 'ok', 'invalid', 'error')),
  status_note text,
  tested_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

create policy "api_keys: owner reads"   on public.api_keys for select using (user_id = auth.uid());
create policy "api_keys: owner inserts" on public.api_keys for insert with check (user_id = auth.uid());
create policy "api_keys: owner updates" on public.api_keys for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "api_keys: owner deletes" on public.api_keys for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Brands
-- profile   = the brand profile the models work from (see src/lib/brand-profile.ts)
-- questions = open follow-up questions from Claude during setup
-- source    = what was scraped from the website (kept for reference/re-analysis)
-- ---------------------------------------------------------------------------

create table public.brands (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  website_url  text,
  status       text not null default 'draft' check (status in ('draft', 'ready')),
  logo_path    text,
  profile      jsonb not null default '{}'::jsonb,
  questions    jsonb not null default '[]'::jsonb,
  completeness smallint not null default 0 check (completeness between 0 and 100),
  summary      text not null default '',
  source       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index brands_user_id_idx on public.brands (user_id, created_at desc);

create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

create policy "brands: owner reads"   on public.brands for select using (user_id = auth.uid());
create policy "brands: owner inserts" on public.brands for insert with check (user_id = auth.uid());
create policy "brands: owner updates" on public.brands for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "brands: owner deletes" on public.brands for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Products (belong to a brand)
-- ---------------------------------------------------------------------------

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id     uuid not null references public.brands (id) on delete cascade,
  name         text not null,
  product_url  text,
  status       text not null default 'draft' check (status in ('draft', 'ready')),
  profile      jsonb not null default '{}'::jsonb,
  questions    jsonb not null default '[]'::jsonb,
  completeness smallint not null default 0 check (completeness between 0 and 100),
  summary      text not null default '',
  source       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_brand_id_idx on public.products (brand_id, created_at desc);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "products: owner reads" on public.products for select using (user_id = auth.uid());
-- Inserting/moving a product also requires owning the target brand.
create policy "products: owner inserts" on public.products for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid())
);
create policy "products: owner updates" on public.products for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.brands b where b.id = brand_id and b.user_id = auth.uid())
);
create policy "products: owner deletes" on public.products for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Product images (files live in the private `media` storage bucket)
-- ---------------------------------------------------------------------------

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  source_url   text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

create policy "product_images: owner reads" on public.product_images for select using (user_id = auth.uid());
create policy "product_images: owner inserts" on public.product_images for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
);
create policy "product_images: owner updates" on public.product_images for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from public.products p where p.id = product_id and p.user_id = auth.uid())
);
create policy "product_images: owner deletes" on public.product_images for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: one private bucket. Every object path starts with the owner's
-- user id: <user_id>/brands/<brand_id>/... or <user_id>/products/<product_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']
)
on conflict (id) do nothing;

create policy "media: owner reads" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media: owner uploads" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media: owner updates" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media: owner deletes" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
