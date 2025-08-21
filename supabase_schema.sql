-- Supabase schema for VolleyTrack Cross-Pool
create table if not exists teams(
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists pools(
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists pool_teams(
  pool_id uuid references pools(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  primary key(pool_id, team_id)
);

create table if not exists matches(
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references pools(id),
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  winner_team_id uuid references teams(id),
  status text default 'scheduled',
  created_at timestamptz default now()
);

create table if not exists sets(
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team1_score int default 0,
  team2_score int default 0
);
