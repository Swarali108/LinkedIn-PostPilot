-- Multi-user auth (Supabase Auth + username login). Run ONCE in the SQL editor,
-- AFTER enabling the Email provider in Authentication → Providers.

-- Maps each auth user to a unique username (login identifier).
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- A signed-in user can read/update only their own profile row.
drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles
  for select using (auth.uid() = user_id);
drop policy if exists "own profile update" on profiles;
-- `using` picks which rows you may update; `with check` validates the row you
-- write. Without the latter a user could reassign their row's user_id to someone
-- else's, so both clauses are required.
create policy "own profile update" on profiles
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- On signup, auto-create the profile from the username passed in user metadata.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Resolve a username to its email so the client can log in by username.
-- SECURITY DEFINER so it can read auth.users; returns only the email.
create or replace function email_for_username(uname text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where p.username = lower(uname)
  limit 1;
$$;

grant execute on function email_for_username(text) to anon, authenticated;

-- Is a username already taken? (used by signup)
create or replace function username_taken(uname text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where username = lower(uname));
$$;

grant execute on function username_taken(text) to anon, authenticated;

-- NOTE on per-user data isolation:
-- The memories / brand_profiles / generation_history / content_calendars tables
-- already have RLS enabled with NO policies, so the anon role is fully blocked.
-- The app's server routes use the service-role key and scope every query by the
-- *authenticated user's id* (derived from the session) — so each user only ever
-- sees their own data. RLS stays as defense-in-depth.
