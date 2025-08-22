
create extension if not exists pgcrypto;

create table if not exists app_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists tournament_teams (
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tournament_id, team_id)
);

-- NEW: Pools (group stage) and membership
create table if not exists pools (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);

create table if not exists pool_teams (
  pool_id uuid references pools(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pool_id, team_id)
);

-- Matches now have phase/pool/bracket slots
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team1_id uuid references teams(id) on delete cascade,
  team2_id uuid references teams(id) on delete cascade,
  scheduled_at timestamptz,
  status text not null default 'scheduled', -- scheduled | in_progress | completed
  winner_team_id uuid references teams(id),
  -- NEW fields:
  phase text not null default 'pool', -- pool | semifinal | final
  pool_id uuid references pools(id) on delete set null,
  bracket_slot text check (bracket_slot in ('SF1','SF2','F')),
  created_at timestamptz not null default now()
);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  set_number int not null check (set_number between 1 and 3),
  team1_points int not null default 0,
  team2_points int not null default 0,
  created_at timestamptz not null default now(),
  unique(match_id, set_number)
);

-- RLS
alter table app_admins enable row level security;
alter table teams enable row level security;
alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table pools enable row level security;
alter table pool_teams enable row level security;
alter table matches enable row level security;
alter table sets enable row level security;

-- Public read
create policy if not exists "public read app_admins" on app_admins for select using (true);
create policy if not exists "public read teams" on teams for select using (true);
create policy if not exists "public read tournaments" on tournaments for select using (true);
create policy if not exists "public read tournament_teams" on tournament_teams for select using (true);
create policy if not exists "public read pools" on pools for select using (true);
create policy if not exists "public read pool_teams" on pool_teams for select using (true);
create policy if not exists "public read matches" on matches for select using (true);
create policy if not exists "public read sets" on sets for select using (true);

-- Admin write
create policy if not exists "admin write teams" on teams
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write tournaments" on tournaments
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write tournament_teams" on tournament_teams
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write pools" on pools
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write pool_teams" on pool_teams
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write matches" on matches
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

create policy if not exists "admin write sets" on sets
  for all using (auth.uid() in (select user_id from app_admins))
          with check (auth.uid() in (select user_id from app_admins));

-- After creating an admin user in Supabase Auth (email/password), insert their UUID:
-- insert into app_admins(user_id) values ('<ADMIN_USER_UUID>');
