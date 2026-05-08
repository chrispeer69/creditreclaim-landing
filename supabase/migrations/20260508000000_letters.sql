-- Phase 3.1: Letter library table.
--
-- The letter library is a single shared catalog (currently 105 letters,
-- grows over time per HERO_DASHBOARD_VISION.md "Letter Library — Living
-- Document"). Every authenticated user reads the same rows; no per-user
-- copies, no user-authored letters. Writes happen only via the
-- service-role-keyed seed script and (later) the Phase 9 admin panel.

create extension if not exists "pgcrypto";

create table if not exists public.letters (
  id              uuid primary key default gen_random_uuid(),
  number          integer not null unique,
  stage           text not null,
  category        text not null,
  title           text not null,
  when_to_use     text not null,
  why_it_works    text not null,
  how_to_use      text not null,
  template_body   text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists letters_number_idx   on public.letters (number);
create index if not exists letters_stage_idx    on public.letters (stage);
create index if not exists letters_category_idx on public.letters (category);

-- Keep updated_at fresh on every UPDATE (e.g. when the seed script re-runs).
create or replace function public.letters_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists letters_set_updated_at on public.letters;
create trigger letters_set_updated_at
before update on public.letters
for each row execute function public.letters_set_updated_at();

-- RLS: read-only. The library is shared template content (not user data),
-- so we grant SELECT to anon + authenticated so server components can
-- fetch without a session token. Route-level auth (the /dashboard prefix)
-- already gates who reaches the page. No INSERT/UPDATE/DELETE policies —
-- service role bypasses RLS so the seed script writes fine, and no end
-- user can mutate the library.
alter table public.letters enable row level security;

drop policy if exists "letters readable by everyone" on public.letters;
create policy "letters readable by everyone"
on public.letters
for select
to anon, authenticated
using (true);
