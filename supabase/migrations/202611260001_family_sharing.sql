-- ─────────────────────────────────────────────────────────────
-- 다로 가족 공유 (Supabase SQL Editor 에 그대로 붙여넣어 실행)
--  · 가족(family) 단위로 반려동물 기록을 함께 봄
--  · 앱에는 공개 가능한 anon 키만. 모든 접근은 로그인 + RLS(행 단위 권한)
--  · 쓰기는 RPC(upsert_item) 로만 → 버전(rev) 검사로 '말없이 덮어쓰기' 방지
--  · 삭제는 tombstone(deleted=true) → 다른 폰도 삭제를 알 수 있음
-- ─────────────────────────────────────────────────────────────

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 한 사람은 한 가족에만 (unique user_id)
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- 초대 코드: 8자리, 24시간, 1회용
create table if not exists public.family_invites (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

create sequence if not exists public.items_seq;

-- 모든 기록(반려동물·진료·검사·접종·체중·생활일지·일정)을 한 표에 JSON 으로
create table if not exists public.items (
  family_id uuid not null references public.families(id) on delete cascade,
  collection text not null check (collection in ('pets','visits','labs','vaccines','weights','logs','schedules')),
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 65536),
  deleted boolean not null default false,
  rev bigint not null default 1,
  seq bigint not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (family_id, collection, id)
);
create index if not exists items_family_seq_idx on public.items (family_id, seq);

-- ── 권한 확인 함수 ──
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m where m.family_id = fid and m.user_id = (select auth.uid()));
$$;

create or replace function public.my_family_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.family_id from public.family_members m where m.user_id = (select auth.uid());
$$;

-- ── RLS: 읽기는 같은 가족만. 쓰기는 아래 RPC 로만 (직접 insert/update/delete 정책 없음) ──
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.items enable row level security;

drop policy if exists families_select on public.families;
create policy families_select on public.families for select to authenticated using (public.is_family_member(id));
drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members for select to authenticated using (public.is_family_member(family_id));
drop policy if exists items_select on public.items;
create policy items_select on public.items for select to authenticated using (public.is_family_member(family_id));
-- family_invites: 정책 없음 = 직접 조회 불가 (코드 목록 유출 방지)

revoke all on public.families, public.family_members, public.family_invites, public.items from anon, authenticated;
grant select on public.families, public.family_members, public.items to authenticated;

-- ── RPC ──
create or replace function public.create_family(family_name text, my_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); fid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.family_members where user_id = uid) then raise exception 'already_in_family'; end if;
  insert into public.families (name, created_by) values (trim(family_name), uid) returning id into fid;
  insert into public.family_members (family_id, user_id, role, display_name) values (fid, uid, 'owner', trim(my_name));
  return fid;
end $$;

create or replace function public.create_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); fid uuid; c text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
begin
  select family_id into fid from public.family_members where user_id = uid;
  if fid is null then raise exception 'not_in_family'; end if;
  -- 쓰지 않은 초대는 가족당 최대 5개
  delete from public.family_invites where family_id = fid and (expires_at < now() or used_by is not null);
  if (select count(*) from public.family_invites where family_id = fid) >= 5 then raise exception 'too_many_invites'; end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := '';
    for i in 0..7 loop c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.family_invites where code = c);
  end loop;
  insert into public.family_invites (code, family_id, created_by, expires_at) values (c, fid, uid, now() + interval '24 hours');
  return c;
end $$;

create or replace function public.join_family(invite_code text, my_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); inv public.family_invites;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.family_members where user_id = uid) then raise exception 'already_in_family'; end if;
  select * into inv from public.family_invites where code = upper(trim(invite_code)) for update;
  if inv.code is null or inv.used_by is not null or inv.expires_at < now() then raise exception 'invalid_invite'; end if;
  if (select count(*) from public.family_members where family_id = inv.family_id) >= 10 then raise exception 'family_full'; end if;
  update public.family_invites set used_by = uid, used_at = now() where code = inv.code;
  insert into public.family_members (family_id, user_id, role, display_name) values (inv.family_id, uid, 'member', trim(my_name));
  return inv.family_id;
end $$;

-- 가족 나가기: 마지막 사람이 나가면 가족과 기록 전체 삭제, 방장이 나가면 가장 오래된 사람이 방장
create or replace function public.leave_family()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); me public.family_members; heir uuid;
begin
  select * into me from public.family_members where user_id = uid;
  if me.user_id is null then return; end if;
  delete from public.family_members where user_id = uid;
  if not exists (select 1 from public.family_members where family_id = me.family_id) then
    delete from public.families where id = me.family_id;
  elsif me.role = 'owner' then
    select user_id into heir from public.family_members where family_id = me.family_id order by joined_at limit 1;
    update public.family_members set role = 'owner' where user_id = heir;
  end if;
end $$;

-- 기록 쓰기: base_rev 가 서버의 rev 와 같을 때만 (아니면 충돌 → 서버 값 반환)
create or replace function public.upsert_item(p_collection text, p_id text, p_data jsonb, p_deleted boolean, p_base_rev bigint)
returns table (status text, rev bigint, seq bigint, data jsonb, deleted boolean, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare uid uuid := (select auth.uid()); fid uuid; cur public.items;
begin
  select m.family_id into fid from public.family_members m where m.user_id = uid;
  if fid is null then raise exception 'not_in_family'; end if;
  select * into cur from public.items i where i.family_id = fid and i.collection = p_collection and i.id = p_id for update;
  if cur.id is null then
    -- 서버에 없는 항목 삭제 = 할 일 없음
    if p_deleted then
      return query select 'ok'::text, 0::bigint, 0::bigint, p_data, true, now(); return;
    end if;
    insert into public.items (family_id, collection, id, data, deleted, rev, seq, updated_by)
      values (fid, p_collection, p_id, coalesce(p_data, '{}'::jsonb), p_deleted, 1, nextval('public.items_seq'), uid)
      returning 'ok'::text, items.rev, items.seq, items.data, items.deleted, items.updated_at into status, rev, seq, data, deleted, updated_at;
    return next; return;
  end if;
  if cur.rev <> p_base_rev then
    return query select 'conflict'::text, cur.rev, cur.seq, cur.data, cur.deleted, cur.updated_at; return;
  end if;
  update public.items i set data = coalesce(p_data, i.data), deleted = p_deleted, rev = i.rev + 1,
      seq = nextval('public.items_seq'), updated_at = now(), updated_by = uid
    where i.family_id = fid and i.collection = p_collection and i.id = p_id
    returning 'ok'::text, i.rev, i.seq, i.data, i.deleted, i.updated_at into status, rev, seq, data, deleted, updated_at;
  return next;
end $$;

revoke all on function public.create_family(text, text), public.create_invite(), public.join_family(text, text),
  public.leave_family(), public.upsert_item(text, text, jsonb, boolean, bigint),
  public.is_family_member(uuid), public.my_family_id() from public, anon;
grant execute on function public.create_family(text, text), public.create_invite(), public.join_family(text, text),
  public.leave_family(), public.upsert_item(text, text, jsonb, boolean, bigint),
  public.is_family_member(uuid), public.my_family_id() to authenticated;
