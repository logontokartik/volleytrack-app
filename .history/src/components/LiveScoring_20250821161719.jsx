
import Card from './ui/Card'
import Button from './ui/Button'
import IconBtn from './ui/IconBtn'
import { X } from 'lucide-react'
import { fmtDateTime, getActiveSet, setWinnerStrict } from '../lib/utils'
import { useIsMobile } from '../lib/utils'

export default function LiveScoring({ matchData, isAdmin, onAdjust, onComplete, onClose }) {
  const isMobile = useIsMobile()
  const { match, sets } = matchData

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{match.team1?.name} vs {match.team2?.name}</h3>
            <p className="text-sm opacity-70">{fmtDateTime(match.scheduled_at)} • Status: <span className="capitalize">{match.status}</span></p>
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              {isAdmin && <Button onClick={onComplete} className="bg-emerald-600 text-white">Mark Completed & Pick Winner</Button>}
              <Button onClick={onClose} className="bg-white">Close</Button>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {sets.map((s)=>{
            const target = s.set_number === 3 ? 15 : 25
            const win = setWinnerStrict(s)
            return (
              <div key={s.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Set {s.set_number} <span className="text-xs opacity-60">(to {target}, win by 2)</span></div>
                  {win ? <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Winner: Team {win}</span> : <span className="text-xs px-2 py-1 bg-slate-100 rounded-full">In play</span>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {["team1_points","team2_points"].map((field,idx)=> (
                    <div key={field} className="border rounded-xl p-3">
                      <div className="text-xs opacity-70 mb-2">{idx===0? match.team1?.name : match.team2?.name}</div>
                      <div className="flex items-center justify-between">
                        <IconBtn disabled={!isAdmin} onClick={()=>onAdjust(s.id, field, -1)} className="bg-white">–</IconBtn>
                        <div className="text-3xl font-semibold">{s[field]}</div>
                        <IconBtn disabled={!isAdmin} onClick={()=>onAdjust(s.id, field, +1)} className="bg-black text-white">+</IconBtn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {isMobile && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-white/95 backdrop-blur p-3 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs opacity-60 truncate">Active Set</div>
              <div className="font-medium truncate">{match.team1?.name} vs {match.team2?.name}</div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const active = getActiveSet(sets);
                if (!active) return null;
                return (
                  <>
                    <IconBtn disabled={!isAdmin} onClick={()=>onAdjust(active.id, 'team1_points', +1)} className="bg-black text-white">+ {match.team1?.name?.split(' ')[0]}</IconBtn>
                    <IconBtn disabled={!isAdmin} onClick={()=>onAdjust(active.id, 'team2_points', +1)} className="bg-black text-white">+ {match.team2?.name?.split(' ')[0]}</IconBtn>
                  </>
                );
              })()}
              {isAdmin && <Button onClick={onComplete} className="bg-emerald-600 text-white">Complete</Button>}
              <IconBtn onClick={onClose} className="bg-white"><X className="w-5 h-5"/></IconBtn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
