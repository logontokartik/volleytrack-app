import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Plus, Volleyball, Upload, Database, Calendar, Users, Trophy, Save, Edit3, Trash2, RefreshCcw, LogIn, LogOut, Lock, Share2, X, Layers } from "lucide-react";

// === Points Scoring Helpers ===
function matchBonus(swOwn, swOpp, didWin) {
  return didWin ? (swOpp === 0 ? 2 : 1) : 0; // 2-0 => +2; 2-1 => +1; losses => +0
}
function matchPointsForTeam(swOwn, swOpp, didWin) {
  return 2 * swOwn + matchBonus(swOwn, swOpp, didWin);
}
// === End Points Scoring Helpers ===


/*
  Mobile-focused improvements in this version:
  • Card lists on small screens for Leaderboard and Matches
  • Larger tap targets (min-h/w 44px), better spacing
  • Fixed, sticky bottom scoring bar on phones for quick +/– and complete
  • Safe-area support (iOS notch) via env(safe-area-inset-bottom)
*/

// ---------- Supabase schema overview (full SQL at bottom of script) ----------
// app_admins, teams, tournaments, tournament_teams, matches (winner_team_id), sets

// --- Minimal UI primitives ---
const Card = ({ children }) => (
  <div className="rounded-2xl shadow-sm border p-4 bg-white">{children}</div>
);
const Button = ({ className = "", disabled=false, ...props }) => (
  <button
    {...props}
    disabled={disabled}
    className={
      "px-4 py-2 min-h-11 rounded-2xl shadow-sm border text-sm hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99] " +
      className
    }
  />
);
const IconBtn = ({ className = "", ...props }) => (
  <button
    {...props}
    className={
      "grid place-items-center min-h-11 min-w-11 rounded-2xl border shadow-sm active:scale-[0.98] " +
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

// Mobile detector
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

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

// Winner helper (not strict volleyball rules)
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

function pointsToWinForMatch(match, setNumber) {
  const stage = (match?.stage || "pool").toLowerCase();
  if (setNumber === 3) return 15; // third set always to 15
  if (stage === "semi" || stage === "final") return 25; // bracket matches
  return 21; // pool matches
}
function setWinnerStrictForMatch(s, match) {
  const target = pointsToWinForMatch(match, s.set_number);
  const d1 = s.team1_points - s.team2_points;
  const d2 = s.team2_points - s.team1_points;
  if (s.team1_points >= target && d1 >= 2) return 1;
  if (s.team2_points >= target && d2 >= 2) return 2;
  return 0;
}
function getActiveSet(sets, match) {
  const unfinished = sets.find((x) => setWinnerStrictForMatch(x, match) === 0);
  return unfinished || sets[sets.length - 1];
}

export default function App() {
  const isMobile = useIsMobile();
  const { client, cfg, save } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTid, setSelectedTid] = useState("");
  const [tournamentTeams, setTournamentTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [pools, setPools] = useState([]);
  const [poolTeams, setPoolTeams] = useState([]);
  const [groupByPool, setGroupByPool] = useState(true);
  const [newTeam, setNewTeam] = useState("");
  const [newTournament, setNewTournament] = useState("");
  const [newPoolName, setNewPoolName] = useState("");
  const [poolAdd, setPoolAdd] = useState({});
  const [assignTeamId, setAssignTeamId] = useState("");
  const [schedule, setSchedule] = useState({ team1: "", team2: "", when: "", stage: "pool" });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bracketAssign, setBracketAssign] = useState({}); // { [matchId]: { team1, team2 } }
  const [bracketTimes, setBracketTimes] = useState({ semi1: "", semi2: "", final: "" }); // { [matchId]: { team1, team2 } }

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
        const { data: capRow } = await client
          .from("app_captains")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsCaptain(!!capRow);
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
  // Pools loader (per tournament)
  useEffect(() => {
    if (!client || !selectedTid) { setPools([]); setPoolTeams([]); return; }
    (async () => {
      try {
        const { data: ps, error: e1 } = await client
          .from("pools")
          .select("*")
          .eq("tournament_id", selectedTid)
          .order("name");
        if (e1) console.warn(e1);
        setPools(ps || []);

        if (ps && ps.length) {
          const { data: pts, error: e2 } = await client
            .from("pool_teams")
            .select("*")
            .in("pool_id", ps.map(p => p.id));
          if (e2) console.warn(e2);
          setPoolTeams(pts || []);
        } else {
          setPoolTeams([]);
        }
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [client, selectedTid, refresh]);

  /* Realtime: live scores */
  useEffect(() => {
    if (!client || !selectedTid) return;
    const channel = client
      .channel(`live-scores:${selectedTid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sets' }, (payload) => {
        const row = payload.new;
        // Only care about sets for matches in current view
        if (!matches.some(mm => mm.id === row.match_id)) return;
        setAllSets(prev => {
          if (prev.some(s => s.id === row.id)) return prev;
          return [...prev, row];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sets' }, (payload) => {
        const row = payload.new;
        if (!matches.some(mm => mm.id === row.match_id)) return;
        setAllSets(prev => {
          const i = prev.findIndex(s => s.id === row.id);
          if (i === -1) return [...prev, row];
          const copy = prev.slice();
          copy[i] = row;
          return copy;
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
        const row = payload.new;
        if (row.tournament_id !== selectedTid) return;
        setMatches(prev => {
          const i = prev.findIndex(m => m.id === row.id);
          if (i === -1) return prev;
          const copy = prev.slice();
          copy[i] = { ...copy[i], ...row };
          return copy;
        });
      })
      .subscribe();

    return () => {
      try { client.removeChannel(channel); } catch (_) {}
    };
  }, [client, selectedTid, matches]);

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
  async function addPool() {
    if (!client || !selectedTid || !newPoolName.trim()) return;
    const { error } = await client.from("pools").insert({ name: newPoolName.trim(), tournament_id: selectedTid });
    if (error) { alert(error.message); return; }
    setNewPoolName("");
    setRefresh(x => x + 1);
  }

  async function deletePool(poolId) {
    if (!client) return;
    await client.from("pool_teams").delete().eq("pool_id", poolId);
    const { error } = await client.from("pools").delete().eq("id", poolId);
    if (error) { alert(error.message); return; }
    setRefresh(x => x + 1);
  }

  async function addTeamToPool(poolId, teamId) {
    if (!client || !poolId || !teamId) return;
    const { error } = await client.from("pool_teams").insert({ pool_id: poolId, team_id: teamId });
    if (error) { alert(error.message); return; }
    setPoolAdd(prev => ({...prev, [poolId]: ""}));
    setRefresh(x => x + 1);
  }

  async function removeTeamFromPool(poolId, teamId) {
    if (!client) return;
    const { error } = await client.from("pool_teams").delete().eq("pool_id", poolId).eq("team_id", teamId);
    if (error) { alert(error.message); return; }
    setRefresh(x => x + 1);
  }

  async function scheduleMatch() {
    if (!client) return;
    const { team1, team2, when } = schedule;
    if (!selectedTid) return alert("Select a tournament first");
    if (!team1 || !team2 || team1 === team2) return alert("Pick two different teams");
    const scheduled_at = when ? new Date(when).toISOString() : null;
    setLoading(true);
    const { data: m, error } = await client
      .from("matches")
      .insert({ tournament_id: selectedTid, team1_id: team1, team2_id: team2, scheduled_at, status: "scheduled", stage: schedule.stage || "pool" })
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

    // Create up to 2 semi placeholders with optional scheduled_at from bracketTimes
    for (let i = semis.length; i < 2; i++) {
      const when = i === semis.length ? (bracketTimes.semi1 || null) : (bracketTimes.semi2 || null);
      const { data: m, error } = await client
        .from("matches")
        .insert({
          tournament_id: selectedTid,
          team1_id: null,
          team2_id: null,
          status: "scheduled",
          stage: "semi",
          scheduled_at: when,
        })
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

    // Create 1 final placeholder with optional scheduled_at from bracketTimes
    if (finals.length < 1) {
      const { data: m2, error: e2 } = await client
        .from("matches")
        .insert({
          tournament_id: selectedTid,
          team1_id: null,
          team2_id: null,
          status: "scheduled",
          stage: "final",
          scheduled_at: bracketTimes.final || null,
        })
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

    // If nothing new was created but admin entered times, apply to existing placeholders
    if (created === 0) {
      const semisNow = matches.filter((m) => (m.stage || "").toLowerCase() === "semi").slice(0, 2).sort((a, b) => (a.id || 0) - (b.id || 0));
      if (semisNow.length >= 1 && bracketTimes.semi1) {
        await client.from("matches").update({ scheduled_at: bracketTimes.semi1 }).eq("id", semisNow[0].id);
      }
      if (semisNow.length >= 2 && bracketTimes.semi2) {
        await client.from("matches").update({ scheduled_at: bracketTimes.semi2 }).eq("id", semisNow[1].id);
      }
      const finalsNow = matches.filter((m) => (m.stage || "").toLowerCase() === "final");
      if (finalsNow.length >= 1 && bracketTimes.final) {
        await client.from("matches").update({ scheduled_at: bracketTimes.final }).eq("id", finalsNow[0].id);
      }
      if (!bracketTimes.semi1 && !bracketTimes.semi2 && !bracketTimes.final) {
        alert("Bracket placeholders already exist.");
      }
    }

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


  // Leaderboard (completed matches only, per selected tournament)
  
  // Overall leaderboard (all teams in tournament)
  const leaderboard = React.useMemo(() => {
  const map = new Map();
  teams
    .filter(t => tournamentTeams.includes(t.id))
    .forEach(t => map.set(t.id, {
      id: t.id, name: t.name,
      w: 0, l: 0, sw: 0, sl: 0,
      pf: 0, pa: 0, pd: 0,
      pts: 0,           // total points (sets + bonus)
      pf_wins: 0, pa_wins: 0, wpd: 0 // points diff in matches they won (tiebreaker)
    }));

  const setsByMatch = allSets.reduce((acc, s) => { (acc[s.match_id] ||= []).push(s); return acc; }, {});

  for (const m of matches) {
    if (m.status !== 'completed') continue;
    const sets = (setsByMatch[m.id] || []).sort((a,b)=>a.set_number-b.set_number);

    let sw1=0, sw2=0, pf1=0, pf2=0;
    for (const s of sets) {
      pf1 += s.team1_points; pf2 += s.team2_points;
      if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++;
    }
    const winId = m.winner_team_id || computeWinnerId(m, sets);

    // team1 row
    if (map.has(m.team1_id)) {
      const r1 = map.get(m.team1_id);
      r1.sw += sw1; r1.sl += sw2; r1.pf += pf1; r1.pa += pf2; r1.pd = r1.pf - r1.pa;
      const t1Won = (winId === m.team1_id);
      r1.pts += matchPointsForTeam(sw1, sw2, t1Won);
      if (t1Won) { r1.w++; r1.pf_wins += pf1; r1.pa_wins += pf2; r1.wpd = r1.pf_wins - r1.pa_wins; }
      else { r1.l++; }
    }

    // team2 row
    if (map.has(m.team2_id)) {
      const r2 = map.get(m.team2_id);
      r2.sw += sw2; r2.sl += sw1; r2.pf += pf2; r2.pa += pf1; r2.pd = r2.pf - r2.pa;
      const t2Won = (winId === m.team2_id);
      r2.pts += matchPointsForTeam(sw2, sw1, t2Won);
      if (t2Won) { r2.w++; r2.pf_wins += pf2; r2.pa_wins += pf1; r2.wpd = r2.pf_wins - r2.pa_wins; }
      else { r2.l++; }
    }
  }

  return Array.from(map.values()).sort((a,b)=>
    (b.pts - a.pts) ||
    (b.w - a.w) ||
    (b.wpd - a.wpd) ||
    (b.pd - a.pd) ||
    (b.sw - a.sw) ||
    a.name.localeCompare(b.name)
  );
}, [teams, matches, allSets, tournamentTeams]);


  // Leaderboard grouped by pool (matches counted only when BOTH teams are in the same pool)
  
  const leaderboardByPool = React.useMemo(() => {
  if (!pools.length) return [];

  const byPool = new Map();
  for (const p of pools) byPool.set(p.id, new Set());
  for (const pt of poolTeams) {
    const set = byPool.get(pt.pool_id);
    if (set) set.add(pt.team_id);
  }

  const setsByMatch = allSets.reduce((acc, s) => { (acc[s.match_id] ||= []).push(s); return acc; }, {});

  function computePoolTable(teamIdsSet) {
    const map = new Map();
    teams
      .filter(t => teamIdsSet.has(t.id))
      .forEach(t => map.set(t.id, {
        id: t.id, name: t.name,
        w: 0, l: 0, sw: 0, sl: 0,
        pf: 0, pa: 0, pd: 0,
        pts: 0, pf_wins: 0, pa_wins: 0, wpd: 0
      }));

    for (const m of matches) {
      if (m.status !== 'completed') continue;
      const sets = (setsByMatch[m.id] || []).sort((a,b)=>a.set_number-b.set_number);

      let sw1=0, sw2=0, pf1=0, pf2=0;
      for (const s of sets) {
        pf1 += s.team1_points; pf2 += s.team2_points;
        if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++;
      }
      const winId = m.winner_team_id || computeWinnerId(m, sets);

      if (teamIdsSet.has(m.team1_id)) {
        const r1 = map.get(m.team1_id);
        if (r1) {
          r1.sw += sw1; r1.sl += sw2; r1.pf += pf1; r1.pa += pf2; r1.pd = r1.pf - r1.pa;
          const t1Won = (winId === m.team1_id);
          r1.pts += matchPointsForTeam(sw1, sw2, t1Won);
          if (t1Won) { r1.w++; r1.pf_wins += pf1; r1.pa_wins += pf2; r1.wpd = r1.pf_wins - r1.pa_wins; }
          else { r1.l++; }
        }
      }
      if (teamIdsSet.has(m.team2_id)) {
        const r2 = map.get(m.team2_id);
        if (r2) {
          r2.sw += sw2; r2.sl += sw1; r2.pf += pf2; r2.pa += pf1; r2.pd = r2.pf - r2.pa;
          const t2Won = (winId === m.team2_id);
          r2.pts += matchPointsForTeam(sw2, sw1, t2Won);
          if (t2Won) { r2.w++; r2.pf_wins += pf2; r2.pa_wins += pf1; r2.wpd = r2.pf_wins - r2.pa_wins; }
          else { r2.l++; }
        }
      }
    }

    return Array.from(map.values()).sort((a,b)=>
      (b.pts - a.pts) ||
      (b.w - a.w) ||
      (b.wpd - a.wpd) ||
      (b.pd - a.pd) ||
      (b.sw - a.sw) ||
      a.name.localeCompare(b.name)
    );
  }

  return pools.map(p => ({
    pool: p,
    standings: computePoolTable(byPool.get(p.id) || new Set())
  }));
}, [pools, poolTeams, teams, matches, allSets]);


  const showSetup = !(cfg?.fromEnv && cfg.url && cfg.key);
  const selectedTournament = tournaments.find(t=>t.id===selectedTid);

  function copyShareLink() {
    if (!selectedTid) return alert('Select a tournament first');
    const t = tournaments.find(x=>x.id===selectedTid);
    const u = new URL(location.href);
    u.searchParams.set(t?.slug ? 'slug' : 't', t?.slug || selectedTid);
    navigator.clipboard.writeText(u.toString());
    alert('Shareable link copied to clipboard');
  }

  // ------ UI ------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volleyball className="w-7 h-7" />
            <h1 className="text-2xl font-semibold">GVW Volleyball Tracker</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-2"><Database className="w-4 h-4" /> <span className="opacity-70">{cfg.url ? (cfg.fromEnv?"DB Ready":"DB Configurable") : "No DB"}</span></div>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-70">Tournament:</span>
              <Select value={selectedTid} onChange={(e)=>setSelectedTid(e.target.value)} className="min-w-[220px]">
                <option value="">Select a tournament…</option>
                {tournaments.map(t=> (<option key={t.id} value={t.id}>{t.name}</option>))}
              </Select>
              <Button onClick={copyShareLink} className="bg-white flex items-center gap-2"><Share2 className="w-4 h-4"/>Share</Button>
            </div>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input placeholder="New tournament name" value={newTournament} onChange={(e)=>setNewTournament(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={addTournament} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
                  {selectedTid && <Button onClick={()=>deleteTournament(selectedTid)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>}
                </div>
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
            <div className="grid sm:grid-cols-3 gap-3">
              <Input type="email" placeholder="admin@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <Input type="password" placeholder="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <Button onClick={signIn} className="bg-black text-white flex items-center justify-center gap-2"><LogIn className="w-4 h-4"/>Sign in</Button>
            </div>
          </Card>
        )}

        {/* Setup (hidden if env vars provided) */}
        {showSetup && (
          <Card>
            <div className="grow">
              <h2 className="text-lg font-medium flex items-center gap-2"><Upload className="w-4 h-4"/> Supabase Setup</h2>
              <p className="text-sm opacity-80 mt-1">Enter your Supabase URL and anon key (Project settings → API). Stored locally in your browser. For public deployments, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel and this panel will disappear.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <Input placeholder="SUPABASE_URL" defaultValue={cfg.url} onBlur={(e)=>save(e.target.value, cfg.key)} />
              <Input placeholder="SUPABASE_ANON_KEY" defaultValue={cfg.key} onBlur={(e)=>save(cfg.url, e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={()=>setRefresh(x=>x+1)} className="bg-black text-white flex items-center gap-2"><RefreshCcw className="w-4 h-4"/>Reconnect</Button>
                <Button onClick={()=>{localStorage.removeItem("volleytrack_supabase"); location.reload();}} className="bg-white">Reset</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Leaderboard (per tournament) */}
        
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Leaderboard</h2>
            <div className="flex items-center gap-3">
              {pools.length > 0 && (
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={groupByPool} onChange={(e)=>setGroupByPool(e.target.checked)} />
                  Group by pool
                </label>
              )}
              <span className="text-xs opacity-60">{groupByPool && pools.length ? `${pools.length} pools` : `${leaderboard.length} teams`}</span>
            </div>
          </div>
          {!selectedTid ? (
            <div className="text-sm opacity-60">Select a tournament to view the leaderboard.</div>
          ) : groupByPool && pools.length ? (
            <div className="space-y-4">
              {leaderboardByPool.map(({pool, standings}) => (
                <div key={pool.id} className="rounded-2xl border">
                  <div className="px-3 py-2 bg-gray-50 rounded-t-2xl text-sm font-medium">{pool.name}</div>
                  <div className="p-3">
                    {isMobile ? (
                      <ul className="space-y-2">
                        {standings.map((r,i)=> (
                          <li key={r.id} className="rounded-2xl border p-3 flex items-center justify-between">
                            <div>
                              <div className="text-xs opacity-60">#{i+1}</div>
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs opacity-70">Pts {r.pts} • SW {r.sw} • Pts± {r.pd}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-semibold">{r.w}-{r.l}</div>
                              <div className="text-xs opacity-60">W-L</div>
                            </div>
                          </li>
                        ))}
                        {!standings.length && <li className="text-sm opacity-60">No results yet.</li>}
                      </ul>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left opacity-70">
                              <th className="py-2">#</th>
                              <th className="py-2">Team</th>
                              <th className="py-2">Pts</th>
                              <th className="py-2">W</th>
                              <th className="py-2">L</th>
                              <th className="py-2">SW</th>
                              <th className="py-2">SL</th>
                              <th className="py-2">Diff±</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((r,i)=> (
                              <tr key={r.id} className="border-t">
                                <td className="py-2">{i+1}</td>
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
                    )}
                  </div>
                </div>
              ))}
              {!leaderboardByPool.length && <div className="text-sm opacity-60">No pools configured.</div>}
            </div>
          ) : isMobile ? (
            <ul className="space-y-2">
              {leaderboard.map((r,i)=> (
                <li key={r.id} className="rounded-2xl border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs opacity-60">#{i+1}</div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs opacity-70">Pts {r.pts} • SW {r.sw} • Pts± {r.pd}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold">{r.w}-{r.l}</div>
                    <div className="text-xs opacity-60">W-L</div>
                  </div>
                </li>
              ))}
              {!leaderboard.length && <li className="text-sm opacity-60">No completed matches yet.</li>}
            </ul>
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
                    <th className="py-2">SL</th>
                    <th className="py-2">Pts±</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r,i)=> (
                    <tr key={r.id} className="border-t">
                      <td className="py-2">{i+1}</td>
                      <td className="py-2 font-medium">{r.name}</td>
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
          )}
        </Card>


        {/* Tournament Teams (Admin only) */}
        {isAdmin && selectedTid && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> Tournament Teams</h2>
              <span className="text-xs opacity-60">{tournamentTeams.length} assigned</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <Select value={assignTeamId} onChange={(e)=>setAssignTeamId(e.target.value)}>
                <option value="">Select a team to add…</option>
                {teams.filter(t=>!tournamentTeams.includes(t.id)).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
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
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <Input placeholder="Team name" value={newTeam} onChange={(e)=>setNewTeam(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={addTeam} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
              </div>
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

        {/* Pools (Admin only, per tournament) */}
        {isAdmin && selectedTid && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><Layers className="w-4 h-4"/> Pools</h2>
              <span className="text-xs opacity-60">{pools.length} pools</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <Input placeholder="Pool name (e.g., Pool A)" value={newPoolName} onChange={(e)=>setNewPoolName(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={addPool} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add Pool</Button>
              </div>
              <div className="flex items-center gap-2">
                <input id="gbp" type="checkbox" checked={groupByPool} onChange={(e)=>setGroupByPool(e.target.checked)} />
                <label htmlFor="gbp" className="text-sm">Group leaderboard by pool</label>
              </div>
            </div>
            <div className="space-y-4">
              {pools.map(p => {
                const assignedIds = new Set(poolTeams.filter(pt => pt.pool_id === p.id).map(pt => pt.team_id));
                const available = teams.filter(t => tournamentTeams.includes(t.id) && !assignedIds.has(t.id));
                return (
                  <div key={p.id} className="rounded-2xl border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="flex gap-2">
                        <Select value={poolAdd[p.id] || ""} onChange={(e)=>setPoolAdd({...poolAdd, [p.id]: e.target.value})}>
                          <option value="">Add team…</option>
                          {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                        <Button onClick={()=>addTeamToPool(p.id, poolAdd[p.id])} className="bg-white border flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
                        <Button onClick={()=>deletePool(p.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                      </div>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {Array.from(assignedIds).map(tid => {
                        const t = teams.find(x=>x.id===tid);
                        return (
                          <li key={tid} className="px-3 py-1 rounded-full border text-sm flex items-center gap-2">
                            <span>{t?.name || tid}</span>
                            <button className="opacity-60 hover:opacity-100" onClick={()=>removeTeamFromPool(p.id, tid)} title="Remove">×</button>
                          </li>
                        );
                      })}
                      {!assignedIds.size && <li className="text-sm opacity-60">No teams yet.</li>}
                    </ul>
                  </div>
                );
              })}
              {!pools.length && <div className="text-sm opacity-60">No pools yet.</div>}
            </div>
          </Card>
        )}

        {/* Schedule (Admin only, per tournament) */}
        {isAdmin && selectedTid && (
          <Card>
            <h2 className="text-lg font-medium flex items-center gap-2 mb-3"><Calendar className="w-4 h-4"/> Schedule a Match</h2>
            <div className="grid sm:grid-cols-4 gap-3">
              <Select value={schedule.team1} onChange={(e)=>setSchedule({...schedule, team1: e.target.value})}>
                <option value="">Team 1</option>
                {teams.filter(t=>tournamentTeams.includes(t.id)).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select value={schedule.team2} onChange={(e)=>setSchedule({...schedule, team2: e.target.value})}>
                <option value="">Team 2</option>
                {teams.filter(t=>tournamentTeams.includes(t.id)).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Select value={schedule.stage} onChange={(e)=>setSchedule({...schedule, stage: e.target.value})}>
                <option value="pool">Stage: Pool</option>
                <option value="semi">Stage: Semi</option>
                <option value="final">Stage: Final</option>
              </Select>
              <Input type="datetime-local" value={schedule.when} onChange={(e)=>setSchedule({...schedule, when: e.target.value})} />
            </div>
            <div className="mt-3">
              <Button onClick={scheduleMatch} className="bg-black text-white flex items-center gap-2"><Save className="w-4 h-4"/>Create Match</Button>
            </div>
          </Card>
        )}

        {/* Bracket (Semis & Final) */}
          {selectedTid && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Bracket
                </h2>
                {isAdmin && (
                  <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:mr-2 w-full sm:w-auto">
                      <Input type="datetime-local" value={bracketTimes.semi1} onChange={(e)=>setBracketTimes(prev=>({...prev, semi1: e.target.value}))} placeholder="Semi 1 date/time" />
                      <Input type="datetime-local" value={bracketTimes.semi2} onChange={(e)=>setBracketTimes(prev=>({...prev, semi2: e.target.value}))} placeholder="Semi 2 date/time" />
                      <Input type="datetime-local" value={bracketTimes.final} onChange={(e)=>setBracketTimes(prev=>({...prev, final: e.target.value}))} placeholder="Final date/time" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createBracketPlaceholders} className="bg-black text-white">Generate placeholders</Button>
                      <Button onClick={autoSeedSemisFromPools} className="bg-white">Auto-seed A1/B2 & A2/B1</Button>
                    </div>
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
            <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Matches</h2>
            <span className="text-xs opacity-60">{matches.length} total</span>
          </div>
          {!selectedTid ? (
            <div className="text-sm opacity-60">Select a tournament to view matches.</div>
          ) : isMobile ? (
            <ul className="space-y-2">
              {matches.map((m)=> (
                <li key={m.id} className="rounded-2xl border p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs opacity-60">{fmtDateTime(m.scheduled_at)}</div>
                    <div className="font-medium">{m.team1?.name} vs {m.team2?.name}</div>
                    <div className="text-xs capitalize opacity-70">{m.status}</div>

                    {(() => {
                      // Only show live scoring when status is in progress
                      const status = (m.status || '').toLowerCase().replace(/\s+/g,'_').replace('-', '_');
                      if (status !== 'in_progress') return null;

                      const sets = allSets
                        .filter(s => s.match_id === m.id)
                        .sort((a,b) => a.set_number - b.set_number);
                      if (!sets.length) return null;

                      let sw1 = 0, sw2 = 0;
                      for (const s of sets) {
                        const w = setWinnerStrictForMatch(s, m);
                        if (w === 1) sw1++; else if (w === 2) sw2++;
                      }
                      const active = getActiveSet(sets, m) || sets[sets.length-1];

                      return (
                        <div className="text-xs mt-1">
                          Live: <span className="font-medium">{active.team1_points}</span>
                          -
                          <span className="font-medium">{active.team2_points}</span>
                          {' '}• Sets {sw1}-{sw2}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <IconBtn onClick={()=>openMatch(m.id)} className="bg-white"><Edit3 className="w-5 h-5"/></IconBtn>
                    {isAdmin && (
                      <IconBtn onClick={()=>deleteMatch(m.id)} className="bg-white text-red-600"><Trash2 className="w-5 h-5"/></IconBtn>
                    )}
                  </div>
                </li>
              ))}
              {!matches.length && <li className="text-sm opacity-60">No matches yet.</li>}
            </ul>
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
                      <td className="py-2">
                        <div>{m.team1?.name} vs {m.team2?.name}</div>
                        {(() => {
                          // Only show live scoring when status is in progress
                          const status = (m.status || '').toLowerCase().replace(/\s+/g,'_').replace('-', '_');
                          if (status !== 'in_progress') return null;

                          const sets = allSets
                            .filter(s => s.match_id === m.id)
                            .sort((a,b) => a.set_number - b.set_number);
                          if (!sets.length) return null;

                          let sw1 = 0, sw2 = 0;
                          for (const s of sets) {
                            const w = setWinnerStrictForMatch(s, m);
                            if (w === 1) sw1++; else if (w === 2) sw2++;
                          }
                          const active = getActiveSet(sets, m) || sets[sets.length-1];

                          return (
                            <div className="text-xs opacity-70 mt-0.5">
                              Live: <span className="font-medium">{active.team1_points}</span>
                              -
                              <span className="font-medium">{active.team2_points}</span>
                              {' '}• Sets {sw1}-{sw2}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2 capitalize">{m.status}</td>
                      <td className="py-2 flex gap-2">
                        <Button onClick={()=>openMatch(m.id)} className="bg-white flex items-center gap-1"><Edit3 className="w-4 h-4"/>Open</Button>
                        {isAdmin && (
                          <Button onClick={()=>deleteMatch(m.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                        )}
                      </td>
                    </tr>
                  ))}
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
          <h3 className="text-lg font-semibold">
            {selectedMatch.match.team1?.name} vs {selectedMatch.match.team2?.name}
          </h3>
          <p className="text-sm opacity-70">
            {fmtDateTime(selectedMatch.match.scheduled_at)} • Status:{" "}
            <span className="capitalize">{selectedMatch.match.status}</span>
          </p>
        </div>

        {/* Desktop actions */}
        {!isMobile && (
          <div className="flex items-center gap-3">
            {/* NEW: toggle to swap Set 1 sides */}
            <label className="text-xs flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={flipSet1}
                onChange={(e)=>setFlipSet1(e.target.checked)}
              />
              Swap Set 1 sides
            </label>

            {(isAdmin || isCaptain) && (
              <Button onClick={completeMatch} className="bg-emerald-600 text-white">
                Mark Completed & Pick Winner
              </Button>
            )}
            <Button onClick={()=>setSelectedMatch(null)} className="bg-white">Close</Button>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        {selectedMatch.sets.map((s)=>{
          const target = pointsToWinForMatch(selectedMatch.match, s.set_number);
          const win = setWinnerStrictForMatch(s, selectedMatch.match);

          // NEW: flip logic is ONLY for Set 1
          const flipped = flipSet1 && s.set_number === 1;
          const leftField  = flipped ? "team2_points" : "team1_points";
          const rightField = flipped ? "team1_points" : "team2_points";
          const leftName   = flipped ? (selectedMatch.match.team2?.name || "Team 2")
                                     : (selectedMatch.match.team1?.name || "Team 1");
          const rightName  = flipped ? (selectedMatch.match.team1?.name || "Team 1")
                                     : (selectedMatch.match.team2?.name || "Team 2");

          return (
            <div key={s.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">
                  Set {s.set_number}{" "}
                  <span className="text-xs opacity-60">(to {target}, win by 2)</span>
                </div>
                {win ? (
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    Winner: Team {win}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-slate-100 rounded-full">In play</span>
                )}
              </div>

              {/* Two pads: LEFT and RIGHT use remapped fields when flipped */}
              <div className="grid grid-cols-2 gap-4">
                {/* LEFT pad */}
                <div className="border rounded-xl p-3">
                  <div className="text-xs opacity-70 mb-2">{leftName}</div>
                  <div className="flex items-center justify-between">
                    <IconBtn
                      disabled={!(isAdmin || isCaptain)}
                      onClick={()=>adjustPoint(s.id, leftField, -1)}
                      className="bg-white"
                    >
                      –
                    </IconBtn>
                    <div className="text-3xl font-semibold">{s[leftField]}</div>
                    <IconBtn
                      disabled={!(isAdmin || isCaptain)}
                      onClick={()=>adjustPoint(s.id, leftField, +1)}
                      className="bg-black text-white"
                    >
                      +
                    </IconBtn>
                  </div>
                </div>

                {/* RIGHT pad */}
                <div className="border rounded-xl p-3">
                  <div className="text-xs opacity-70 mb-2">{rightName}</div>
                  <div className="flex items-center justify-between">
                    <IconBtn
                      disabled={!(isAdmin || isCaptain)}
                      onClick={()=>adjustPoint(s.id, rightField, -1)}
                      className="bg-white"
                    >
                      –
                    </IconBtn>
                    <div className="text-3xl font-semibold">{s[rightField]}</div>
                    <IconBtn
                      disabled={!(isAdmin || isCaptain)}
                      onClick={()=>adjustPoint(s.id, rightField, +1)}
                      className="bg-black text-white"
                    >
                      +
                    </IconBtn>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  </motion.div>
)}
</div>

{/* Sticky mobile scorer */}
{isMobile && selectedMatch && (
  <div
    className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur p-3"
    style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
  >
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {(() => {
            const active = getActiveSet(selectedMatch.sets, selectedMatch.match);
            if (!active) return null;
            const t1 = selectedMatch.match.team1?.name || "Team 1";
            const t2 = selectedMatch.match.team2?.name || "Team 2";
            const target = pointsToWinForMatch(selectedMatch.match, active.set_number);

            // NEW: flip logic for mobile sticky (Set 1 only)
            const flipped = flipSet1 && active.set_number === 1;
            const left = {
              name:  flipped ? t2 : t1,
              field: flipped ? "team2_points" : "team1_points",
              value: flipped ? active.team2_points : active.team1_points,
            };
            const right = {
              name:  flipped ? t1 : t2,
              field: flipped ? "team1_points" : "team2_points",
              value: flipped ? active.team1_points : active.team2_points,
            };

            return (
              <>
                <div className="text-[11px] opacity-70 truncate">
                  Active Set • to {target} (win by 2)
                </div>
                <div className="font-medium truncate">{t1} vs {t2}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {/* Left pad */}
                  <div className="rounded-xl border p-2">
                    <div className="text-[11px] opacity-70 truncate">{left.name}</div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <button
                        disabled={!(isAdmin || isCaptain)}
                        onClick={()=>adjustPoint(active.id, left.field, -1)}
                        className="min-w-12 min-h-12 rounded-full border bg-white active:scale-[0.98]"
                      >
                        −
                      </button>
                      <div className="text-2xl font-semibold tabular-nums">{left.value}</div>
                      <button
                        disabled={!(isAdmin || isCaptain)}
                        onClick={()=>adjustPoint(active.id, left.field, +1)}
                        className="min-w-12 min-h-12 rounded-full border bg-black text-white active:scale-[0.98]"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Right pad */}
                  <div className="rounded-xl border p-2">
                    <div className="text-[11px] opacity-70 truncate">{right.name}</div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <button
                        disabled={!(isAdmin || isCaptain)}
                        onClick={()=>adjustPoint(active.id, right.field, -1)}
                        className="min-w-12 min-h-12 rounded-full border bg-white active:scale-[0.98]"
                      >
                        −
                      </button>
                      <div className="text-2xl font-semibold tabular-nums">{right.value}</div>
                      <button
                        disabled={!(isAdmin || isCaptain)}
                        onClick={()=>adjustPoint(active.id, right.field, +1)}
                        className="min-w-12 min-h-12 rounded-full border bg-black text-white active:scale-[0.98]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {(isAdmin || isCaptain) && (
            <button onClick={completeMatch} className="px-4 py-2 rounded-2xl bg-emerald-600 text-white shadow-sm">
              Complete
            </button>
          )}
          <button
            onClick={()=>setSelectedMatch(null)}
            className="grid place-items-center min-w-11 min-h-11 rounded-2xl border bg-white"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>
      </div>
    </div>
  </div>
)}

    </div>
  );
}
/*
-- Add match stage column
alter table public.matches add column if not exists stage text default 'pool';
*/