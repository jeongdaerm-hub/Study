-- 가족 공유 권한 테스트 (로컬 Postgres). 실패하면 ERROR 로 중단
\set ON_ERROR_STOP 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- 나
  ('22222222-2222-2222-2222-222222222222'),  -- 다래
  ('33333333-3333-3333-3333-333333333333');  -- 남

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u, false), set_config('role', 'authenticated', false);
$$;
create function pg_temp.expect_error(q text, msg text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'EXPECTED ERROR (%), got success: %', msg, q;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if sqlerrm not like '%' || msg || '%' then raise exception 'wrong error for %: % (wanted %)', q, sqlerrm, msg; end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;

-- 1) 나: 가족 만들기 + 기록 쓰기
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.create_family('다로네', '나') is not null as created;
select pg_temp.expect_error($q$select public.create_family('또', '나')$q$, 'already_in_family');
select status = 'ok' and rev = 1 as first_write from public.upsert_item('pets', 'p1', '{"name":"다로"}', false, 0);
select status = 'ok' and rev = 2 as second_write from public.upsert_item('pets', 'p1', '{"name":"다로!"}', false, 1);
select status = 'conflict' and rev = 2 and data->>'name' = '다로!' as stale_write_conflicts
  from public.upsert_item('pets', 'p1', '{"name":"옛값"}', false, 1);
select pg_temp.expect_error($q$select * from public.upsert_item('secrets', 'x', '{}', false, 0)$q$, 'check');
-- 직접 쓰기 금지 (RPC 로만)
select pg_temp.expect_error($q$insert into public.items (family_id, collection, id, seq) values (public.my_family_id(), 'pets', 'p9', 1)$q$, 'permission denied');
select pg_temp.expect_error($q$update public.items set data = '{}'$q$, 'permission denied');
select pg_temp.expect_error($q$delete from public.items$q$, 'permission denied');
select pg_temp.expect_error($q$select * from public.family_invites$q$, 'permission denied');
select public.create_invite() as code \gset
select :'code' ~ '^[A-HJ-NP-Z2-9]{8}$' as code_format;

-- 1-1) 로그인 안 한 사용자(anon): 함수·표 모두 사용 불가
reset role;
select (set_config('request.jwt.claim.sub', '', false) || set_config('role', 'anon', false)) = 'anon' as anon_mode;
select pg_temp.expect_error($q$select public.create_invite()$q$, 'permission denied');
select pg_temp.expect_error($q$select * from public.items$q$, 'permission denied');
reset role;

-- 2) 남(가족 아님): 아무것도 못 봄, 못 씀
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select count(*) = 0 as stranger_sees_no_items from public.items;
select count(*) = 0 as stranger_sees_no_family from public.families;
select count(*) = 0 as stranger_sees_no_members from public.family_members;
select pg_temp.expect_error($q$select * from public.upsert_item('pets', 'p1', '{}', false, 2)$q$, 'not_in_family');
select pg_temp.expect_error($q$select public.join_family('AAAAAAAA', '남')$q$, 'invalid_invite');

-- 3) 다래: 초대 코드로 합류 → 같은 기록 봄, 함께 씀
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_family(lower(:'code'), '다래') is not null as joined;
select count(*) = 1 and min(data->>'name') = '다로!' as darae_sees_pet from public.items;
select status = 'ok' and rev = 3 as darae_edits from public.upsert_item('pets', 'p1', '{"name":"다로♥"}', false, 2);
select status = 'ok' as darae_deletes from public.upsert_item('logs', 'l1', '{"kind":"meal"}', false, 0);
select status = 'ok' and deleted as tombstone from public.upsert_item('logs', 'l1', null, true, 1);
select count(*) = 2 as two_members from public.family_members;

-- 4) 남: 이미 쓴 코드 재사용 불가
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error(format($q$select public.join_family(%L, '남')$q$, :'code'), 'invalid_invite');

-- 5) 나: 다래가 바꾼 값과 seq 순서 확인 → 나가기 → 다래가 방장
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select data->>'name' = '다로♥' as sees_darae_edit from public.items where id = 'p1';
select (select seq from public.items where id = 'l1') > (select seq from public.items where id = 'p1') as seq_increases;
select public.leave_family();
select count(*) = 0 as left_sees_nothing from public.items;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select role = 'owner' as darae_now_owner from public.family_members where user_id = '22222222-2222-2222-2222-222222222222';
-- 6) 마지막 사람이 나가면 가족·기록 삭제
select public.leave_family();
reset role;
select count(*) = 0 as family_removed from public.families;
select count(*) = 0 as items_removed from public.items;
