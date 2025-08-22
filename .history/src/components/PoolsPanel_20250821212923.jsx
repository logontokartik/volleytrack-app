import Card from './ui/Card'
import Input from './ui/Input'
import Select from './ui/Select'
import Button from './ui/Button'
import { Plus, Trash2, Save } from 'lucide-react'

export default function PoolsPanel({
  pools, setNewPoolName, newPoolName,
  onCreatePool, onDeletePool,
  allTeams, tournamentTeams, poolTeamsMap,
  onAssignTeamToPool, onRemoveTeamFromPool,
  poolCreate, setPoolCreate, onCreatePoolMatch,
  // Optional: when provided, enables cross-pool creation UI
  onCreateCrossPoolMatches
}) {
  const assignedSet = new Set(tournamentTeams)
  const poolsSorted = [...pools].sort((a,b)=> (a.order_index - b.order_index) || a.name.localeCompare(b.name))

  const update = (poolId, changes) => {
    setPoolCreate(prev => ({ ...prev, [poolId]: { ...(prev[poolId]||{}), ...changes } }))
  }

  // Local state for cross-pool manual creation (kept here so App.jsx only needs a callback)
  const [cross, setCross] = React.useState({ sourcePool:'', sourceTeam:'', targetPool:'', when:'' })
  const setCrossField = (k,v)=> setCross(prev=>({ ...prev, [k]: v }))

  const teamsInPool = (pid) => (poolTeamsMap[pid]||[]).map(id => allTeams.find(t=>t.id===id)).filter(Boolean)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium">Pools</h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input placeholder="Pool name (e.g., Pool A)" value={newPoolName} onChange={(e)=>setNewPoolName(e.target.value)} />
        <Button onClick={onCreatePool} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Create Pool</Button>
      </div>

      {!poolsSorted.length && <div className="text-sm opacity-60">No pools yet — create Pool A / Pool B and assign teams.</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {poolsSorted.map(pool => {
          const members = teamsInPool(pool.id)
          const available = allTeams.filter(t => assignedSet.has(t.id) && !members.find(m=>m.id===t.id))
          const form = poolCreate[pool.id] || { team1:'', team2:'', when:'' }
          return (
            <div key={pool.id} className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{pool.name}</div>
                <Button onClick={()=>onDeletePool(pool.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 className="w-4 h-4"/>Delete</Button>
              </div>

              {/* Assign teams to this pool */}
              <div className="flex gap-2">
                <Select onChange={(e)=>onAssignTeamToPool(pool.id, e.target.value)} defaultValue="">
                  <option value="">Add team…</option>
                  {available.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <ul className="flex flex-wrap gap-2">
                {members.map(m => (
                  <li key={m.id} className="px-3 py-1 rounded-full border bg-slate-50 flex items-center gap-2">
                    <span>{m.name}</span>
                    <button onClick={()=>onRemoveTeamFromPool(pool.id, m.id)} className="text-red-600">×</button>
                  </li>
                ))}
                {!members.length && <div className="text-sm opacity-60">No teams in this pool.</div>}
              </ul>

              {/* Manual match creation inside this pool */}
              <div className="rounded-xl border p-3 space-y-2">
                <div className="text-sm font-medium">Create Pool Match</div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <Select value={form.team1} onChange={(e)=>update(pool.id, { team1:e.target.value })}>
                    <option value="">Team 1</option>
                    {members.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <Select value={form.team2} onChange={(e)=>update(pool.id, { team2:e.target.value })}>
                    <option value="">Team 2</option>
                    {members.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <Input type="datetime-local" value={form.when} onChange={(e)=>update(pool.id, { when:e.target.value })} />
                </div>
                <Button onClick={()=>onCreatePoolMatch(pool.id)} className="bg-black text-white flex items-center gap-2"><Save className="w-4 h-4"/>Create Match</Button>
                <p className="text-xs opacity-60">Scoring & standings are calculated within this pool from completed matches.</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cross-pool manual series: one team vs all teams in another pool */}
      {typeof onCreateCrossPoolMatches === 'function' && poolsSorted.length >= 2 && (
        <div className="mt-6 rounded-2xl border p-4 space-y-3">
          <div className="text-base font-medium">Cross‑Pool Matches</div>
          <p className="text-xs opacity-70">Pick a source team from one pool and a target pool. We'll create one match against each team in the target pool.</p>
          <div className="grid sm:grid-cols-4 gap-2">
            <Select value={cross.sourcePool} onChange={(e)=>setCrossField('sourcePool', e.target.value)}>
              <option value="">Source Pool</option>
              {poolsSorted.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select value={cross.sourceTeam} onChange={(e)=>setCrossField('sourceTeam', e.target.value)} disabled={!cross.sourcePool}>
              <option value="">Source Team</option>
              {cross.sourcePool && teamsInPool(cross.sourcePool).map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={cross.targetPool} onChange={(e)=>setCrossField('targetPool', e.target.value)}>
              <option value="">Target Pool</option>
              {poolsSorted
                .filter(p=>p.id!==cross.sourcePool)
                .map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input type="datetime-local" value={cross.when} onChange={(e)=>setCrossField('when', e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={()=>{
                if (!cross.sourcePool || !cross.sourceTeam || !cross.targetPool) return alert('Select source pool/team and a target pool')
                onCreateCrossPoolMatches({
                  sourcePoolId: cross.sourcePool,
                  sourceTeamId: cross.sourceTeam,
                  targetPoolId: cross.targetPool,
                  when: cross.when || null,
                })
                setCross({ sourcePool:'', sourceTeam:'', targetPool:'', when:'' })
              }}
              className="bg-black text-white flex items-center gap-2"
            >
              <Save className="w-4 h-4"/>Create Cross‑Pool Series
            </Button>
            <Button onClick={()=>setCross({ sourcePool:'', sourceTeam:'', targetPool:'', when:'' })} className="bg-white">Reset</Button>
          </div>
          <p className="text-xs opacity-60">Cross‑pool games are created with phase <code>cross_pool</code> and do not count toward pool standings.</p>
        </div>
      )}
    </Card>
  )
}