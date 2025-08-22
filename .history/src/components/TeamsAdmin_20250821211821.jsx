import Card from './ui/Card'
import Input from './ui/Input'
import Button from './ui/Button'
import { Users, Plus, Trash2 } from 'lucide-react'

export default function TeamsAdmin({ teams, newTeam, setNewTeam, onAddTeam, onDeleteTeam, showHeader=true, title="All Teams" }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium flex items-center gap-2"><Users className="w-4 h-4"/> {title}</h2>
        {showHeader && <span className="text-xs opacity-60">{teams.length} teams</span>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input placeholder="Team name" value={newTeam} onChange={(e)=>setNewTeam(e.target.value)} />
        <div className="flex gap-2">
          <Button onClick={onAddTeam} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
        </div>
      </div>
      <ul className="divide-y">
        {teams.map((t)=> (
          <li key={t.id} className="py-2 flex items-center justify-between">
            <span>{t.name}</span>
            <div className="flex gap-2">
              <Button onClick={()=>onDeleteTeam(t.id)} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1">
                <Trash2 className="w-4 h-4"/>Delete
              </Button>
            </div>
          </li>
        ))}
        {!teams.length && <div className="text-sm opacity-60">No teams yet.</div>}
      </ul>
    </Card>
  )
}