-- Clipzy: biblioteka materiałów marki/produktu — nagrania i ujęcia AI raz
-- przeanalizowane (lub wygenerowane) używa się w kolejnych sklejkach bez ponownych kosztów.
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

create table if not exists public.media_library (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id          uuid not null references public.brands (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  kind              text not null check (kind in ('clip', 'generated')),
  path              text not null,
  poster_path       text,
  name              text not null default '',
  meta              jsonb not null default '{}'::jsonb,
  analysis          jsonb,
  source_project_id uuid references public.clip_projects (id) on delete set null,
  uses              integer not null default 1,
  last_used_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (user_id, path)
);

create index if not exists media_library_brand_idx on public.media_library (user_id, brand_id, product_id, last_used_at desc);

alter table public.media_library enable row level security;
drop policy if exists "media_library: owner reads" on public.media_library;
create policy "media_library: owner reads"   on public.media_library for select using (user_id = auth.uid());
drop policy if exists "media_library: owner inserts" on public.media_library;
create policy "media_library: owner inserts" on public.media_library for insert with check (user_id = auth.uid());
drop policy if exists "media_library: owner updates" on public.media_library;
create policy "media_library: owner updates" on public.media_library for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "media_library: owner deletes" on public.media_library;
create policy "media_library: owner deletes" on public.media_library for delete using (user_id = auth.uid());

-- Plik w projekcie wie, z której pozycji biblioteki pochodzi.
alter table public.clip_assets add column if not exists library_id uuid references public.media_library (id) on delete set null;

-- Materiały z sklejek zrobionych przed tą migracją też trafiają do biblioteki.
insert into public.media_library (user_id, brand_id, product_id, kind, path, poster_path, name, meta, analysis, source_project_id, created_at)
select a.user_id, p.brand_id, p.product_id, a.kind, a.path, a.meta->>'poster', a.name, a.meta, a.analysis, a.project_id, a.created_at
from public.clip_assets a
join public.clip_projects p on p.id = a.project_id
where a.kind in ('clip', 'generated') and a.status = 'ready' and a.path is not null
on conflict (user_id, path) do nothing;

update public.clip_assets a
set library_id = l.id
from public.media_library l
where l.user_id = a.user_id and l.path = a.path and a.library_id is null and a.kind in ('clip', 'generated');
