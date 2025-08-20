import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Plus, Volleyball, Upload, Database, Calendar, Users, Trophy, Save, Edit3, Trash2, RefreshCcw } from "lucide-react";

/*
  VolleyTrack — lightweight volleyball scoring app
  ------------------------------------------------
  • Frontend: React + Tailwind
  • Backend/DB: Supabase (Postgres) via @supabase/supabase-js
  • Features:
      - Configure Supabase in-app (saved to localStorage)
      - Create & list Teams
      - Schedule Matches (pick two teams, date/time)
      - Score Matches (best of 3 sets; 25/25/15, win by 2)
      - Persisted sets & match status (scheduled / in_progress / completed)
      - Simple Standings placeholder
  • Deploy to Vercel/Netlify; no server code required.

  ---------- Supabase SQL (also saved as supabase_schema.sql) ----------

  create table if not exists teams (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
  );

  create table if not exists matches (
    id uuid primary key default gen_random_uuid(),
    team1_id uuid references teams(id) on delete cascade,
    team2_id uuid references teams(id) on delete cascade,
    scheduled_at timestamptz,
    status text not null default 'scheduled', -- scheduled | in_progress | completed
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

  -- RLS can be enabled with policies for multi-tenant scenarios
*/

// --- Minimal UI primitives ---
const Card = ({ children }) => (
  <div className="rounded-2xl shadow-sm border p-4 bg-white">{children}</div>
);
const Button = ({ className = "", ...props }) => (
  <button
    {...props}
    className={
      "px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow transition " +
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
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem("volleytrack_supabase");
    return saved ? JSON.parse(saved) : { url: "", key: "" };
  });
  const client = useMemo(() => {
    if (!cfg.url || !cfg.key) return null;
    return createClient(cfg.url, cfg.key);
  }, [cfg]);
  const save = (url, key) => {
    const next = { url: url.trim(), key: key.trim() };
    localStorage.setItem("volleytrack_supabase", JSON.stringify(next));
    setCfg(next);
  };
  return { client, cfg, save };
}

const fmtDateTime = (s) => (s ? new Date(s).toLocaleString() : "—");

