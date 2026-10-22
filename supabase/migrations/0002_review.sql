-- Clipzy: results of the independent quality check (Kontroler) on profiles.
-- Run once in Supabase → SQL Editor after 0001_init.sql.

alter table public.brands   add column if not exists review jsonb;
alter table public.products add column if not exists review jsonb;
