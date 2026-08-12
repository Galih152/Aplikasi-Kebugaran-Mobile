const pad = (n: number) => String(n).padStart(2, '0')

export function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

export function fmtDateId(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatPace(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return "--'/--\"/km"
  const totalSec = Math.round(minPerKm * 60)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}'${pad(s)}"/km`
}

export function formatSpeed(kmh: number): string {
  if (!Number.isFinite(kmh) || kmh <= 0) return '-- km/h'
  return `${kmh.toFixed(1)} km/h`
}

export function fmtDurationHours(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}:${pad(m)}`
}
