// Compute standings (W-L, SW, PD) given teams, matches, sets, with optional filters.
import { computeWinnerId } from './utils'

export function computeStandings({ teams, matches, sets, filterFn }) {
  const rows = new Map()
  teams.forEach(t => rows.set(t.id, { id: t.id, name: t.name, w:0, l:0, sw:0, sl:0, pf:0, pa:0, pd:0 }))

  const setsByMatch = sets.reduce((acc, s) => { (acc[s.match_id] ||= []).push(s); return acc }, {})

  for (const m of matches) {
    if (m.status !== 'completed') continue
    if (filterFn && !filterFn(m)) continue
    const sArr = (setsByMatch[m.id] || []).sort((a,b)=>a.set_number-b.set_number)
    let sw1=0, sw2=0, pf1=0, pf2=0
    for (const s of sArr) {
      pf1 += s.team1_points; pf2 += s.team2_points
      if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++
    }
    const winId = m.winner_team_id || computeWinnerId(m, sArr)
    const loseId = winId === m.team1_id ? m.team2_id : m.team1_id

    if (rows.has(winId)) rows.get(winId).w++
    if (rows.has(loseId)) rows.get(loseId).l++

    if (rows.has(m.team1_id)) { const r = rows.get(m.team1_id); r.sw += sw1; r.sl += sw2; r.pf += pf1; r.pa += pf2; r.pd = r.pf - r.pa }
    if (rows.has(m.team2_id)) { const r = rows.get(m.team2_id); r.sw += sw2; r.sl += sw1; r.pf += pf2; r.pa += pf1; r.pd = r.pf - r.pa }
  }

  return Array.from(rows.values()).sort((a,b)=> (b.w - a.w) || (b.sw - a.sw) || (b.pd - a.pd) || a.name.localeCompare(b.name))
}