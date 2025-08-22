/* Full app with manual pool match creation and bracket seeding */
import React, { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import TournamentSelector from './components/TournamentSelector'
import Leaderboard from './components/Leaderboard'
import TeamsAdmin from './components/TeamsAdmin'
import TournamentTeams from './components/TournamentTeams'
import PoolsPanel from './components/PoolsPanel'
import BracketPanel from './components/BracketPanel'
import MatchesList from './components/MatchesList'
import LiveScoring from './components/LiveScoring'
import Card from './components/ui/Card'
import Input from './components/ui/Input'
import Button from './components/ui/Button'
import { Upload, LogIn, RefreshCcw } from 'lucide-react'

import { getSupabaseConfig, saveSupabaseConfig, createSupabaseClient } from './lib/supabaseClient'
import { computeWinnerId, slugify } from './lib/utils'
import { computeStandings } from './lib/standings'

export default function App() {
  const [cfg, setCfg] = useState(getSupabaseConfig())
  const client = useMemo(() => createSupabaseClient(cfg), [cfg])
  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const [teamsById, setTeamsById] = useState({})
  const [tournaments, setTournaments] = useState([])
  const [selectedTid, setSelectedTid] = useState('')
  const [tournamentTeams, setTournamentTeams] = useState([])
  const [pools, setPools] = useState([])
  const [poolTeamsMap, setPoolTeamsMap] = useState({})
  const [matches, setMatches] = useState([])
  const [allSets, setAllSets] = useState([])
  const [newTeam, setNewTeam] = useState('')
  const [newTournament, setNewTournament] = useState('')
  const [assignTeamId, setAssignTeamId] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPoolName, setNewPoolName] = useState('')
  const [filterPhase, setFilterPhase] = useState('all')
  const [filterPool, setFilterPool] = useState('')
  const [poolCreate, setPoolCreate] = useState({}) // { [poolId]: { team1, team2, when } }

  useEffect(() => {
    if (!client) return
    ;(async () => {
      const { data } = await client.auth.getSession()
      setSession(data.session || null)
      client.auth.onAuthStateChange((_event, s) => {
        setSession(s)
        setRefresh((x) => x + 1)
      })
    })()
  }, [client])

  useEffect(() => {
    if (!client) return
    ;(async () => {
      if (session?.user?.id) {
        const { data: adminRow } = await client
          .from('app_admins')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setIsAdmin(!!adminRow)
      } else {
        setIsAdmin(false)
      }
    })()
  }, [client, session])

  useEffect(() => {
    if (!client) return
    ;(async () => {
      setLoading(true)
      try {
        const [{ data: t }, { data: tours }] = await Promise.all([
          client.from('teams').select('*').order('name'),
          client.from('tournaments').select('*').order('start_date', { ascending: true, nullsFirst: true }).order('name')
        ])
        setTeams(t || [])
        setTeamsById((t||[]).reduce((acc,x)=>{acc[x.id]=x;return acc},{}))
        setTournaments(tours || [])

        const params = new URLSearchParams(location.search)
        const tidParam = params.get('t')
        const slugParam = params.get('slug')
        let tid = ''
        if (slugParam && tours?.length) {
          const found = tours.find(x => x.slug === slugParam)
          if (found) tid = found.id
        }
        if (!tid && tidParam) tid = tidParam
        if (!tid && tours?.length) tid = tours[0].id
        setSelectedTid(tid || '')
      } finally {
        setLoading(false)
      }
    })()
  }, [client, refresh])

  useEffect(() => {
    if (!client || !selectedTid) { setTournamentTeams([]); setMatches([]); setAllSets([]); setPools([]); setPoolTeamsMap({}); return; }
    ;(async () => {
      setLoading(true)
      try {
        const [{ data: tt }, { data: m }, { data: s }, { data: p }] = await Promise.all([
          client.from('tournament_teams').select('team_id').eq('tournament_id', selectedTid),
          client.from('matches').select('*, team1:team1_id(name), team2:team2_id(name), tournament:tournament_id(name,slug)').eq('tournament_id', selectedTid).order('scheduled_at', { ascending: true }),
          client.from('sets').select('*').order('set_number'),
          client.from('pools').select('*').eq('tournament_id', selectedTid).order('order_index').order('name')
        ])
        setTournamentTeams((tt || []).map(r => r.team_id))
        setMatches(m || [])
        const matchIds = (m || []).map(x => x.id)
        setAllSets((s || []).filter(x => matchIds.includes(x.match_id)))
        setPools(p || [])

        if ((p||[]).length) {
          const { data: pt } = await client.from('pool_teams').select('*').in('pool_id', p.map(x=>x.id))
          const map = {}
          ;(pt||[]).forEach(r => { (map[r.pool_id] ||= []).push(r.team_id) })
          setPoolTeamsMap(map)
        } else {
          setPoolTeamsMap({})
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [client, selectedTid, refresh])

  async function signIn() {
    if (!client) return
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }
  async function signOut() {
    if (!client) return
    await client.auth.signOut()
  }

  async function addTeam() {
    if (!newTeam.trim() || !client) return
    setLoading(true)
    const { error } = await client.from('teams').insert({ name: newTeam.trim() })
    if (error) alert(error.message)
    setNewTeam('')
    setRefresh((x) => x + 1)
  }
  async function deleteTeam(id) {
    if (!client) return
    if (!confirm('Delete team?')) return
    setLoading(true)
    const { error } = await client.from('teams').delete().eq('id', id)
    if (error) alert(error.message)
    setRefresh((x) => x + 1)
  }

  async function addTournament() {
    if (!client) return
    const name = newTournament.trim()
    if (!name) return
    const slug = slugify(name)
    const { error } = await client.from('tournaments').insert({ name, slug })
    if (error) return alert(error.message)
    setNewTournament('')
    setRefresh((x)=>x+1)
  }
  async function deleteTournament(id) {
    if (!client) return
    if (!confirm('Delete tournament and all its matches?')) return
    const { error } = await client.from('tournaments').delete().eq('id', id)
    if (error) alert(error.message)
    if (selectedTid === id) setSelectedTid('')
    setRefresh((x)=>x+1)
  }

  async function addTeamToTournament() {
    if (!client || !selectedTid || !assignTeamId) return
    const { error } = await client.from('tournament_teams').insert({ tournament_id: selectedTid, team_id: assignTeamId })
    if (error) alert(error.message)
    setAssignTeamId('')
    setRefresh((x)=>x+1)
  }
  async function removeTeamFromTournament(team_id) {
    if (!client || !selectedTid) return
    const { error } = await client.from('tournament_teams').delete().eq('tournament_id', selectedTid).eq('team_id', team_id)
    if (error) alert(error.message)
    setRefresh((x)=>x+1)
  }

  async function createPool() {
    if (!client || !selectedTid) return
    const name = newPoolName.trim()
    if (!name) return
    const { error } = await client.from('pools').insert({ tournament_id: selectedTid, name })
    if (error) return alert(error.message)
    setNewPoolName('')
    setRefresh(x=>x+1)
  }
  async function deletePool(pool_id) {
    if (!client) return
    if (!confirm('Delete pool and its memberships?')) return
    const { error } = await client.from('pools').delete().eq('id', pool_id)
    if (error) alert(error.message)
    setRefresh(x=>x+1)
  }
  async function assignTeamToPool(pool_id, team_id) {
    if (!client || !team_id) return
    const { error } = await client.from('pool_teams').insert({ pool_id, team_id })
    if (error) alert(error.message)
    setRefresh(x=>x+1)
  }
  async function removeTeamFromPool(pool_id, team_id) {
    if (!client) return
    const { error } = await client.from('pool_teams').delete().eq('pool_id', pool_id).eq('team_id', team_id)
    if (error) alert(error.message)
    setRefresh(x=>x+1)
  }

  async function createPoolMatch(pool_id) {
    if (!client || !selectedTid) return
    const form = poolCreate[pool_id] || {}
    const team1 = form.team1, team2 = form.team2, when = form.when
    if (!team1 || !team2 || team1 === team2) return alert('Pick two different teams from the pool')
    const scheduled_at = when ? new Date(when).toISOString() : null
    const { data: m, error } = await client
      .from('matches')
      .insert({ tournament_id: selectedTid, team1_id: team1, team2_id: team2, scheduled_at, status: 'scheduled', phase: 'pool', pool_id })
      .select('*')
      .single()
    if (error) return alert(error.message)
    await client.from('sets').insert([1,2,3].map(n => ({ match_id: m.id, set_number: n })))
    setPoolCreate(prev => ({ ...prev, [pool_id]: { team1:'', team2:'', when:'' } }))
    setRefresh(x=>x+1)
  }

  async function openMatch(mid) {
    if (!client) return
    const { data: m } = await client
      .from('matches')
      .select('*, team1:team1_id(name), team2:team2_id(name), tournament:tournament_id(name,slug)')
      .eq('id', mid)
      .single()
    const { data: s } = await client
      .from('sets')
      .select('*')
      .eq('match_id', mid)
      .order('set_number')
    setSelectedMatch({ match: m, sets: s || [] })
  }

  async function adjustPoint(setId, field, delta) {
    if (!client || !selectedMatch) return
    const s = selectedMatch.sets.find((x) => x.id === setId)
    if (!s) return
    const next = Math.max(0, s[field] + delta)
    const { error } = await client.from('sets').update({ [field]: next }).eq('id', setId)
    if (error) alert(error.message)
    await openMatch(selectedMatch.match.id)
    if (selectedMatch.match.status === 'scheduled') {
      await client.from('matches').update({ status: 'in_progress' }).eq('id', selectedMatch.match.id)
      setRefresh((x) => x + 1)
    }
  }

  async function updateFinalFromSemis() {
    if (!client || !selectedTid) return
    const { data: bracket } = await client.from('matches').select('*').eq('tournament_id', selectedTid).in('bracket_slot', ['SF1','SF2','F'])
    const sf1 = (bracket||[]).find(m=>m.bracket_slot==='SF1')
    const sf2 = (bracket||[]).find(m=>m.bracket_slot==='SF2')
    let fin = (bracket||[]).find(m=>m.bracket_slot==='F')

    if (!sf1 || !sf2) return
    if (!sf1.winner_team_id || !sf2.winner_team_id) return

    if (!fin) {
      const { error } = await client.from('matches').insert({
        tournament_id: selectedTid, team1_id: sf1.winner_team_id, team2_id: sf2.winner_team_id, status:'scheduled', phase: 'final', bracket_slot: 'F'
      })
      if (error) return alert(error.message)
    } else {
      const patch = {}
      if (!fin.team1_id) patch.team1_id = sf1.winner_team_id
      if (!fin.team2_id) patch.team2_id = sf2.winner_team_id
      if (Object.keys(patch).length) {
        const { error } = await client.from('matches').update(patch).eq('id', fin.id)
        if (error) alert(error.message)
      }
    }
    setRefresh(x=>x+1)
  }

  async function completeMatch() {
    if (!client || !selectedMatch) return
    const winnerId = computeWinnerId(selectedMatch.match, selectedMatch.sets)
    const { error } = await client
      .from('matches')
      .update({ status: 'completed', winner_team_id: winnerId })
      .eq('id', selectedMatch.match.id)
    if (error) alert(error.message)
    await openMatch(selectedMatch.match.id)
    await updateFinalFromSemis()
    setRefresh((x) => x + 1)
  }

  async function deleteMatch(id) {
    if (!client) return
    if (!confirm('Delete match?')) return
    const { error } = await client.from('matches').delete().eq('id', id)
    if (error) alert(error.message)
    setRefresh((x) => x + 1)
    if (selectedMatch?.match?.id === id) setSelectedMatch(null)
  }

  async function autoSeedSemis() {
    if (!client) return
    if ((pools||[]).length !== 2) return alert('Auto-seed requires exactly 2 pools (e.g., Pool A, Pool B).')
    const [A,B] = pools
    const poolMatches = matches.filter(m => m.phase==='pool')
    const standingsA = computeStandings({ teams: teams.filter(t=> (poolTeamsMap[A.id]||[]).includes(t.id)), matches: poolMatches.filter(m=>m.pool_id===A.id), sets: allSets })
    const standingsB = computeStandings({ teams: teams.filter(t=> (poolTeamsMap[B.id]||[]).includes(t.id)), matches: poolMatches.filter(m=>m.pool_id===B.id), sets: allSets })

    if (standingsA.length<2 || standingsB.length<2) return alert('Not enough results to seed (need top 2 from each pool).')

    const A1 = standingsA[0].id, A2 = standingsA[1].id
    const B1 = standingsB[0].id, B2 = standingsB[1].id

    async function upsert(slot, team1_id, team2_id) {
      const { data: existing } = await client.from('matches').select('*').eq('tournament_id', selectedTid).eq('bracket_slot', slot).maybeSingle()
      if (existing) {
        const { error } = await client.from('matches').update({ team1_id, team2_id, phase: 'semifinal' }).eq('id', existing.id)
        if (error) alert(error.message)
      } else {
        const { error } = await client.from('matches').insert({ tournament_id: selectedTid, team1_id, team2_id, status:'scheduled', phase:'semifinal', bracket_slot: slot })
        if (error) alert(error.message)
      }
    }
    await upsert('SF1', A1, B2)
    await upsert('SF2', B1, A2)

    const { data: finalExisting } = await client.from('matches').select('*').eq('tournament_id', selectedTid).eq('bracket_slot', 'F').maybeSingle()
    if (!finalExisting) {
      const { error } = await client.from('matches').insert({ tournament_id: selectedTid, status:'scheduled', phase:'final', bracket_slot: 'F' })
      if (error) alert(error.message)
    }

    setRefresh(x=>x+1)
  }

  async function ensureFinal() {
    if (!client) return
    await updateFinalFromSemis()
  }

  const leaderboard = React.useMemo(() => {
    const tms = teams.filter(t => tournamentTeams.includes(t.id))
    return computeStandings({ teams: tms, matches, sets: allSets })
  }, [teams, matches, allSets, tournamentTeams])

  const showSetup = !(cfg?.fromEnv && cfg.url && cfg.key)
  const selectedTournament = tournaments.find(t=>t.id===selectedTid)

  function copyShareLink() {
    if (!selectedTid) return alert('Select a tournament first')
    const t = tournaments.find(x=>x.id===selectedTid)
    const u = new URL(location.href)
    u.searchParams.set(t?.slug ? 'slug' : 't', t?.slug || selectedTid)
    navigator.clipboard.writeText(u.toString())
    alert('Shareable link copied to clipboard')
  }

  function handleSaveCfgUrl(url) { setCfg(saveSupabaseConfig(url, cfg.key)) }
  function handleSaveCfgKey(key) { setCfg(saveSupabaseConfig(cfg.url, key)) }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 pb-24 sm:pb-6">
        <Header cfg={cfg} session={session} isAdmin={isAdmin} onSignOut={signOut} />

        <TournamentSelector
          tournaments={tournaments}
          selectedTid={selectedTid}
          setSelectedTid={setSelectedTid}
          isAdmin={isAdmin}
          newTournament={newTournament}
          setNewTournament={setNewTournament}
          onAddTournament={addTournament}
          onDeleteSelected={()=>deleteTournament(selectedTid)}
          selectedTournament={selectedTournament}
          onCopyShareLink={copyShareLink}
        />

        {!session && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium flex items-center gap-2"><LogIn className="w-4 h-4"/> Admin Sign-in</h2>
              <span className="text-xs opacity-70">Only admins can edit</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input type="email" placeholder="admin@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <Input type="password" placeholder="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <Button onClick={signIn} className="bg-black text-white flex items-center justify-center gap-2"><LogIn className="w-4 h-4"/>Sign in</Button>
            </div>
          </Card>
        )}

        {showSetup && (
          <Card>
            <div className="grow">
              <h2 className="text-lg font-medium flex items-center gap-2"><Upload className="w-4 h-4"/> Supabase Setup</h2>
              <p className="text-sm opacity-80 mt-1">Enter your Supabase URL and anon key (Project settings → API). Stored locally in your browser. For public deployments, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel and this panel will disappear.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <Input placeholder="SUPABASE_URL" defaultValue={cfg.url} onBlur={(e)=>handleSaveCfgUrl(e.target.value)} />
              <Input placeholder="SUPABASE_ANON_KEY" defaultValue={cfg.key} onBlur={(e)=>handleSaveCfgKey(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={()=>setRefresh(x=>x+1)} className="bg-black text-white flex items-center gap-2"><RefreshCcw className="w-4 h-4"/>Reconnect</Button>
                <Button onClick={()=>{localStorage.removeItem('volleytrack_supabase'); location.reload();}} className="bg-white">Reset</Button>
              </div>
            </div>
          </Card>
        )}

        <Leaderboard leaderboard={leaderboard} selectedTid={selectedTid} />

        {isAdmin && selectedTid && (
          <TournamentTeams
            tournamentTeams={tournamentTeams}
            allTeams={teams}
            assignTeamId={assignTeamId}
            setAssignTeamId={setAssignTeamId}
            onAddTeamToTournament={addTeamToTournament}
            onRemoveTeamFromTournament={removeTeamFromTournament}
          />
        )}

        {isAdmin && (
          <TeamsAdmin
            teams={teams}
            newTeam={newTeam}
            setNewTeam={setNewTeam}
            onAddTeam={addTeam}
            onDeleteTeam={deleteTeam}
          />
        )}

        {selectedTid && (
          <PoolsPanel
            pools={pools}
            newPoolName={newPoolName}
            setNewPoolName={setNewPoolName}
            onCreatePool={createPool}
            onDeletePool={deletePool}
            allTeams={teams}
            tournamentTeams={tournamentTeams}
            poolTeamsMap={poolTeamsMap}
            onAssignTeamToPool={assignTeamToPool}
            onRemoveTeamFromPool={removeTeamFromPool}
            poolCreate={poolCreate}
            setPoolCreate={setPoolCreate}
            onCreatePoolMatch={createPoolMatch}
          />
        )}

        {selectedTid && (
          <BracketPanel
            tournament={selectedTournament}
            matches={matches.filter(m=>m.bracket_slot)}
            teamsById={teamsById}
            onAutoSeed={autoSeedSemis}
            onEnsureFinal={ensureFinal}
            onOpenMatch={openMatch}
          />
        )}

        <MatchesList
          matches={matches}
          selectedTid={selectedTid}
          isAdmin={isAdmin}
          onOpen={openMatch}
          onDelete={deleteMatch}
          pools={pools}
          filterPhase={filterPhase}
          setFilterPhase={setFilterPhase}
          filterPool={filterPool}
          setFilterPool={setFilterPool}
        />

        {selectedMatch && (
          <LiveScoring
            matchData={selectedMatch}
            isAdmin={isAdmin}
            onAdjust={adjustPoint}
            onComplete={completeMatch}
            onClose={()=>setSelectedMatch(null)}
          />
        )}
      </div>
    </div>
  )
}