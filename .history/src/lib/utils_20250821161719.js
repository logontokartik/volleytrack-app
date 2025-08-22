
import { useEffect, useState } from 'react'

export const fmtDateTime = (s) => (s ? new Date(s).toLocaleString() : '—')
export const slugify = (str) => str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

export function pointsToWin(setNumber) { return setNumber === 3 ? 15 : 25 }
export function setWinnerStrict(s) {
  const target = pointsToWin(s.set_number)
  const d1 = s.team1_points - s.team2_points
  const d2 = s.team2_points - s.team1_points
  if (s.team1_points >= target && d1 >= 2) return 1
  if (s.team2_points >= target && d2 >= 2) return 2
  return 0
}
export function computeWinnerId(match, sets) {
  let sw1=0, sw2=0, pf1=0, pf2=0
  for (const s of sets) {
    pf1 += s.team1_points; pf2 += s.team2_points
    if (s.team1_points > s.team2_points) sw1++; else if (s.team2_points > s.team1_points) sw2++
  }
  if (sw1 !== sw2) return sw1 > sw2 ? match.team1_id : match.team2_id
  if (pf1 !== pf2) return pf1 > pf2 ? match.team1_id : match.team2_id
  return match.team1_id // fallback
}
export function getActiveSet(sets) {
  const unfinished = sets.find((x) => setWinnerStrict(x) === 0)
  return unfinished || sets[sets.length - 1]
}

export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < breakpoint : false)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}
