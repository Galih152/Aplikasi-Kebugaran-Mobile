import type { GeoPoint, Sport } from '@/types/fitness'

const R_EARTH_KM = 6371

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function speedLimits(sport: Sport) {
  return sport === 'run'
    ? { minSpeed: 1.2, maxSpeed: 25 }
    : { minSpeed: 2.5, maxSpeed: 80 }
}

export type MovementReason = 'accuracy' | 'distance' | 'speed' | 'ok'

/** Evaluate movement from lastAccepted → next. Does not mutate arrays. */
export function evaluateMovement(
  lastAccepted: GeoPoint | null,
  next: GeoPoint,
  sport: Sport,
  accuracy?: number,
): { accepted: boolean; addedKm: number; dtSec: number; reason: MovementReason } {
  if (accuracy === undefined || accuracy > 50) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'accuracy' }
  }

  if (!lastAccepted) {
    return { accepted: true, addedKm: 0, dtSec: 0, reason: 'ok' }
  }

  const distKm = haversineKm(lastAccepted, next)
  const distM = distKm * 1000
  const minDist = Math.max(5, accuracy * 0.35)
  if (distM < minDist) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'distance' }
  }

  const dtSecRaw = Math.max(0.001, (next.t - lastAccepted.t) / 1000)
  const speedKmh = (distKm / dtSecRaw) * 3600
  const { minSpeed, maxSpeed } = speedLimits(sport)

  if (speedKmh > maxSpeed) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'speed' }
  }

  const gapOk =
    dtSecRaw > 15 && distM >= Math.max(8, accuracy * 0.4) && speedKmh <= maxSpeed

  if (speedKmh < minSpeed && !gapOk) {
    return { accepted: false, addedKm: 0, dtSec: 0, reason: 'speed' }
  }

  return {
    accepted: true,
    addedKm: distKm,
    dtSec: Math.min(dtSecRaw, 30),
    reason: 'ok',
  }
}

/** @deprecated Prefer evaluateMovement via hook; kept for compatibility */
export function appendFilteredPoint(
  points: GeoPoint[],
  next: GeoPoint,
  sport: Sport,
  accuracy?: number,
): { points: GeoPoint[]; addedKm: number } {
  const last = points.length > 0 ? points[points.length - 1] : null
  const result = evaluateMovement(last, next, sport, accuracy)
  if (!last) {
    return { points: [next], addedKm: 0 }
  }
  if (!result.accepted) {
    return { points, addedKm: 0 }
  }
  return { points: [...points, next], addedKm: result.addedKm }
}

export function downsamplePoints(points: GeoPoint[], maxPoints = 500): GeoPoint[] {
  if (points.length <= maxPoints) return points
  if (maxPoints < 2) return points.slice(0, maxPoints)

  const result: GeoPoint[] = [points[0]]
  const inner = maxPoints - 2
  for (let i = 1; i <= inner; i++) {
    const idx = Math.round((i / (inner + 1)) * (points.length - 1))
    result.push(points[idx])
  }
  result.push(points[points.length - 1])
  return result
}
