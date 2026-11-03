-- Clipzy: image ads — zestawy reklam graficznych (1:1 + 9:16 + copy).
-- Gotowe grafiki trafiają też do „Twoich plików” (ad_files, migracja 0005).
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

create table if not exists public.image_ad_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id    uuid not null references public.brands (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  name        text not null default '',
  count       integer not null default 10 check (count between 1 and 20),
  status      text not null default 'running',
  settings    jsonb not null default '{}'::jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists image_ad_sets_user_idx on public.image_ad_sets (user_id, created_at desc);

drop trigger if exists image_ad_sets_updated_at on public.image_ad_sets;
create trigger image_ad_sets_updated_at before update on public.image_ad_sets
  for each row execute function public.set_updated_at();

alter table public.image_ad_sets enable row level security;
drop policy if exists "image_ad_sets: owner reads" on public.image_ad_sets;
create policy "image_ad_sets: owner reads"   on public.image_ad_sets for select using (user_id = auth.uid());
drop policy if exists "image_ad_sets: owner inserts" on public.image_ad_sets;
create policy "image_ad_sets: owner inserts" on public.image_ad_sets for insert with check (user_id = auth.uid());
drop policy if exists "image_ad_sets: owner updates" on public.image_ad_sets;
create policy "image_ad_sets: owner updates" on public.image_ad_sets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "image_ad_sets: owner deletes" on public.image_ad_sets;
create policy "image_ad_sets: owner deletes" on public.image_ad_sets for delete using (user_id = auth.uid());

-- Jedna kreacja: koncept Stratega, copy, pola szablonu, zdjęcia z fal, rendery, oceny Kontrolera.
create table if not exists public.image_ads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id      uuid not null references public.image_ad_sets (id) on delete cascade,
  idx         integer not null default 0,
  stage       text not null default 'copy',
  template    text not null,
  concept     jsonb not null default '{}'::jsonb,
  copy        jsonb,
  fields      jsonb,
  style       jsonb,
  photos      jsonb not null default '[]'::jsonb,
  renders     jsonb not null default '{}'::jsonb,
  review      jsonb,
  round       integer not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists image_ads_set_idx on public.image_ads (set_id, idx);

drop trigger if exists image_ads_updated_at on public.image_ads;
create trigger image_ads_updated_at before update on public.image_ads
  for each row execute function public.set_updated_at();

alter table public.image_ads enable row level security;
drop policy if exists "image_ads: owner reads" on public.image_ads;
create policy "image_ads: owner reads"   on public.image_ads for select using (user_id = auth.uid());
drop policy if exists "image_ads: owner inserts" on public.image_ads;
create policy "image_ads: owner inserts" on public.image_ads for insert with check (user_id = auth.uid());
drop policy if exists "image_ads: owner updates" on public.image_ads;
create policy "image_ads: owner updates" on public.image_ads for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "image_ads: owner deletes" on public.image_ads;
create policy "image_ads: owner deletes" on public.image_ads for delete using (user_id = auth.uid());

-- „Twoje pliki”: grafika wie, z którego zestawu pochodzi (zestaw usunięty — plik zostaje).
alter table public.ad_files add column if not exists image_set_id uuid references public.image_ad_sets (id) on delete set null;
