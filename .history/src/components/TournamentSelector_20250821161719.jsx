
import Button from './ui/Button'
import Select from './ui/Select'
import Input from './ui/Input'
import Card from './ui/Card'
import { Share2, Trash2, Plus } from 'lucide-react'

export default function TournamentSelector({
  tournaments, selectedTid, setSelectedTid,
  isAdmin, newTournament, setNewTournament,
  onAddTournament, onDeleteSelected, selectedTournament, onCopyShareLink
}) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm opacity-70">Tournament:</span>
          <Select value={selectedTid} onChange={(e)=>setSelectedTid(e.target.value)} className="min-w-[220px]">
            <option value="">Select a tournament…</option>
            {tournaments.map(t=> (<option key={t.id} value={t.id}>{t.name}</option>))}
          </Select>
          <Button onClick={onCopyShareLink} className="bg-white flex items-center gap-2">
            <Share2 className="w-4 h-4"/>Share
          </Button>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input placeholder="New tournament name" value={newTournament} onChange={(e)=>setNewTournament(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={onAddTournament} className="bg-black text-white flex items-center gap-2"><Plus className="w-4 h-4"/>Add</Button>
              {selectedTid && <Button onClick={onDeleteSelected} className="bg-white hover:bg-red-50 text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4"/>Delete</Button>}
            </div>
          </div>
        )}
      </div>
      {selectedTournament && (
        <p className="text-xs opacity-70 mt-2">{selectedTournament.slug ? `Slug: ${selectedTournament.slug}` : 'No slug set'}</p>
      )}
    </Card>
  )
}
