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
  poolCreate, setPoolCreate, onCreatePoolMatch
}) {
  const assignedSet = new Set(tournamentTeams)
  const poolsSorted = [...pools].sort((a,b)=> (a.order_index - b.order_index) || a.name.localeCompare(b.name))

  const update = (poolId, changes) => {
    setPoolCreate(prev => ({ ...prev, [poolId]: { ...(prev[poolId]||{}), ...changes } }))
  }

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
          const members = (poolTeamsMap[pool.id] || []).map(id => allTeams.find(t=>t.id===id)).filter(Boolean)
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
    </Card>
  )
}