export default function App() {
  const { client, cfg, save } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [newTeam, setNewTeam] = useState("");
  const [schedule, setSchedule] = useState({ team1: "", team2: "", when: "" });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!client) return;
    (async () => {
      setLoading(true);
      try {
        const { data: t } = await client.from("teams").select("*").order("name");
        setTeams(t || []);
        const { data: m } = await client
          .from("matches")
          .select("*, team1:team1_id(name), team2:team2_id(name)")
          .order("scheduled_at", { ascending: true });
        setMatches(m || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [client, refresh]);

  async function addTeam() {
    if (!newTeam.trim()) return;
    setLoading(true);
    await client.from("teams").insert({ name: newTeam.trim() });
    setNewTeam("");
    setRefresh((x) => x + 1);
  }

  async function deleteTeam(id) {
    if (!confirm("Delete team?")) return;
    setLoading(true);
    await client.from("teams").delete().eq("id", id);
    setRefresh((x) => x + 1);
  }

  async function scheduleMatch() {
    const { team1, team2, when } = schedule;
    if (!team1 || !team2 || team1 === team2) return alert("Pick two different teams");
    const scheduled_at = when ? new Date(when).toISOString() : null;
    setLoading(true);
    const { data: m, error } = await client
      .from("matches")
      .insert({ team1_id: team1, team2_id: team2, scheduled_at, status: "scheduled" })
      .select("*")
      .single();
    if (!error && m) {
      await client.from("sets").insert(
        [1, 2, 3].map((n) => ({ match_id: m.id, set_number: n }))
      );
    }
    setSchedule({ team1: "", team2: "", when: "" });
    setRefresh((x) => x + 1);
  }

  async function openMatch(mid) {
    const { data: m } = await client
      .from("matches")
      .select("*, team1:team1_id(name), team2:team2_id(name)")
      .eq("id", mid)
      .single();
    const { data: s } = await client
      .from("sets")
      .select("*")
      .eq("match_id", mid)
      .order("set_number");
    setSelectedMatch({ match: m, sets: s || [] });
  }

  function pointsToWin(setNumber) {
    return setNumber === 3 ? 15 : 25;
  }

  function setWinner(s) {
    const target = pointsToWin(s.set_number);
    const diff = Math.abs(s.team1_points - s.team2_points);
    if (s.team1_points >= target && s.team1_points - s.team2_points >= 2) return 1;
    if (s.team2_points >= target && s.team2_points - s.team1_points >= 2) return 2;
    if (s.team1_points >= target && diff >= 2) return 1;
    if (s.team2_points >= target && diff >= 2) return 2;
    return 0;
  }

  async function adjustPoint(setId, field, delta) {
    const s = selectedMatch.sets.find((x) => x.id === setId);
    if (!s) return;
    const next = Math.max(0, s[field] + delta);
    await client.from("sets").update({ [field]: next }).eq("id", setId);
    await openMatch(selectedMatch.match.id);
    if (selectedMatch.match.status === "scheduled") {
      await client.from("matches").update({ status: "in_progress" }).eq("id", selectedMatch.match.id);
      setRefresh((x) => x + 1);
    }
  }

  async function completeMatch() {
    // Optional: validate someone actually won 2 sets.
    await client.from("matches").update({ status: "completed" }).eq("id", selectedMatch.match.id);
    await openMatch(selectedMatch.match.id);
    setRefresh((x) => x + 1);
  }

  async function deleteMatch(id) {
    if (!confirm("Delete match?")) return;
    await client.from("matches").delete().eq("id", id);
    setRefresh((x) => x + 1);
    if (selectedMatch?.match?.id === id) setSelectedMatch(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volleyball className="w-7 h-7" />
            <h1 className="text-2xl font-semibold">VolleyTrack</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4" />
            <span className="opacity-70">{cfg.url ? "DB Connected" : "Configure DB"}</span>
          </div>
        </header>

        {/* Setup */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="grow">
              <h2 className="text-lg font-medium flex items-center gap-2"><Upload className="w-4 h-4"/> Supabase Setup</h2>
              <p className="text-sm opacity-80 mt-1">Enter your Supabase URL and anon key (Project settings → API). Stored locally in your browser.</p>
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

        {/* Teams & Schedule */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> Teams</h2>
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

          <Card>
            <h2 className="text-lg font-medium flex items-center gap-2 mb-3"><Calendar className="w-4 h-4"/> Schedule a Match</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <Select value={schedule.team1} onChange={(e)=>setSchedule({...schedule, team1: e.target.value})}>
                <option value="">Team 1</option>
                {teams.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select value={schedule.team2} onChange={(e)=>setSchedule({...schedule, team2: e.target.value})}>
                <option value="">Team 2</option>
                {teams.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Input type="datetime-local" value={schedule.when} onChange={(e)=>setSchedule({...schedule, when: e.target.value})} />
            </div>
            <div className="mt-3">
              <Button onClick={scheduleMatch} className="bg-black text-white flex items-center gap-2"><Save className="w-4 h-4"/>Create Match</Button>
            </div>
          </Card>
        </div>

        {/* Matches */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Matches</h2>
            <span className="text-xs opacity-60">{matches.length} total</span>
          </div>
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
                      <Button onClick={()=>deleteMatch(m.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                    </td>
                  </tr>
                ))}
                {!matches.length && (
                  <tr><td className="py-2 text-sm opacity-60" colSpan={4}>No matches yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Live Scoring */}
        {selectedMatch && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedMatch.match.team1?.name} vs {selectedMatch.match.team2?.name}</h3>
                  <p className="text-sm opacity-70">{fmtDateTime(selectedMatch.match.scheduled_at)} • Status: <span className="capitalize">{selectedMatch.match.status}</span></p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={completeMatch} className="bg-emerald-600 text-white">Mark Completed</Button>
                  <Button onClick={()=>setSelectedMatch(null)} className="bg-white">Close</Button>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                {selectedMatch.sets.map((s)=>{
                  const target = s.set_number === 3 ? 15 : 25;
                  const p1 = s.team1_points, p2 = s.team2_points;
                  const diff = Math.abs(p1 - p2);
                  const win = (p1 >= target && p1 - p2 >= 2) ? 1 : (p2 >= target && p2 - p1 >= 2) ? 2 : 0;
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
                              <Button onClick={()=>adjustPoint(s.id, field, -1)} className="bg-white">–</Button>
                              <div className="text-3xl font-semibold">{s[field]}</div>
                              <Button onClick={()=>adjustPoint(s.id, field, +1)} className="bg-black text-white">+</Button>
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
            <li>Run <code>supabase_schema.sql</code> in Supabase SQL editor to create tables.</li>
            <li>On your deployed site, paste the Supabase URL + anon key in the setup panel.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}