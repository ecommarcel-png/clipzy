-- Clipzy: ad copy do gotowych kreacji (Gemini ogląda kreację, Claude pisze tekst główny, nagłówek i opis).
-- Kreacje wgrane tutaj albo wybrane z „Twoich plików” (wtedy copy zapisuje się też przy pliku).
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

create table if not exists public.copy_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id    uuid references public.brands (id) on delete set null,
  product_id  uuid references public.products (id) on delete set null,
  file_id     uuid references public.ad_files (id) on delete set null,
  name        text not null default '',
  path        text not null,
  kind        text not null default 'video',
  note        text not null default '',
  stage       text not null default 'analyze',
  analysis    jsonb,
  copy        jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists copy_items_user_idx on public.copy_items (user_id, created_at desc);

drop trigger if exists copy_items_updated_at on public.copy_items;
create trigger copy_items_updated_at before update on public.copy_items
  for each row execute function public.set_updated_at();

alter table public.copy_items enable row level security;
drop policy if exists "copy_items: owner reads" on public.copy_items;
create policy "copy_items: owner reads"   on public.copy_items for select using (user_id = auth.uid());
drop policy if exists "copy_items: owner inserts" on public.copy_items;
create policy "copy_items: owner inserts" on public.copy_items for insert with check (user_id = auth.uid());
drop policy if exists "copy_items: owner updates" on public.copy_items;
create policy "copy_items: owner updates" on public.copy_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "copy_items: owner deletes" on public.copy_items;
create policy "copy_items: owner deletes" on public.copy_items for delete using (user_id = auth.uid());
