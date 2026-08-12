import type { Sport } from '@/types/fitness'
import { formatPace, formatSpeed } from '@/lib/format'

export { formatPace, formatSpeed }

export function avgSpeedKmh(distanceKm: number, durationSec: number): number {
  if (distanceKm <= 0 || durationSec <= 0) return 0
  return distanceKm / (durationSec / 3600)
}

export function paceMinPerKm(distanceKm: number, durationSec: number): number {
  if (distanceKm <= 0 || durationSec <= 0) return 0
  return durationSec / 60 / distanceKm
}

function metForRun(speedKmh: number): number {
  if (speedKmh < 6) return 6.0
  if (speedKmh < 8) return 8.3
  if (speedKmh < 10) return 9.8
  return 11.0
}

function metForCycle(speedKmh: number): number {
  if (speedKmh < 16) return 4.0
  if (speedKmh < 20) return 6.8
  if (speedKmh < 25) return 8.0
  return 10.0
}

export function calcCalories(opts: {
  sport: Sport
  weightKg: number
  distanceKm: number
  durationSec: number
}): number {
  const { sport, weightKg, distanceKm, durationSec } = opts
  if (distanceKm <= 0 || durationSec <= 0 || weightKg <= 0) return 0
  const speed = avgSpeedKmh(distanceKm, durationSec)
  const met = sport === 'run' ? metForRun(speed) : metForCycle(speed)
  return Math.round(met * weightKg * (durationSec / 3600))
}
