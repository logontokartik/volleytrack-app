
import Card from './ui/Card'
import Select from './ui/Select'
import Button from './ui/Button'
import { Users, Plus, X } from 'lucide-react'

export default function TournamentTeams({
  tournamentTeams, allTeams, assignTeamId, setAssignTeamId,
  onAddTeamToTournament, onRemoveTeamFromTournament
}) {
  const available = allTeams.filter(t=>!tournamentTeams.includes(t.id))
  const assigned = allTeams.filter(t=>tournamentTeams.includes(t.id))
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> Tournament Teams</h2>
        <span className="text-xs opacity-60">{assigned.length} assigned</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <Select value={assignTeamId} onChange={(e)=>setAssignTeamId(e.target.value)}>
          <option value="">Select a team to add…</option>
          {available.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Button onClick={onAddTeamToTournament} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add to Tournament</Button>
      </div>
      <ul className="divide-y">
        {assigned.map(t => (
          <li key={t.id} className="py-2 flex items-center justify-between">
            <span>{t.name}</span>
            <Button onClick={()=>onRemoveTeamFromTournament(t.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><X className="w-4 h-4"/>Remove</Button>
          </li>
        ))}
        {!assigned.length && <div className="text-sm opacity-60">No teams assigned yet.</div>}
      </ul>
    </Card>
  )
}
