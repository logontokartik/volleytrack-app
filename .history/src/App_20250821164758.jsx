import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { computeStandings } from './lib/standings';

function App(){
  const [teams,setTeams] = useState([]);
  const [pools,setPools] = useState([]);
  const [matches,setMatches] = useState([]);

  useEffect(()=>{ load(); },[]);

  async function load(){
    let {data:teams} = await supabase.from('teams').select('*');
    setTeams(teams||[]);
    let {data:pools} = await supabase.from('pools').select('*');
    setPools(pools||[]);
    let {data:matches} = await supabase.from('matches').select('*').order('created_at');
    setMatches(matches||[]);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">VolleyTrack Cross-Pool</h1>
      <div className="mt-4">
        <h2 className="font-semibold">Teams</h2>
        <ul>{teams.map(t=><li key={t.id}>{t.name}</li>)}</ul>
      </div>
      <div className="mt-4">
        <h2 className="font-semibold">Pools</h2>
        <ul>{pools.map(p=><li key={p.id}>{p.name}</li>)}</ul>
      </div>
      <div className="mt-4">
        <h2 className="font-semibold">Matches</h2>
        <ul>{matches.map(m=><li key={m.id}>{m.id} {m.team1_id} vs {m.team2_id} - {m.status}</li>)}</ul>
      </div>
    </div>
  );
}

export default App;
