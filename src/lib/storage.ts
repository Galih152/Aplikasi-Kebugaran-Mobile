import type { ActivitySession, ActiveDraft, Sport, UserProfile } from '@/types/fitness'

const PROFILE_KEY = 'alora.fitness.profile'
const SESSIONS_KEY = 'alora.fitness.sessions'
const DRAFT_KEY = 'alora.fitness.activeDraft'
const MAX_SESSIONS = 50
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000

export function isProfileComplete(profile: UserProfile | null): boolean {
  if (!profile) return false
  return (
    profile.heightCm >= 100 &&
    profile.heightCm <= 250 &&
    profile.weightKg >= 30 &&
    profile.weightKg <= 250
  )
}

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function loadSessions(): ActivitySession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ActivitySession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSession(session: ActivitySession): void {
  const list = loadSessions()
  const next = [session, ...list].slice(0, MAX_SESSIONS)
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(next))
}

export function sessionsBySport(sport: Sport, sessions?: ActivitySession[]): ActivitySession[] {
  const list = sessions ?? loadSessions()
  return list.filter((s) => s.sport === sport)
}

export function saveActiveDraft(draft: ActiveDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }))
}

export function loadActiveDraft(): ActiveDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as ActiveDraft
    const age = Date.now() - new Date(draft.updatedAt).getTime()
    if (age > DRAFT_MAX_AGE_MS) {
      clearActiveDraft()
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearActiveDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

export function weeklyKmByDay(sessions: ActivitySession[], sport: Sport): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0]
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 6)

  for (const s of sessions) {
    if (s.sport !== sport) continue
    const ended = new Date(s.endedAt)
    if (ended < start) continue
    const dayIndex = Math.floor((ended.getTime() - start.getTime()) / 86400000)
    if (dayIndex >= 0 && dayIndex < 7) days[dayIndex] += s.distanceKm
  }
  return days.map((v) => Math.round(v * 10) / 10)
}

export function weekTotals(sessions: ActivitySession[], sport: Sport) {
  const weekly = weeklyKmByDay(sessions, sport)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 6)

  let durationSec = 0
  let calories = 0
  let count = 0
  let totalKm = 0

  for (const s of sessions) {
    if (s.sport !== sport) continue
    if (new Date(s.endedAt) < start) continue
    durationSec += s.durationSec
    calories += s.calories
    totalKm += s.distanceKm
    count += 1
  }

  return {
    weekly,
    durationSec,
    calories,
    count,
    totalKm: Math.round(totalKm * 10) / 10,
  }
}
