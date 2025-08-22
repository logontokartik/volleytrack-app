
import Card from './ui/Card'
import Button from './ui/Button'

function Slot({ title, match, team1, team2, onOpen }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="font-medium mb-2">{title}</div>
      <div className="text-sm mb-2">{team1 || 'TBD'} vs {team2 || 'TBD'}</div>
      {match ? <Button onClick={()=>onOpen(match.id)} className="bg-white">Open</Button> : <span className="text-xs opacity-60">No match yet</span>}
    </div>
  )
}

export default function BracketPanel({ tournament, matches, teamsById, onAutoSeed, onEnsureFinal, onOpenMatch }) {
  const sf1 = matches.find(m=>m.bracket_slot==='SF1')
  const sf2 = matches.find(m=>m.bracket_slot==='SF2')
  const f   = matches.find(m=>m.bracket_slot==='F')

  const name = (id) => id ? (teamsById[id]?.name || '—') : null

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium">Bracket</h2>
        <div className="flex gap-2">
          <Button onClick={onAutoSeed} className="bg-black text-white">Auto-Seed Semifinals</Button>
          <Button onClick={onEnsureFinal} className="bg-white">Create/Update Final</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Slot title="Semifinal 1 (SF1)" match={sf1} team1={name(sf1?.team1_id)} team2={name(sf1?.team2_id)} onOpen={onOpenMatch} />
        <Slot title="Semifinal 2 (SF2)" match={sf2} team1={name(sf2?.team1_id)} team2={name(sf2?.team2_id)} onOpen={onOpenMatch} />
        <Slot title="Final (F)"          match={f}   team1={name(f?.team1_id)}   team2={name(f?.team2_id)}   onOpen={onOpenMatch} />
      </div>

      <p className="text-xs opacity-60 mt-3">Final teams auto-populate from semifinal winners when both semis are completed.</p>
    </Card>
  )
}
