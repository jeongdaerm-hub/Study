-- DaroCare initial schema. Run in Supabase SQL Editor after review.
-- No existing local device records are touched by this migration.
create table if not exists public.pets (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 100),
 species text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique (id, owner_id)
);
create table if not exists public.care_records (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 pet_id uuid not null,
 kind text not null,
 occurred_at timestamptz not null,
 amount numeric,
 note text,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 constraint care_records_owned_pet_fk foreign key (pet_id, owner_id)
   references public.pets(id, owner_id)
);
create table if not exists public.schedules (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 pet_id uuid not null,
 kind text not null,
 due_at timestamptz not null,
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 constraint schedules_owned_pet_fk foreign key (pet_id, owner_id)
   references public.pets(id, owner_id)
);
create index if not exists pets_owner_updated_idx on public.pets(owner_id, updated_at, id);
create index if not exists records_owner_updated_idx on public.care_records(owner_id, updated_at, id);
create index if not exists records_pet_time_idx on public.care_records(pet_id, occurred_at desc);
create index if not exists schedules_owner_updated_idx on public.schedules(owner_id, updated_at, id);
alter table public.pets enable row level security;
alter table public.care_records enable row level security;
alter table public.schedules enable row level security;
create policy "pets_owner_select" on public.pets for select to authenticated using ((select auth.uid()) = owner_id);
create policy "pets_owner_insert" on public.pets for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "pets_owner_update" on public.pets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "pets_owner_delete" on public.pets for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "records_owner_select" on public.care_records for select to authenticated using ((select auth.uid()) = owner_id);
create policy "records_owner_insert" on public.care_records for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "records_owner_update" on public.care_records for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "records_owner_delete" on public.care_records for delete to authenticated using ((select auth.uid()) = owner_id);
create policy "schedules_owner_select" on public.schedules for select to authenticated using ((select auth.uid()) = owner_id);
create policy "schedules_owner_insert" on public.schedules for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "schedules_owner_update" on public.schedules for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "schedules_owner_delete" on public.schedules for delete to authenticated using ((select auth.uid()) = owner_id);
-- Production hardening still required: immutable ownership/created_at, update timestamp trigger,
-- auth/RLS integration tests, storage policies, conflict handling and offline sync.
