import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trophy, Calendar, PlusCircle, Settings, X, Trash2, PlayCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

// === Points Scoring Helpers ===
function matchBonus(swOwn, swOpp, didWin) {
  return didWin ? (swOpp === 0 ? 2 : 1) : 0; // 2-0 => +2; 2-1 => +1; losses => +0
}
function matchPointsForTeam(swOwn, swOpp, didWin) {
  return 2 * swOwn + matchBonus(swOwn, swOpp, didWin);
}
// === End Points Scoring Helpers ===

// Simple UI primitives (Tailwind classes)
function Card({ children }) {
  return <div className="rounded-2xl border p-4 bg-white/50 backdrop-blur-sm shadow-sm">{children}</div>;
}
function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm hover:shadow-sm active:scale-[.98] transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Input({ className = "", ...props }) {
  return <input className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 ${className}`} {...props} />;
}
function Select({ className = "", ...props }) {
  return <select className={`w-full rounded-xl border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/10 ${className}`} {...props} />;
}

// --- Supabase client ---
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const client = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pools, setPools] = useState([]);
  const [poolTeams, setPoolTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [selectedTid, setSelectedTid] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newMatch, setNewMatch] = useState({ team1_id: "", team2_id: "", scheduled_at: "", stage: "pool" });
  const [expanded, setExpanded] = useState({});
  const [bracketAssign, setBracketAssign] = useState({}); // { [matchId]: { team1, team2 } }

  // --- Load static/master data ---
  useEffect(() => {
    (async () => {
      const { data: ts } = await client.from("tournaments").select("*").order("id", { ascending: true });
      setTournaments(ts || []);
      const { data: tms } = await client.from("teams").select("*").order("name");
      setTeams(tms || []);
      const { data: ps } = await client.from("pools").select("*").order("id");
      setPools(ps || []);
      const { data: pts } = await client.from("pool_teams").select("*");
      setPoolTeams(pts || []);
    })();
  }, []);

  // --- Load matches & sets for the selected tournament ---
  useEffect(() => {
    (async () => {
      if (!selectedTid) return;
      const { data: ms } = await client
        .from("matches")
        .select("*, team1:teams(*), team2:teams(*)")
        .eq("tournament_id", selectedTid)
        .order("id");
      setMatches(ms || []);
      const { data: sets } = await client
        .from("sets")
        .select("*")
        .in("match_id", (ms || []).map((m) => m.id));
      setAllSets(sets || []);
    })();
  }, [selectedTid, refresh]);

  // Teams that appear in this tournament (from pool_teams)
  const tournamentTeams = useMemo(() => {
    const ids = new Set();
    for (const pt of poolTeams) ids.add(pt.team_id);
    return Array.from(ids);
  }, [poolTeams]);

  function fmtDateTime(v) {
    if (!v) return "—";
    const d = new Date(v);
    return d.toLocaleString();
  }

  function computeWinnerId(match, sets) {
    let sw1 = 0,
      sw2 = 0;
    for (const s of sets) {
      if (s.team1_points > s.team2_points) sw1++;
      else if (s.team2_points > s.team1_points) sw2++;
    }
    if (sw1 === sw2) return null;
    return sw1 > sw2 ? match.team1_id : match.team2_id;
  }

  async function openMatch(id) {
    const { data: m } = await client
      .from("matches")
      .select("*, team1:teams(*), team2:teams(*)")
      .eq("id", id)
      .single();
    if (!m) return;
    const { data: sets } = await client
      .from("sets")
      .select("*")
      .eq("match_id", id)
      .order("set_number");
    setSelectedMatch({ match: m, sets: sets || [] });
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

  // ---- Bracket helpers (Semis & Final) ----
  function labelOrTBD(team) {
    return team?.name || "TBD";
  }

  async function ensureSetsForMatch(mid) {
    if (!client) return;
    const { data: existing } = await client.from("sets").select("id").eq("match_id", mid);
    if (!existing || existing.length === 0) {
      await client.from("sets").insert([1, 2, 3].map((n) => ({ match_id: mid, set_number: n })));
    }
  }

  async function createBracketPlaceholders() {
    if (!client || !selectedTid) {
      alert("Select a tournament first");
      return;
    }
    const semis = matches.filter((m) => (m.stage || "").toLowerCase() === "semi");
    const finals = matches.filter((m) => (m.stage || "").toLowerCase() === "final");
    let created = 0;
    for (let i = semis.length; i < 2; i++) {
      const { data: m, error } = await client
        .from("matches")
        .insert({ tournament_id: selectedTid, team1_id: null, team2_id: null, status: "scheduled", stage: "semi" })
        .select("*")
        .single();
      if (!error && m) {
        await ensureSetsForMatch(m.id);
        created++;
      } else if (error) {
        alert(error.message);
        return;
      }
    }
    if (finals.length < 1) {
      const { data: m2, error: e2 } = await client
        .from("matches")
        .insert({ tournament_id: selectedTid, team1_id: null, team2_id: null, status: "scheduled", stage: "final" })
        .select("*")
        .single();
      if (!e2 && m2) {
        await ensureSetsForMatch(m2.id);
        created++;
      } else if (e2) {
        alert(e2.message);
        return;
      }
    }
    if (created === 0) alert("Bracket placeholders already exist.");
    setRefresh((x) => x + 1);
  }

  async function assignMatchTeams(mid) {
    if (!client) return;
    const sel = bracketAssign[mid] || {};
    const t1 = sel.team1 || null;
    const t2 = sel.team2 || null;
    if (!t1 || !t2 || t1 === t2) {
      alert("Pick two different teams to assign");
      return;
    }
    const { error } = await client.from("matches").update({ team1_id: t1, team2_id: t2 }).eq("id", mid);
    if (error) {
      alert(error.message);
      return;
    }
    await ensureSetsForMatch(mid);
    setRefresh((x) => x + 1);
  }

  async function clearMatchTeams(mid) {
    if (!client) return;
    const { error } = await client.from("matches").update({ team1_id: null, team2_id: null }).eq("id", mid);
    if (error) {
      alert(error.message);
      return;
    }
    setBracketAssign((prev) => ({ ...prev, [mid]: { team1: "", team2: "" } }));
    setRefresh((x) => x + 1);
  }

  // Auto-seed semis using Pool A/B standings: A1 vs B2 and A2 vs B1
  async function autoSeedSemisFromPools() {
    try {
      if (!selectedTid) {
        alert("Select a tournament first");
        return;
      }
      if (!Array.isArray(leaderboardByPool) || leaderboardByPool.length === 0) {
        alert("No pool standings yet. Make sure pools and matches are recorded.");
        return;
      }

      // Accepts names like "A", "Pool A", or anything that ends with " A"
      const entryFor = (letter) =>
        leaderboardByPool.find(({ pool }) => {
          const n = ((pool?.name || pool?.label || "") + "").trim().toUpperCase();
          return n === letter || n === `POOL ${letter}` || n.endsWith(` ${letter}`);
        });

      const A = entryFor("A");
      const B = entryFor("B");
      if (!A || !B) {
        alert("Couldn't find Pool A and Pool B. Please name pools 'Pool A' and 'Pool B'.");
        return;
      }

      const A1 = A.standings?.[0],
        A2 = A.standings?.[1];
      const B1 = B.standings?.[0],
        B2 = B.standings?.[1];
      if (!A1 || !A2 || !B1 || !B2) {
        alert("Need top 2 from each pool to auto-seed.");
        return;
      }

      const semis = matches.filter((m) => (m.stage || "").toLowerCase() === "semi");
      if (semis.length < 2) {
        alert("Please generate two Semi-Final placeholders first.");
        return;
      }
      const [s1, s2] = semis
        .slice(0, 2)
        .sort((x, y) => (x.id || 0) - (y.id || 0));

      const updates = [
        { id: s1.id, team1_id: A1.id, team2_id: B2.id },
        { id: s2.id, team1_id: A2.id, team2_id: B1.id },
      ];

      for (const u of updates) {
        const { error } = await client
          .from("matches")
          .update({ team1_id: u.team1_id, team2_id: u.team2_id })
          .eq("id", u.id);
        if (error) {
          alert(error.message);
          return;
        }
        await ensureSetsForMatch(u.id);
        setBracketAssign((prev) => ({ ...prev, [u.id]: { team1: u.team1_id, team2: u.team2_id } }));
      }

      setRefresh((x) => x + 1);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to auto-seed semis.");
    }
  }

  // ---- Leaderboards ----
  // Overall leaderboard (all teams in tournament)
  const leaderboard = useMemo(() => {
    const map = new Map();
    teams
      .filter((t) => tournamentTeams.includes(t.id))
      .forEach((t) =>
        map.set(t.id, {
          id: t.id,
          name: t.name,
          w: 0,
          l: 0,
          sw: 0,
          sl: 0,
          pf: 0,
          pa: 0,
          pd: 0,
          pts: 0,
          pf_wins: 0,
          pa_wins: 0,
          wpd: 0,
        })
      );

    const setsByMatch = allSets.reduce((acc, s) => {
      (acc[s.match_id] ||= []).push(s);
      return acc;
    }, {});

    for (const m of matches) {
      if (m.status !== "completed") continue;
      const sets = (setsByMatch[m.id] || []).sort((a, b) => a.set_number - b.set_number);

      let sw1 = 0,
        sw2 = 0,
        pf1 = 0,
        pf2 = 0;
      for (const s of sets) {
        pf1 += s.team1_points;
        pf2 += s.team2_points;
        if (s.team1_points > s.team2_points) sw1++;
        else if (s.team2_points > s.team1_points) sw2++;
      }
      const winId = m.winner_team_id || computeWinnerId(m, sets);

      if (map.has(m.team1_id)) {
        const r1 = map.get(m.team1_id);
        r1.sw += sw1;
        r1.sl += sw2;
        r1.pf += pf1;
        r1.pa += pf2;
        r1.pd = r1.pf - r1.pa;
        const t1Won = winId === m.team1_id;
        r1.pts += matchPointsForTeam(sw1, sw2, t1Won);
        if (t1Won) {
          r1.w++;
          r1.pf_wins += pf1;
          r1.pa_wins += pf2;
          r1.wpd = r1.pf_wins - r1.pa_wins;
        } else r1.l++;
      }

      if (map.has(m.team2_id)) {
        const r2 = map.get(m.team2_id);
        r2.sw += sw2;
        r2.sl += sw1;
        r2.pf += pf2;
        r2.pa += pf1;
        r2.pd = r2.pf - r2.pa;
        const t2Won = winId === m.team2_id;
        r2.pts += matchPointsForTeam(sw2, sw1, t2Won);
        if (t2Won) {
          r2.w++;
          r2.pf_wins += pf2;
          r2.pa_wins += pf1;
          r2.wpd = r2.pf_wins - r2.pa_wins;
        } else r2.l++;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        b.pts - a.pts ||
        b.w - a.w ||
        b.wpd - a.wpd ||
        b.pd - a.pd ||
        b.sw - a.sw ||
        a.name.localeCompare(b.name)
    );
  }, [teams, matches, allSets, tournamentTeams]);

  // Leaderboard grouped by pool
  const leaderboardByPool = useMemo(() => {
    if (!pools.length) return [];

    const byPool = new Map();
    for (const p of pools) byPool.set(p.id, new Set());
    for (const pt of poolTeams) byPool.get(pt.pool_id)?.add(pt.team_id);

    const setsByMatch = allSets.reduce((acc, s) => {
      (acc[s.match_id] ||= []).push(s);
      return acc;
    }, {});

    function computePoolTable(teamIdsSet) {
      const map = new Map();
      teams
        .filter((t) => teamIdsSet.has(t.id))
        .forEach((t) =>
          map.set(t.id, {
            id: t.id,
            name: t.name,
            w: 0,
            l: 0,
            sw: 0,
            sl: 0,
            pf: 0,
            pa: 0,
            pd: 0,
            pts: 0,
            pf_wins: 0,
            pa_wins: 0,
            wpd: 0,
          })
        );

      for (const m of matches) {
        if (m.status !== "completed") continue;
        const sets = (setsByMatch[m.id] || []).sort((a, b) => a.set_number - b.set_number);

        let sw1 = 0,
          sw2 = 0,
          pf1 = 0,
          pf2 = 0;
        for (const s of sets) {
          pf1 += s.team1_points;
          pf2 += s.team2_points;
          if (s.team1_points > s.team2_points) sw1++;
          else if (s.team2_points > s.team1_points) sw2++;
        }
        const winId = m.winner_team_id || computeWinnerId(m, sets);

        if (teamIdsSet.has(m.team1_id)) {
          const r1 = map.get(m.team1_id);
          if (r1) {
            r1.sw += sw1;
            r1.sl += sw2;
            r1.pf += pf1;
            r1.pa += pf2;
            r1.pd = r1.pf - r1.pa;
            const t1Won = winId === m.team1_id;
            r1.pts += matchPointsForTeam(sw1, sw2, t1Won);
            if (t1Won) {
              r1.w++;
              r1.pf_wins += pf1;
              r1.pa_wins += pf2;
              r1.wpd = r1.pf_wins - r1.pa_wins;
            } else r1.l++;
          }
        }
        if (teamIdsSet.has(m.team2_id)) {
          const r2 = map.get(m.team2_id);
          if (r2) {
            r2.sw += sw2;
            r2.sl += sw1;
            r2.pf += pf2;
            r2.pa += pf1;
            r2.pd = r2.pf - r2.pa;
            const t2Won = winId === m.team2_id;
            r2.pts += matchPointsForTeam(sw2, sw1, t2Won);
            if (t2Won) {
              r2.w++;
              r2.pf_wins += pf2;
              r2.pa_wins += pf1;
              r2.wpd = r2.pf_wins - r2.pa_wins;
            } else r2.l++;
          }
        }
      }

      return Array.from(map.values()).sort(
        (a, b) =>
          b.pts - a.pts ||
          b.w - a.w ||
          b.wpd - a.wpd ||
          b.pd - a.pd ||
          b.sw - a.sw ||
          a.name.localeCompare(b.name)
      );
    }

    return pools.map((p) => ({
      pool: p,
      standings: computePoolTable(byPool.get(p.id) || new Set()),
    }));
  }, [pools, poolTeams, teams, matches, allSets]);

  // Team map
  const teamById = useMemo(() => {
    const m = new Map();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  // Create match
  async function createMatch() {
    if (!client || !selectedTid) {
      alert("Select a tournament first");
      return;
    }
    const { team1_id, team2_id, scheduled_at, stage } = newMatch;
    if (!team1_id || !team2_id || team1_id === team2_id) {
      alert("Pick two different teams");
      return;
    }
    const { data: m, error } = await client
      .from("matches")
      .insert({ tournament_id: selectedTid, team1_id, team2_id, status: "scheduled", scheduled_at, stage: stage || "pool" })
      .select("*")
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    await client.from("sets").insert([1, 2, 3].map((n) => ({ match_id: m.id, set_number: n })));
    setShowCreate(false);
    setNewMatch({ team1_id: "", team2_id: "", scheduled_at: "", stage: "pool" });
    setRefresh((x) => x + 1);
  }

  async function upsertSetPoints(match_id, set_number, team1_points, team2_points) {
    const { data: existing } = await client
      .from("sets")
      .select("id")
      .eq("match_id", match_id)
      .eq("set_number", set_number)
      .single();
    if (existing) await client.from("sets").update({ team1_points, team2_points }).eq("id", existing.id);
    else await client.from("sets").insert({ match_id, set_number, team1_points, team2_points });
    setRefresh((x) => x + 1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6" />
              <h1 className="text-xl md:text-2xl font-semibold">Volleyball Tournament Admin</h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedTid} onChange={(e) => setSelectedTid(e.target.value)} className="min-w-[220px]">
                <option value="">Select tournament…</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button className={`${isAdmin ? "bg-black text-white" : ""}`} onClick={() => setIsAdmin((v) => !v)}>
                <Settings className="w-4 h-4" />
                {isAdmin ? "Admin" : "Viewer"}
              </Button>
            </div>
          </div>

          {/* Leaderboards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Overall Leaderboard
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left opacity-70">
                      <th className="py-2">#</th>
                      <th className="py-2">Team</th>
                      <th className="py-2">Pts</th>
                      <th className="py-2">W</th>
                      <th className="py-2">L</th>
                      <th className="py-2">SW</th>
                      <th className="py-2">SL</th>
                      <th className="py-2">Pts±</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r, i) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2">{i + 1}</td>
                        <td className="py-2 font-medium">{r.name}</td>
                        <td className="py-2">{r.pts}</td>
                        <td className="py-2">{r.w}</td>
                        <td className="py-2">{r.l}</td>
                        <td className="py-2">{r.sw}</td>
                        <td className="py-2">{r.sl}</td>
                        <td className="py-2">{r.pd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Leaderboard by Pool
                </h2>
              </div>
              <div className="space-y-4">
                {leaderboardByPool.map(({ pool, standings }) => (
                  <div key={pool.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{pool.name || pool.label || `Pool ${pool.id}`}</div>
                      <button
                        className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1"
                        onClick={() => setExpanded((e) => ({ ...e, [pool.id]: !e[pool.id] }))}
                      >
                        {expanded[pool.id] ? (
                          <>
                            Hide <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Show <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                    <div className={`${expanded[pool.id] === false ? "hidden" : ""}`}>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left opacity-70">
                              <th className="py-2">#</th>
                              <th className="py-2">Team</th>
                              <th className="py-2">Pts</th>
                              <th className="py-2">W</th>
                              <th className="py-2">L</th>
                              <th className="py-2">SW</th>
                              <th className="py-2">SL</th>
                              <th className="py-2">Pts±</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((r, i) => (
                              <tr key={r.id} className="border-t">
                                <td className="py-2">{i + 1}</td>
                                <td className="py-2 font-medium">{r.name}</td>
                                <td className="py-2">{r.pts}</td>
                                <td className="py-2">{r.w}</td>
                                <td className="py-2">{r.l}</td>
                                <td className="py-2">{r.sw}</td>
                                <td className="py-2">{r.sl}</td>
                                <td className="py-2">{r.pd}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Bracket (Semis & Final) */}
          {selectedTid && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Bracket
                </h2>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button onClick={createBracketPlaceholders} className="bg-black text-white">
                      Generate placeholders
                    </Button>
                    <Button onClick={autoSeedSemisFromPools} className="bg-white">
                      Auto-seed A1/B2 & A2/B1
                    </Button>
                  </div>
                )}
              </div>

              {(() => {
                const semis = matches.filter((m) => (m.stage || "").toLowerCase() === "semi");
                const finals = matches.filter((m) => (m.stage || "").toLowerCase() === "final");
                const allIds = new Set(tournamentTeams);
                return (
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm font-medium mb-2">Semi-Finals</div>
                      {semis.length ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {semis.map((m, idx) => {
                            const b = bracketAssign[m.id] || { team1: m.team1_id || "", team2: m.team2_id || "" };
                            return (
                              <div key={m.id} className="rounded-2xl border p-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm opacity-70">Semi {idx + 1}</div>
                                  <div className="text-xs opacity-60">{m.status}</div>
                                </div>
                                <div className="mt-2 font-medium">
                                  {m.team1?.name || "TBD"} <span className="opacity-60">vs</span> {m.team2?.name || "TBD"}
                                </div>
                                {isAdmin && (
                                  <div className="grid sm:grid-cols-3 gap-2 mt-3">
                                    <Select
                                      value={b.team1}
                                      onChange={(e) =>
                                        setBracketAssign((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), team1: e.target.value } }))
                                      }
                                    >
                                      <option value="">Team 1…</option>
                                      {teams
                                        .filter((t) => allIds.has(t.id))
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                    </Select>
                                    <Select
                                      value={b.team2}
                                      onChange={(e) =>
                                        setBracketAssign((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), team2: e.target.value } }))
                                      }
                                    >
                                      <option value="">Team 2…</option>
                                      {teams
                                        .filter((t) => allIds.has(t.id))
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                    </Select>
                                    <div className="flex gap-2">
                                      <Button onClick={() => assignMatchTeams(m.id)} className="bg-white">
                                        Save
                                      </Button>
                                      <Button onClick={() => clearMatchTeams(m.id)} className="bg-white">
                                        Clear
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm opacity-60">No semi-final matches yet.</div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2">Final</div>
                      {finals.length ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {finals.map((m) => {
                            const b = bracketAssign[m.id] || { team1: m.team1_id || "", team2: m.team2_id || "" };
                            return (
                              <div key={m.id} className="rounded-2xl border p-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm opacity-70">Championship</div>
                                  <div className="text-xs opacity-60">{m.status}</div>
                                </div>
                                <div className="mt-2 font-medium">
                                  {m.team1?.name || "TBD"} <span className="opacity-60">vs</span> {m.team2?.name || "TBD"}
                                </div>
                                {isAdmin && (
                                  <div className="grid sm:grid-cols-3 gap-2 mt-3">
                                    <Select
                                      value={b.team1}
                                      onChange={(e) =>
                                        setBracketAssign((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), team1: e.target.value } }))
                                      }
                                    >
                                      <option value="">Team 1…</option>
                                      {teams
                                        .filter((t) => allIds.has(t.id))
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                    </Select>
                                    <Select
                                      value={b.team2}
                                      onChange={(e) =>
                                        setBracketAssign((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), team2: e.target.value } }))
                                      }
                                    >
                                      <option value="">Team 2…</option>
                                      {teams
                                        .filter((t) => allIds.has(t.id))
                                        .map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.name}
                                          </option>
                                        ))}
                                    </Select>
                                    <div className="flex gap-2">
                                      <Button onClick={() => assignMatchTeams(m.id)} className="bg-white">
                                        Save
                                      </Button>
                                      <Button onClick={() => clearMatchTeams(m.id)} className="bg-white">
                                        Clear
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm opacity-60">No final match yet.</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Matches (per tournament) */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Matches
              </h2>
              {isAdmin && <Button onClick={() => setShowCreate((v) => !v)} className="bg-white"><PlusCircle className="w-4 h-4" /> New match</Button>}
            </div>

            {isAdmin && showCreate && (
              <div className="rounded-xl border p-3 mb-4 bg-white">
                <div className="grid md:grid-cols-5 gap-2">
                  <Select value={newMatch.team1_id} onChange={(e) => setNewMatch((m) => ({ ...m, team1_id: e.target.value }))}>
                    <option value="">Team 1…</option>
                    {teams
                      .filter((t) => tournamentTeams.includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </Select>
                  <Select value={newMatch.team2_id} onChange={(e) => setNewMatch((m) => ({ ...m, team2_id: e.target.value }))}>
                    <option value="">Team 2…</option>
                    {teams
                      .filter((t) => tournamentTeams.includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </Select>
                  <Input type="datetime-local" value={newMatch.scheduled_at} onChange={(e) => setNewMatch((m) => ({ ...m, scheduled_at: e.target.value }))} />
                  <Select value={newMatch.stage} onChange={(e) => setNewMatch((m) => ({ ...m, stage: e.target.value }))}>
                    <option value="pool">Pool</option>
                    <option value="semi">Semi</option>
                    <option value="final">Final</option>
                  </Select>
                  <Button onClick={createMatch} className="bg-black text-white">
                    <CheckCircle2 className="w-4 h-4" /> Create
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left opacity-70">
                    <th className="py-2">#</th>
                    <th className="py-2">Teams</th>
                    <th className="py-2">Stage</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">When</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .filter((m) => m.tournament_id === selectedTid)
                    .map((m, i) => (
                      <tr key={m.id} className="border-t">
                        <td className="py-2">{i + 1}</td>
                        <td className="py-2">
                          <div>
                            {m.team1?.name} vs {m.team2?.name}
                          </div>
                          <div className="text-xs opacity-60">Match #{m.id}</div>
                        </td>
                        <td className="py-2 capitalize">{m.stage || "pool"}</td>
                        <td className="py-2 capitalize">{m.status}</td>
                        <td className="py-2">{fmtDateTime(m.scheduled_at)}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => openMatch(m.id)} className="bg-white">
                              <PlayCircle className="w-4 h-4" /> Open
                            </Button>
                            {isAdmin && (
                              <Button onClick={() => deleteMatch(m.id)} className="bg-white text-red-600">
                                <Trash2 className="w-4 h-4" /> Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Live scoring */}
          {selectedMatch && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">
                  Live Scoring — {selectedMatch.match.team1?.name} vs {selectedMatch.match.team2?.name}
                </div>
                <Button onClick={() => setSelectedMatch(null)} className="bg-white">
                  <X className="w-4 h-4" /> Close
                </Button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {(selectedMatch.sets || []).map((s) => (
                  <div key={s.id || s.set_number} className="rounded-xl border p-3">
                    <div className="text-sm opacity-70">Set {s.set_number}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Input
                        type="number"
                        value={s.team1_points || 0}
                        onChange={(e) =>
                          upsertSetPoints(
                            selectedMatch.match.id,
                            s.set_number,
                            parseInt(e.target.value || "0", 10),
                            s.team2_points || 0
                          )
                        }
                      />
                      <Input
                        type="number"
                        value={s.team2_points || 0}
                        onChange={(e) =>
                          upsertSetPoints(
                            selectedMatch.match.id,
                            s.set_number,
                            s.team1_points || 0,
                            parseInt(e.target.value || "0", 10)
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={completeMatch} className="bg-black text-white">
                  <CheckCircle2 className="w-4 h-4" /> Complete Match
                </Button>
              </div>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <div className="text-sm opacity-70 leading-relaxed">
              <div className="font-medium mb-1">Scoring & Seeding Rules</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>2 points per set won.</li>
                <li>Bonus: +2 for a 2–0 win; +1 for a 2–1 win.</li>
                <li>Sort: Pts → Wins → WPD (points diff in matches won) → Overall Pts± → Set Wins → Team Name.</li>
                <li>Bracket: placeholders for two Semis + one Final; Auto-seed pairs A1 vs B2 and A2 vs B1.</li>
              </ul>
            </div>
          </Card>

          <div className="text-xs opacity-50 mt-6">Tip: add badges for top seeds, or auto-promote semifinal winners into the Final.</div>
        </div>
      </div>
    </div>
  );
}
