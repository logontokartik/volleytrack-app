
import Card from './ui/Card'
import Button from './ui/Button'
import IconBtn from './ui/IconBtn'
import Select from './ui/Select'
import { Trophy, Edit3, Trash2 } from 'lucide-react'
import { fmtDateTime } from '../lib/utils'
import { useIsMobile } from '../lib/utils'

export default function MatchesList({ matches, selectedTid, isAdmin, onOpen, onDelete, pools, filterPhase, setFilterPhase, filterPool, setFilterPool }) {
  const isMobile = useIsMobile()
  const filtered = matches.filter(m => (filterPhase==='all' || m.phase===filterPhase) && (!filterPool || m.pool_id===filterPool))

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Matches</h2>
        <span className="text-xs opacity-60">{filtered.length} shown</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={filterPhase} onChange={(e)=>setFilterPhase(e.target.value)} className="max-w-[180px]">
          <option value="all">All phases</option>
          <option value="pool">Pool</option>
          <option value="semifinal">Semifinal</option>
          <option value="final">Final</option>
        </Select>
        {filterPhase==='pool' && (
          <Select value={filterPool} onChange={(e)=>setFilterPool(e.target.value)} className="max-w-[180px]">
            <option value="">All pools</option>
            {pools.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </div>

      {!selectedTid ? (
        <div className="text-sm opacity-60">Select a tournament to view matches.</div>
      ) : isMobile ? (
        <ul className="space-y-2">
          {filtered.map((m)=> (
            <li key={m.id} className="rounded-2xl border p-3 flex items-center justify-between">
              <div>
                <div className="text-xs opacity-60">{fmtDateTime(m.scheduled_at)}</div>
                <div className="font-medium">{m.team1?.name} vs {m.team2?.name}</div>
                <div className="text-xs capitalize opacity-70">{m.phase}{m.pool_id?` • Pool`:''} • {m.status}</div>
              </div>
              <div className="flex gap-2">
                <IconBtn onClick={()=>onOpen(m.id)} className="bg-white"><Edit3 className="w-5 h-5"/></IconBtn>
                {isAdmin && (
                  <IconBtn onClick={()=>onDelete(m.id)} className="bg-white text-red-600"><Trash2 className="w-5 h-5"/></IconBtn>
                )}
              </div>
            </li>
          ))}
          {!filtered.length && <li className="text-sm opacity-60">No matches.</li>}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2">When</th>
                <th className="py-2">Teams</th>
                <th className="py-2">Phase</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m)=> (
                <tr key={m.id}>
                  <td className="py-2">{fmtDateTime(m.scheduled_at)}</td>
                  <td className="py-2">{m.team1?.name} vs {m.team2?.name}</td>
                  <td className="py-2 capitalize">{m.phase}{m.pool_id?` (${(pools.find(p=>p.id===m.pool_id)||{}).name||'Pool'})`:''}{m.bracket_slot?` • ${m.bracket_slot}`:''}</td>
                  <td className="py-2 capitalize">{m.status}</td>
                  <td className="py-2 flex gap-2">
                    <Button onClick={()=>onOpen(m.id)} className="bg-white flex items-center gap-1"><Edit3 className="w-4 h-4"/>Open</Button>
                    {isAdmin && (
                      <Button onClick={()=>onDelete(m.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
