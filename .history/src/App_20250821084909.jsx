import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Plus, Volleyball, Upload, Database, Calendar, Users, Trophy, Save, Edit3, Trash2, RefreshCcw, LogIn, LogOut, Lock, Share2, X, ChevronDown } from "lucide-react";

/*
  VolleyTrack — volleyball scoring app with tournaments
  ----------------------------------------------------
  • Public visitors (no login) can view: Tournament leaderboard & matches
  • Single admin (Supabase Auth email/password) can: Create tournaments, add teams, assign to tournaments,
    schedule matches, update scores, complete matches
  • RLS policies in Postgres enforce permissions

  ---------- Supabase SQL (also saved as supabase_schema.sql) ----------

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

  create table if not exists matches (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid references tournaments(id) on delete cascade,
    team1_id uuid references teams(id) on delete cascade,
    team2_id uuid references teams(id) on delete cascade,
    scheduled_at timestamptz,
    status text not null default 'scheduled', -- scheduled | in_progress | completed
    winner_team_id uuid references teams(id),
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

  -- Enable RLS
  alter table app_admins enable row level security;
  alter table teams enable row level security;
  alter table tournaments enable row level security;
  alter table tournament_teams enable row level security;
  alter table matches enable row level security;
  alter table sets enable row level security;

  -- Public read for everyone (anon or authenticated)
  create policy if not exists "public read app_admins" on app_admins for select using (true);
  create policy if not exists "public read teams"      on teams      for select using (true);
  create policy if not exists "public read tournaments" on tournaments for select using (true);
  create policy if not exists "public read tournament_teams" on tournament_teams for select using (true);
  create policy if not exists "public read matches"    on matches    for select using (true);
  create policy if not exists "public read sets"       on sets       for select using (true);

  -- Admin-only write (insert/update/delete) based on membership in app_admins
  create policy if not exists "admin write teams" on teams
    for all using (auth.uid() in (select user_id from app_admins))
            with check (auth.uid() in (select user_id from app_admins));

  create policy if not exists "admin write tournaments" on tournaments
    for all using (auth.uid() in (select user_id from app_admins))
            with check (auth.uid() in (select user_id from app_admins));

  create policy if not exists "admin write tournament_teams" on tournament_teams
    for all using (auth.uid() in (select user_id from app_admins))
            with check (auth.uid() in (select user_id from app_admins));

  create policy if not exists "admin write matches" on matches
    for all using (auth.uid() in (select user_id from app_admins))
            with check (auth.uid() in (select user_id from app_admins));

  create policy if not exists "admin write sets" on sets
    for all using (auth.uid() in (select user_id from app_admins))
            with check (auth.uid() in (select user_id from app_admins));

  -- After you create an admin user in Supabase Auth, insert their UUID:
  -- insert into app_admins(user_id) values ('<ADMIN_USER_UUID>');
*/

// --- Minimal UI primitives ---
const Card = ({ children }) => (
  <div className="rounded-2xl shadow-sm border p-4 bg-white">{children}</div>
);
const Button = ({ className = "", disabled=false, ...props }) => (
  <button
    {...props}
    disabled={disabled}
    className={
      "px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed " +
      className
    }
  />
);
const Input = (props) => (
  <input
    {...props}
    className={
      "w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10 " +
      (props.className || "")
    }
  />
);
const Select = (props) => (
  <select
    {...props}
    className={
      "w-full border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 " +
      (props.className || "")
    }
  />
);

function useSupabase() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const [cfg, setCfg] = useState(() => {
    if (envUrl && envKey) return { url: envUrl, key: envKey, fromEnv: true };
    const saved = localStorage.getItem("volleytrack_supabase");
    return saved ? { ...JSON.parse(saved), fromEnv: false } : { url: "", key: "", fromEnv: false };
  });
  const client = useMemo(() => {
    if (!cfg.url || !cfg.key) return null;
    return createClient(cfg.url, cfg.key);
  }, [cfg]);
  const save = (url, key) => {
    const next = { url: url.trim(), key: key.trim(), fromEnv: false };
    localStorage.setItem("volleytrack_supabase", JSON.stringify(next));
    setCfg(next);
  };
  return { client, cfg, save };
}

