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

export function appendFilteredPoint(
  points: GeoPoint[],
  next: GeoPoint,
  sport: Sport,
  accuracy?: number,
): { points: GeoPoint[]; addedKm: number } {
  if (accuracy !== undefined && accuracy > 40) {
    return { points, addedKm: 0 }
  }

  if (points.length === 0) {
    return { points: [next], addedKm: 0 }
  }

  const last = points[points.length - 1]
  const distKm = haversineKm(last, next)
  const distM = distKm * 1000

  if (distM < 3) {
    return { points, addedKm: 0 }
  }

  const dtSec = Math.max(0.001, (next.t - last.t) / 1000)
  const speedKmh = (distKm / dtSec) * 3600
  const maxSpeed = sport === 'run' ? 25 : 80
  if (speedKmh > maxSpeed) {
    return { points, addedKm: 0 }
  }

  return { points: [...points, next], addedKm: distKm }
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
