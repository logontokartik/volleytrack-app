// Compute standings given matches and teams for pools
export function computeStandings(teams, matches) {
  const stats = {};
  teams.forEach(t => {
    stats[t.id] = { team: t, w:0,l:0,sw:0,sl:0,pf:0,pa:0,pd:0 };
  });
  matches.filter(m => m.status==='completed').forEach(m => {
    const s1 = m.sets.reduce((a,s)=>a+s.team1_score,0);
    const s2 = m.sets.reduce((a,s)=>a+s.team2_score,0);
    stats[m.team1_id].pf += s1; stats[m.team1_id].pa += s2;
    stats[m.team2_id].pf += s2; stats[m.team2_id].pa += s1;
    stats[m.team1_id].pd = stats[m.team1_id].pf - stats[m.team1_id].pa;
    stats[m.team2_id].pd = stats[m.team2_id].pf - stats[m.team2_id].pa;
    if(m.winner_team_id===m.team1_id){
      stats[m.team1_id].w++; stats[m.team2_id].l++;
    } else {
      stats[m.team2_id].w++; stats[m.team1_id].l++;
    }
  });
  return Object.values(stats).sort((a,b)=> b.w-a.w || b.sw-a.sw || b.pd-a.pd);
}