const fmtDateTime = (s) => (s ? new Date(s).toLocaleString() : "—");
const slugify = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

// Helper to compute winner regardless of volleyball scoring constraints
function computeWinnerId(match, sets) {
  let sw1 = 0, sw2 = 0, pf1 = 0, pf2 = 0;
  for (const s of sets) {
    pf1 += s.team1_points; pf2 += s.team2_points;
    if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++;
  }
  if (sw1 !== sw2) return sw1 > sw2 ? match.team1_id : match.team2_id;
  if (pf1 !== pf2) return pf1 > pf2 ? match.team1_id : match.team2_id;
  return match.team1_id; // deterministic fallback
}

export default function App() {
  const { client, cfg, save } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTid, setSelectedTid] = useState("");
  const [tournamentTeams, setTournamentTeams] = useState([]); // array of team_ids in tournament
  const [matches, setMatches] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [newTeam, setNewTeam] = useState("");
  const [newTournament, setNewTournament] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  const [schedule, setSchedule] = useState({ team1: "", team2: "", when: "" });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Auth session + admin check
  useEffect(() => {
    if (!client) return;
    (async () => {
      const { data } = await client.auth.getSession();
      setSession(data.session || null);
      client.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setRefresh((x) => x + 1);
      });
    })();
  }, [client]);

  useEffect(() => {
    if (!client) return;
    (async () => {
      if (session?.user?.id) {
        const { data: adminRow } = await client
          .from("app_admins")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsAdmin(!!adminRow);
      } else {
        setIsAdmin(false);
      }
    })();
  }, [client, session]);

  // Initial fetch: teams & tournaments
  useEffect(() => {
    if (!client) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: t }, { data: tours }] = await Promise.all([
          client.from("teams").select("*").order("name"),
          client.from("tournaments").select("*").order("start_date", { ascending: true, nullsFirst: true }).order("name")
        ]);
        setTeams(t || []);
        setTournaments(tours || []);

        // Select tournament from URL (?t=ID or ?slug=SLUG) or default first
        const params = new URLSearchParams(location.search);
        const tidParam = params.get("t");
        const slugParam = params.get("slug");
        let tid = "";
        if (slugParam && tours?.length) {
          const found = tours.find(x => x.slug === slugParam);
          if (found) tid = found.id;
        }
        if (!tid && tidParam) tid = tidParam;
        if (!tid && tours?.length) tid = tours[0].id;
        setSelectedTid(tid || "");
      } finally {
        setLoading(false);
      }
    })();
  }, [client, refresh]);

  // When tournament changes, fetch tournament teams, matches, and sets
  useEffect(() => {
    if (!client || !selectedTid) { setTournamentTeams([]); setMatches([]); setAllSets([]); return; }
    (async () => {
      setLoading(true);
      try {
        const { data: tt } = await client
          .from("tournament_teams")
          .select("team_id")
          .eq("tournament_id", selectedTid);
        const teamIds = (tt || []).map(r => r.team_id);
        setTournamentTeams(teamIds);

        const { data: m } = await client
          .from("matches")
          .select("*, team1:team1_id(name), team2:team2_id(name), tournament:tournament_id(name,slug)")
          .eq("tournament_id", selectedTid)
          .order("scheduled_at", { ascending: true });
        setMatches(m || []);

        const matchIds = (m || []).map(x => x.id);
        if (matchIds.length) {
          const { data: s } = await client
            .from("sets")
            .select("*")
            .in("match_id", matchIds)
            .order("set_number");
          setAllSets(s || []);
        } else {
          setAllSets([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [client, selectedTid, refresh]);

  // Admin auth
  async function signIn() {
    if (!client) return;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  }
  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  // Teams (global)
  async function addTeam() {
    if (!newTeam.trim() || !client) return;
    setLoading(true);
    const { error } = await client.from("teams").insert({ name: newTeam.trim() });
    if (error) alert(error.message);
    setNewTeam("");
    setRefresh((x) => x + 1);
  }
  async function deleteTeam(id) {
    if (!client) return;
    if (!confirm("Delete team?")) return;
    setLoading(true);
    const { error } = await client.from("teams").delete().eq("id", id);
    if (error) alert(error.message);
    setRefresh((x) => x + 1);
  }

  // Tournaments
  async function addTournament() {
    if (!client) return;
    const name = newTournament.trim();
    if (!name) return;
    const slug = slugify(name);
    const { error } = await client.from("tournaments").insert({ name, slug });
    if (error) return alert(error.message);
    setNewTournament("");
    setRefresh((x)=>x+1);
  }
  async function deleteTournament(id) {
    if (!client) return;
    if (!confirm("Delete tournament and all its matches?")) return;
    const { error } = await client.from("tournaments").delete().eq("id", id);
    if (error) alert(error.message);
    if (selectedTid === id) setSelectedTid("");
    setRefresh((x)=>x+1);
  }

  // Tournament team assignment
  async function addTeamToTournament() {
    if (!client || !selectedTid || !assignTeamId) return;
    const { error } = await client.from("tournament_teams").insert({ tournament_id: selectedTid, team_id: assignTeamId });
    if (error) alert(error.message);
    setAssignTeamId("");
    setRefresh((x)=>x+1);
  }
  async function removeTeamFromTournament(team_id) {
    if (!client || !selectedTid) return;
    const { error } = await client.from("tournament_teams").delete().eq("tournament_id", selectedTid).eq("team_id", team_id);
    if (error) alert(error.message);
    setRefresh((x)=>x+1);
  }

  // Matches
  async function scheduleMatch() {
    if (!client) return;
    const { team1, team2, when } = schedule;
    if (!selectedTid) return alert("Select a tournament first");
    if (!team1 || !team2 || team1 === team2) return alert("Pick two different teams");
    const scheduled_at = when ? new Date(when).toISOString() : null;
    setLoading(true);
    const { data: m, error } = await client
      .from("matches")
      .insert({ tournament_id: selectedTid, team1_id: team1, team2_id: team2, scheduled_at, status: "scheduled" })
      .select("*")
      .single();
    if (error) alert(error.message);
    if (!error && m) {
      await client.from("sets").insert([1, 2, 3].map((n) => ({ match_id: m.id, set_number: n })));
    }
    setSchedule({ team1: "", team2: "", when: "" });
    setRefresh((x) => x + 1);
  }

  async function openMatch(mid) {
    if (!client) return;
    const { data: m } = await client
      .from("matches")
      .select("*, team1:team1_id(name), team2:team2_id(name), tournament:tournament_id(name,slug)")
      .eq("id", mid)
      .single();
    const { data: s } = await client
      .from("sets")
      .select("*")
      .eq("match_id", mid)
      .order("set_number");
    setSelectedMatch({ match: m, sets: s || [] });
  }

  function pointsToWin(setNumber) { return setNumber === 3 ? 15 : 25; }
  function setWinnerStrict(s) {
    const target = pointsToWin(s.set_number);
    const d1 = s.team1_points - s.team2_points;
    const d2 = s.team2_points - s.team1_points;
    if (s.team1_points >= target && d1 >= 2) return 1;
    if (s.team2_points >= target && d2 >= 2) return 2;
    return 0;
  }

  async function adjustPoint(setId, field, delta) {
    if (!client || !selectedMatch) return;
    const s = selectedMatch.sets.find((x) => x.id === setId);
    if (!s) return;
    const next = Math.max(0, s[field] + delta);
    const { error } = await client.from("sets").update({ [field]: next }).eq("id", setId);
    if (error) alert(error.message);
    await openMatch(selectedMatch.match.id);
    if (selectedMatch.match.status === "scheduled") {
      await client.from("matches").update({ status: "in_progress" }).eq("id", selectedMatch.match.id);
      setRefresh((x) => x + 1);
    }
  }

  async function completeMatch() {
    if (!client || !selectedMatch) return;
    const winnerId = computeWinnerId(selectedMatch.match, selectedMatch.sets);
    const { error } = await client
      .from("matches")
      .update({ status: "completed", winner_team_id: winnerId })
      .eq("id", selectedMatch.match.id);
    if (error) alert(error.message);
    await openMatch(selectedMatch.match.id);
    setRefresh((x) => x + 1);
  }

  async function deleteMatch(id) {
    if (!client) return;
    if (!confirm("Delete match?")) return;
    const { error } = await client.from("matches").delete().eq("id", id);
    if (error) alert(error.message);
    setRefresh((x) => x + 1);
    if (selectedMatch?.match?.id === id) setSelectedMatch(null);
  }

  // Leaderboard (completed matches only, per selected tournament)
  const leaderboard = React.useMemo(() => {
    const map = new Map();
    // Only teams assigned to this tournament are eligible for leaderboard rows
    teams
      .filter(t => tournamentTeams.includes(t.id))
      .forEach(t => map.set(t.id, { id: t.id, name: t.name, w: 0, l: 0, sw: 0, sl: 0, pf: 0, pa: 0, pd: 0 }));

    const setsByMatch = allSets.reduce((acc, s) => {
      (acc[s.match_id] ||= []).push(s);
      return acc;
    }, {});

    for (const m of matches) {
      if (m.status !== 'completed') continue;
      const sets = (setsByMatch[m.id] || []).sort((a,b)=>a.set_number-b.set_number);
      let sw1=0, sw2=0, pf1=0, pf2=0;
      for (const s of sets) {
        pf1 += s.team1_points; pf2 += s.team2_points;
        if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++;
      }
      const winId = m.winner_team_id || computeWinnerId(m, sets);
      const loseId = winId === m.team1_id ? m.team2_id : m.team1_id;

      // Update W/L
      if (map.has(winId)) map.get(winId).w++;
      if (map.has(loseId)) map.get(loseId).l++;

      // Update sets and points aggregates (both teams)
      if (map.has(m.team1_id)) {
        const r = map.get(m.team1_id);
        r.sw += sw1; r.sl += sw2; r.pf += pf1; r.pa += pf2; r.pd = r.pf - r.pa;
      }
      if (map.has(m.team2_id)) {
        const r = map.get(m.team2_id);
        r.sw += sw2; r.sl += sw1; r.pf += pf2; r.pa += pf1; r.pd = r.pf - r.pa;
      }
    }

    return Array.from(map.values()).sort((a,b)=>
      (b.w - a.w) || (b.sw - a.sw) || (b.pd - a.pd) || a.name.localeCompare(b.name)
    );
  }, [teams, matches, allSets, tournamentTeams]);

  const showSetup = !(cfg?.fromEnv && cfg.url && cfg.key);

  function copyShareLink() {
    if (!selectedTid) return alert('Select a tournament first');
    const t = tournaments.find(x=>x.id===selectedTid);
    const u = new URL(location.href);
    u.searchParams.set(t?.slug ? 'slug' : 't', t?.slug || selectedTid);
    navigator.clipboard.writeText(u.toString());
    alert('Shareable link copied to clipboard');
  }

  const tournamentTeamOptions = teams.filter(t=>!tournamentTeams.includes(t.id));
  const selectedTournament = tournaments.find(t=>t.id===selectedTid);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volleyball className="w-7 h-7" />
            <h1 className="text-2xl font-semibold">VolleyTrack</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2"><Database className="w-4 h-4" /> <span className="opacity-70">{cfg.url ? (cfg.fromEnv?"DB Ready":"DB Configurable") : "No DB"}</span></div>
            {session ? (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1"><Lock className="w-3 h-3"/>{isAdmin?"Admin":"Viewer"}</span>
                <Button onClick={signOut} className="bg-white flex items-center gap-1"><LogOut className="w-4 h-4"/>Sign out</Button>
              </div>
            ) : (
              <span className="text-xs opacity-70">Public View</span>
            )}
          </div>
        </header>

        {/* Tournament Selector + Share Link */}
        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-70">Tournament:</span>
              <Select value={selectedTid} onChange={(e)=>setSelectedTid(e.target.value)} className="min-w-[220px]">
                <option value="">Select a tournament…</option>
                {tournaments.map(t=> (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
              <Button onClick={copyShareLink} className="bg-white flex items-center gap-2"><Share2 className="w-4 h-4"/>Share public link</Button>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Input placeholder="New tournament name" value={newTournament} onChange={(e)=>setNewTournament(e.target.value)} />
                <Button onClick={addTournament} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
                {selectedTid && <Button onClick={()=>deleteTournament(selectedTid)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>}
              </div>
            )}
          </div>
          {selectedTournament && (
            <p className="text-xs opacity-70 mt-2">{selectedTournament.slug ? `Slug: ${selectedTournament.slug}` : 'No slug set'}</p>
          )}
        </Card>

        {/* Admin Sign-in */}
        {!session && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><LogIn className="w-4 h-4"/> Admin Sign-in</h2>
              <span className="text-xs opacity-70">Only admins can edit</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input type="email" placeholder="admin@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <Input type="password" placeholder="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <Button onClick={signIn} className="bg-black text-white flex items-center gap-2"><LogIn className="w-4 h-4"/>Sign in</Button>
            </div>
          </Card>
        )}

        {/* Setup (hidden if env vars provided) */}
        {showSetup && (
          <Card>
            <div className="flex items-start gap-4">
              <div className="grow">
                <h2 className="text-lg font-medium flex items-center gap-2"><Upload className="w-4 h-4"/> Supabase Setup</h2>
                <p className="text-sm opacity-80 mt-1">Enter your Supabase URL and anon key (Project settings → API). Stored locally in your browser. For public deployments, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel and this panel will disappear.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <Input placeholder="SUPABASE_URL" defaultValue={cfg.url} onBlur={(e)=>save(e.target.value, cfg.key)} />
              <Input placeholder="SUPABASE_ANON_KEY" defaultValue={cfg.key} onBlur={(e)=>save(cfg.url, e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={()=>setRefresh(x=>x+1)} className="bg-black text-white flex items-center gap-2"><RefreshCcw className="w-4 h-4"/>Reconnect</Button>
                <Button onClick={()=>{localStorage.removeItem("volleytrack_supabase"); location.reload();}} className="bg-white">Reset</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Public Leaderboard (per tournament) */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Leaderboard</h2>
            <span className="text-xs opacity-60">{leaderboard.length} teams</span>
          </div>
          {!selectedTid ? (
            <div className="text-sm opacity-60">Select a tournament to view the leaderboard.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-70">
                    <th className="py-2">#</th>
                    <th className="py-2">Team</th>
                    <th className="py-2">W</th>
                    <th className="py-2">L</th>
                    <th className="py-2">SW</th>
                    <th className="py-2">Pts ±</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaderboard.map((r,i)=> (
                    <tr key={r.id}>
                      <td className="py-2">{i+1}</td>
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.w}</td>
                      <td className="py-2">{r.l}</td>
                      <td className="py-2">{r.sw}</td>
                      <td className="py-2">{r.pd}</td>
                    </tr>
                  ))}
                  {!leaderboard.length && (
                    <tr><td className="py-2 text-sm opacity-60" colSpan={6}>No completed matches yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Tournament Teams (Admin only) */}
        {isAdmin && selectedTid && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> Tournament Teams</h2>
              <span className="text-xs opacity-60">{tournamentTeams.length} assigned</span>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <Select value={assignTeamId} onChange={(e)=>setAssignTeamId(e.target.value)}>
                <option value="">Select a team to add…</option>
                {tournamentTeamOptions.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Button onClick={addTeamToTournament} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add to Tournament</Button>
            </div>
            <ul className="divide-y">
              {teams.filter(t=>tournamentTeams.includes(t.id)).map(t => (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <span>{t.name}</span>
                  <Button onClick={()=>removeTeamFromTournament(t.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><X className="w-4 h-4"/>Remove</Button>
                </li>
              ))}
              {!tournamentTeams.length && <div className="text-sm opacity-60">No teams assigned yet.</div>}
            </ul>
          </Card>
        )}

        {/* Global Teams (Admin only) */}
        {isAdmin && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> All Teams</h2>
              <span className="text-xs opacity-60">{teams.length} teams</span>
            </div>
            <div className="flex gap-2 mb-3">
              <Input placeholder="Team name" value={newTeam} onChange={(e)=>setNewTeam(e.target.value)} />
              <Button onClick={addTeam} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
            </div>
            <ul className="divide-y">
              {teams.map((t)=> (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <span>{t.name}</span>
                  <div className="flex gap-2">
                    <Button onClick={()=>deleteTeam(t.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                  </div>
                </li>
              ))}
              {!teams.length && <div className="text-sm opacity-60">No teams yet.</div>}
            </ul>
          </Card>
        )}

        {/* Schedule (Admin only, per tournament) */}
        {isAdmin && selectedTid && (
          <Card>
            <h2 className="text-lg font-medium flex items-center gap-2 mb-3"><Calendar className="w-4 h-4"/> Schedule a Match</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <Select value={schedule.team1} onChange={(e)=>setSchedule({...schedule, team1: e.target.value})}>
                <option value="">Team 1</option>
                {teams.filter(t=>tournamentTeams.includes(t.id)).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select value={schedule.team2} onChange={(e)=>setSchedule({...schedule, team2: e.target.value})}>
                <option value="">Team 2</option>
                {teams.filter(t=>tournamentTeams.includes(t.id)).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Input type="datetime-local" value={schedule.when} onChange={(e)=>setSchedule({...schedule, when: e.target.value})} />
            </div>
            <div className="mt-3">
              <Button onClick={scheduleMatch} className="bg-black text-white flex items-center gap-2"><Save className="w-4 h-4"/>Create Match</Button>
            </div>
          </Card>
        )}

        {/* Matches (per tournament) */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Matches</h2>
            <span className="text-xs opacity-60">{matches.length} total</span>
          </div>
          {!selectedTid ? (
            <div className="text-sm opacity-60">Select a tournament to view matches.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-70">
                    <th className="py-2">When</th>
                    <th className="py-2">Teams</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matches.map((m)=> (
                    <tr key={m.id}>
                      <td className="py-2">{fmtDateTime(m.scheduled_at)}</td>
                      <td className="py-2">{m.team1?.name} vs {m.team2?.name}</td>
                      <td className="py-2 capitalize">{m.status}</td>
                      <td className="py-2 flex gap-2">
                        <Button onClick={()=>openMatch(m.id)} className="bg-white flex items-center gap-1"><Edit3 className="w-4 h-4"/>Open</Button>
                        {isAdmin && (
                          <Button onClick={()=>deleteMatch(m.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!matches.length && (
                    <tr><td className="py-2 text-sm opacity-60" colSpan={4}>No matches yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Live Scoring (public read-only; admin can adjust) */}
        {selectedMatch && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedMatch.match.team1?.name} vs {selectedMatch.match.team2?.name}</h3>
                  <p className="text-sm opacity-70">{fmtDateTime(selectedMatch.match.scheduled_at)} • Status: <span className="capitalize">{selectedMatch.match.status}</span></p>
                </div>
                <div className="flex gap-2">
                  {isAdmin && <Button onClick={completeMatch} className="bg-emerald-600 text-white">Mark Completed & Pick Winner</Button>}
                  <Button onClick={()=>setSelectedMatch(null)} className="bg-white">Close</Button>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                {selectedMatch.sets.map((s)=>{
                  const target = s.set_number === 3 ? 15 : 25;
                  const win = setWinnerStrict(s);
                  return (
                    <div key={s.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Set {s.set_number} <span className="text-xs opacity-60">(to {target}, win by 2)</span></div>
                        {win ? <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Winner: Team {win}</span> : <span className="text-xs px-2 py-1 bg-slate-100 rounded-full">In play</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {["team1_points","team2_points"].map((field,idx)=> (
                          <div key={field} className="border rounded-xl p-3">
                            <div className="text-xs opacity-70 mb-2">{idx===0? selectedMatch.match.team1?.name : selectedMatch.match.team2?.name}</div>
                            <div className="flex items-center justify-between">
                              <Button disabled={!isAdmin} onClick={()=>adjustPoint(s.id, field, -1)} className="bg-white">–</Button>
                              <div className="text-3xl font-semibold">{s[field]}</div>
                              <Button disabled={!isAdmin} onClick={()=>adjustPoint(s.id, field, +1)} className="bg-black text-white">+</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Footer / How to Deploy */}
        <Card>
          <h2 className="text-lg font-medium mb-2">Quick Deploy</h2>
          <ol className="list-decimal ml-5 text-sm space-y-1">
            <li>Create a free Supabase project → copy Project URL and anon key (Settings → API).</li>
            <li>Run <code>supabase_schema.sql</code> in Supabase SQL editor to create tables & RLS policies.</li>
            <li>Create an admin user in Supabase Auth (email/password), then insert their UUID into <code>app_admins</code>.</li>
            <li>In Vercel, set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Build → Env Vars). This hides the setup panel for public viewers.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}