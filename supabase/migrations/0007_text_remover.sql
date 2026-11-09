-- Clipzy: usuwanie napisów z filmów (Gemini wykrywa napisy, fal.ai VOID je zamalowuje).
-- Gotowe filmy trafiają do „Twoich plików” (ad_files, migracja 0005).
-- Uruchom raz w Supabase: SQL Editor -> wklej -> Run.

create table if not exists public.text_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default '',
  src_path    text not null,
  stage       text not null default 'detect',
  info        jsonb not null default '{}'::jsonb,
  plan        jsonb not null default '{}'::jsonb,
  out_path    text,
  file_id     uuid,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists text_jobs_user_idx on public.text_jobs (user_id, created_at desc);

drop trigger if exists text_jobs_updated_at on public.text_jobs;
create trigger text_jobs_updated_at before update on public.text_jobs
  for each row execute function public.set_updated_at();

alter table public.text_jobs enable row level security;
drop policy if exists "text_jobs: owner reads" on public.text_jobs;
create policy "text_jobs: owner reads"   on public.text_jobs for select using (user_id = auth.uid());
drop policy if exists "text_jobs: owner inserts" on public.text_jobs;
create policy "text_jobs: owner inserts" on public.text_jobs for insert with check (user_id = auth.uid());
drop policy if exists "text_jobs: owner updates" on public.text_jobs;
create policy "text_jobs: owner updates" on public.text_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "text_jobs: owner deletes" on public.text_jobs;
create policy "text_jobs: owner deletes" on public.text_jobs for delete using (user_id = auth.uid());
