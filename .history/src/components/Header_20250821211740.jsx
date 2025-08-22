import { Volleyball, Database, LogIn, LogOut, Lock } from 'lucide-react'
import Button from './ui/Button'

export default function Header({ cfg, session, isAdmin, onSignOut }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Volleyball className="w-7 h-7" />
        <h1 className="text-2xl font-semibold">VolleyTrack</h1>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="hidden sm:flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span className="opacity-70">{cfg.url ? (cfg.fromEnv ? "DB Ready" : "DB Configurable") : "No DB"}</span>
        </div>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1">
              <Lock className="w-3 h-3"/>{isAdmin ? "Admin" : "Viewer"}
            </span>
            <Button onClick={onSignOut} className="bg-white flex items-center gap-1"><LogOut className="w-4 h-4"/>Sign out</Button>
          </div>
        ) : (
          <span className="text-xs opacity-70">Public View</span>
        )}
      </div>
    </header>
  )
}