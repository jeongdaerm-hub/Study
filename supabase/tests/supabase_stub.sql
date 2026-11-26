-- 로컬 테스트용: Supabase 의 auth 스키마·역할을 흉내 냄 (실제 Supabase 에서는 실행하지 않음)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema extensions;
create extension pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated;
grant usage on schema public to anon, authenticated;
