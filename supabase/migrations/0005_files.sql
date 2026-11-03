-- Clipzy: „Twoje pliki” — archiwum gotowych reklam ze wszystkich narzędzi.
-- Plik zostaje po usunięciu sklejki lub marki (nazwy marki/produktu zapamiętane w meta).
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

create table if not exists public.ad_files (
  id          uuid primary key,  -- to samo id co render w clip_assets
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  brand_id    uuid references public.brands (id) on delete set null,
  product_id  uuid references public.products (id) on delete set null,
  project_id  uuid references public.clip_projects (id) on delete set null,
  tool        text not null default 'sklejki',
  kind        text not null default 'video' check (kind in ('video', 'image')),
  path        text not null,
  name        text not null default '',
  format      text,
  variant     integer,
  meta        jsonb not null default '{}'::jsonb,
  review      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ad_files_user_idx on public.ad_files (user_id, created_at desc);
create index if not exists ad_files_path_idx on public.ad_files (path);

drop trigger if exists ad_files_updated_at on public.ad_files;
create trigger ad_files_updated_at before update on public.ad_files
  for each row execute function public.set_updated_at();

alter table public.ad_files enable row level security;
drop policy if exists "ad_files: owner reads" on public.ad_files;
create policy "ad_files: owner reads"   on public.ad_files for select using (user_id = auth.uid());
drop policy if exists "ad_files: owner inserts" on public.ad_files;
create policy "ad_files: owner inserts" on public.ad_files for insert with check (user_id = auth.uid());
drop policy if exists "ad_files: owner updates" on public.ad_files;
create policy "ad_files: owner updates" on public.ad_files for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ad_files: owner deletes" on public.ad_files;
create policy "ad_files: owner deletes" on public.ad_files for delete using (user_id = auth.uid());

-- Rendery zrobione przed tą migracją też trafiają do archiwum.
insert into public.ad_files (id, user_id, brand_id, product_id, project_id, path, name, format, variant, meta, review, created_at)
select
  a.id, a.user_id, p.brand_id, p.product_id, a.project_id, a.path,
  concat_ws(' · ', coalesce(nullif(pr.name, ''), b.name), replace(coalesce(a.meta->>'format', ''), 'x', ':'), case when a.meta ? 'variant' then 'hook ' || (a.meta->>'variant') end),
  a.meta->>'format',
  nullif(a.meta->>'variant', '')::integer,
  jsonb_build_object('brand_name', b.name, 'product_name', pr.name, 'project_name', p.name),
  a.analysis,
  a.created_at
from public.clip_assets a
join public.clip_projects p on p.id = a.project_id
join public.brands b on b.id = p.brand_id
left join public.products pr on pr.id = p.product_id
where a.kind = 'render' and a.path is not null
on conflict (id) do nothing;
