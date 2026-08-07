-- PG Manager — Supabase schema
--
-- Run this once in your project: Supabase → SQL Editor → New query → paste →
-- Run. It is safe to run more than once; every statement checks first.
--
-- What it is for: a username has to be unique across every account. Supabase
-- keeps user metadata as free-form JSON on each user, and nothing there can
-- promise two people did not pick "swayam". So usernames live in their own
-- table, and the database itself refuses the second one.


-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 2. The rule that does the real work
-- ---------------------------------------------------------------------------

-- Unique, and case-blind: "Swayam" and "swayam" are the same person's claim.
-- Rows with no username yet are simply not covered by the index.
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- The same shape rule the browser enforces, enforced again down here, because
-- a check that only runs in the page is a suggestion.
alter table public.profiles
  drop constraint if exists profiles_username_shape;

alter table public.profiles
  add constraint profiles_username_shape
  check (username is null or username ~ '^[a-z0-9._-]{3,20}$');


-- ---------------------------------------------------------------------------
-- 3. A row for every account, created automatically
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who already signed up before this file was run still needs a row.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

-- Without this, the anon key in config.js could read the whole table.
alter table public.profiles enable row level security;

-- Read your own row.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Change your own row, and only your own.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert is here only so a first save still works if the trigger above never
-- fired for an older account. The id is pinned to the caller either way.
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Note there is deliberately no delete policy and no policy that lets one
-- account read another. A visitor cannot list who exists, so usernames stay
-- unique without also becoming a directory of your staff.
