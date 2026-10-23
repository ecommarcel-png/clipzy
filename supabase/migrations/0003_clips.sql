-- Clipzy: moduł sklejek (projekty, pliki projektu) + wideo i audio w magazynie.
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

-- Magazyn: oprócz zdjęć także nagrania, lektor i gotowe filmy.
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm'
]
where id = 'media';

-- Projekt sklejki: ustawienia, lektor, plan Reżysera, kontrola, feedback.
create table if not exists public.clip_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id    uuid not null references public.brands (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  name        text not null default '',
  status      text not null default 'draft',
  settings    jsonb not null default '{}'::jsonb,
  voiceover   jsonb,
  plan        jsonb,
  review      jsonb,
  feedback    jsonb not null default '[]'::jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clip_projects_user_idx on public.clip_projects (user_id, created_at desc);

create trigger clip_projects_updated_at before update on public.clip_projects
  for each row execute function public.set_updated_at();

alter table public.clip_projects enable row level security;
create policy "clip_projects: owner reads"   on public.clip_projects for select using (user_id = auth.uid());
create policy "clip_projects: owner inserts" on public.clip_projects for insert with check (user_id = auth.uid());
create policy "clip_projects: owner updates" on public.clip_projects for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_projects: owner deletes" on public.clip_projects for delete using (user_id = auth.uid());

-- Pliki projektu: nagrania, lektor, ujęcia wygenerowane przez AI, gotowe rendery.
-- Osobne wiersze, bo kilka analiz biegnie równolegle.
create table if not exists public.clip_assets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid not null references public.clip_projects (id) on delete cascade,
  kind        text not null check (kind in ('clip', 'voiceover', 'generated', 'render')),
  path        text,
  name        text not null default '',
  status      text not null default 'uploaded',
  meta        jsonb not null default '{}'::jsonb,
  analysis    jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clip_assets_project_idx on public.clip_assets (project_id, created_at);

create trigger clip_assets_updated_at before update on public.clip_assets
  for each row execute function public.set_updated_at();

alter table public.clip_assets enable row level security;
create policy "clip_assets: owner reads"   on public.clip_assets for select using (user_id = auth.uid());
create policy "clip_assets: owner inserts" on public.clip_assets for insert with check (user_id = auth.uid());
create policy "clip_assets: owner updates" on public.clip_assets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "clip_assets: owner deletes" on public.clip_assets for delete using (user_id = auth.uid());
