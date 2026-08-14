import { get, ref, runTransaction, set } from 'firebase/database'
import type { AuthUser } from '@/lib/auth'
import { getFirebaseDatabase, isFirebaseConfigured } from '@/lib/firebase'
import type { ActivitySession } from '@/types/fitness'

export type LeaderboardEntry = {
  employeeId: number
  employeeName: string
  employeeCode: string | null
  totalKm: number
  sessionCount: number
  lastActivityAt: string
  updatedAt: string
}

type RemoteSession = {
  id: string
  employeeId: number
  employeeName: string
  employeeCode: string | null
  sport: ActivitySession['sport']
  startedAt: string
  endedAt: string
  durationSec: number
  distanceKm: number
  calories: number
  avgPaceOrSpeed: number
  pointCount: number
  createdAt: string
}

function roundKm(value: number): number {
  return Math.round(value * 1000) / 1000
}

export async function saveSessionRemote(session: ActivitySession, user: AuthUser): Promise<void> {
  const database = getFirebaseDatabase()
  if (!database || !isFirebaseConfigured()) {
    console.warn('[fitnessRemote] Firebase belum dikonfigurasi, sesi hanya disimpan lokal')
    return
  }

  const remote: RemoteSession = {
    id: session.id,
    employeeId: user.employeeId,
    employeeName: user.employeeName,
    employeeCode: user.employeeCode,
    sport: session.sport,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: session.durationSec,
    distanceKm: session.distanceKm,
    calories: session.calories,
    avgPaceOrSpeed: session.avgPaceOrSpeed,
    pointCount: session.points.length,
    createdAt: new Date().toISOString(),
  }

  await set(ref(database, `fitness/sessions/${session.id}`), remote)

  const leaderboardRef = ref(database, `fitness/leaderboard/${user.employeeId}`)
  await runTransaction(leaderboardRef, (current) => {
    const prev = (current ?? {}) as Partial<LeaderboardEntry>
    const prevKm = typeof prev.totalKm === 'number' ? prev.totalKm : 0
    const prevCount = typeof prev.sessionCount === 'number' ? prev.sessionCount : 0

    return {
      employeeId: user.employeeId,
      employeeName: user.employeeName,
      employeeCode: user.employeeCode,
      totalKm: roundKm(prevKm + session.distanceKm),
      sessionCount: prevCount + 1,
      lastActivityAt: session.endedAt,
      updatedAt: new Date().toISOString(),
    } satisfies LeaderboardEntry
  })
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const database = getFirebaseDatabase()
  if (!database || !isFirebaseConfigured()) {
    return []
  }

  const snapshot = await get(ref(database, 'fitness/leaderboard'))
  if (!snapshot.exists()) return []

  const raw = snapshot.val() as Record<string, LeaderboardEntry>
  return Object.values(raw).filter((entry) => entry && typeof entry.employeeId === 'number')
}

export function sortLeaderboard(
  entries: LeaderboardEntry[],
  sortBy: 'km' | 'sessions',
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'km') {
      if (b.totalKm !== a.totalKm) return b.totalKm - a.totalKm
      return b.sessionCount - a.sessionCount
    }
    if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount
    return b.totalKm - a.totalKm
  })
}

export function getMyRank(entries: LeaderboardEntry[], employeeId: number): number | null {
  const index = entries.findIndex((e) => e.employeeId === employeeId)
  return index >= 0 ? index + 1 : null
}
