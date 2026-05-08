-- Phase 3.4: per-user letter drafts.
--
-- Users open a master letter, the bracket replacer pre-fills identity
-- fields, then they edit and save. A draft per (user, letter_number)
-- holds the customized body. mailed_* and tracking_number are reserved
-- for Phase 3.5 (mail/track flow).

create extension if not exists "pgcrypto";

create table if not exists public.letter_drafts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  letter_number   integer not null,
  customized_body text not null,
  status          text not null default 'draft'
                  check (status in ('draft','finalized','sent')),
  mailed_at       timestamptz,
  mailed_to       text,
  tracking_number text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint letter_drafts_user_letter_unique unique (user_id, letter_number)
);

create index if not exists letter_drafts_user_idx
  on public.letter_drafts (user_id);
create index if not exists letter_drafts_letter_number_idx
  on public.letter_drafts (letter_number);

create or replace function public.letter_drafts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists letter_drafts_set_updated_at on public.letter_drafts;
create trigger letter_drafts_set_updated_at
before update on public.letter_drafts
for each row execute function public.letter_drafts_set_updated_at();

alter table public.letter_drafts enable row level security;

drop policy if exists "Users can select own drafts" on public.letter_drafts;
create policy "Users can select own drafts"
on public.letter_drafts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own drafts" on public.letter_drafts;
create policy "Users can insert own drafts"
on public.letter_drafts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own drafts" on public.letter_drafts;
create policy "Users can update own drafts"
on public.letter_drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own drafts" on public.letter_drafts;
create policy "Users can delete own drafts"
on public.letter_drafts
for delete
to authenticated
using (auth.uid() = user_id);
