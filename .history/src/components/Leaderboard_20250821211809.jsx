import Card from './ui/Card'
import { Trophy } from 'lucide-react'
import { useIsMobile } from '../lib/utils'

export default function Leaderboard({ leaderboard, selectedTid }) {
  const isMobile = useIsMobile()
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium flex items-center gap-2"><Trophy className="w-4 h-4"/> Leaderboard</h2>
        <span className="text-xs opacity-60">{leaderboard.length} teams</span>
      </div>
      {!selectedTid ? (
        <div className="text-sm opacity-60">Select a tournament to view the leaderboard.</div>
      ) : isMobile ? (
        <ul className="space-y-2">
          {leaderboard.map((r,i)=> (
            <li key={r.id} className="rounded-2xl border p-3 flex items-center justify-between">
              <div>
                <div className="text-xs opacity-60">#{i+1}</div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs opacity-70">SW {r.sw} • Pts± {r.pd}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold">{r.w}-{r.l}</div>
                <div className="text-xs opacity-60">W-L</div>
              </div>
            </li>
          ))}
          {!leaderboard.length && <li className="text-sm opacity-60">No completed matches yet.</li>}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-70">
                <th className="py-2">#</th>
                <th className="py-2">Team</th>
                <th className="py-2">W</th>
                <th className="py-2">L</th>
                <th className="py-2">SW</th>
                <th className="py-2">Pts ±</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leaderboard.map((r,i)=> (
                <tr key={r.id}>
                  <td className="py-2">{i+1}</td>
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">{r.w}</td>
                  <td className="py-2">{r.l}</td>
                  <td className="py-2">{r.sw}</td>
                  <td className="py-2">{r.pd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}