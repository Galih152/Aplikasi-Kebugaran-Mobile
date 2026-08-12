export type Sport = 'run' | 'cycle'

export type UserProfile = {
  heightCm: number
  weightKg: number
  name?: string
  updatedAt: string
}

export type GeoPoint = {
  lat: number
  lng: number
  t: number
}

export type ActivitySession = {
  id: string
  sport: Sport
  startedAt: string
  endedAt: string
  durationSec: number
  distanceKm: number
  calories: number
  avgPaceOrSpeed: number
  points: GeoPoint[]
}
