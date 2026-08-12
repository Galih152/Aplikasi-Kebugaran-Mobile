import { useEffect, useRef, useState } from 'react'
import type { GeoPoint, Sport } from '@/types/fitness'
import { appendFilteredPoint } from '@/lib/geo'

type Permission = 'unknown' | 'granted' | 'denied'

export function useGeolocationTrack(opts: { active: boolean; sport: Sport }) {
  const { active, sport } = opts
  const [points, setPoints] = useState<GeoPoint[]>([])
  const [distanceKm, setDistanceKm] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<Permission>('unknown')
  const pointsRef = useRef<GeoPoint[]>([])
  const distanceRef = useRef(0)

  useEffect(() => {
    if (!active) return

    if (!navigator.geolocation) {
      setError('Geolocation tidak didukung di perangkat ini.')
      setPermission('denied')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted')
        setError(null)
        const next: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
        }
        const result = appendFilteredPoint(
          pointsRef.current,
          next,
          sport,
          pos.coords.accuracy,
        )
        pointsRef.current = result.points
        distanceRef.current += result.addedKm
        setPoints(result.points)
        setDistanceKm(distanceRef.current)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied')
          setError('Izin lokasi ditolak. Aktifkan lokasi untuk tracking map.')
        } else {
          setError('Gagal membaca lokasi. Coba lagi di area terbuka.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [active, sport])

  const reset = () => {
    pointsRef.current = []
    distanceRef.current = 0
    setPoints([])
    setDistanceKm(0)
    setError(null)
  }

  return { points, distanceKm, error, permission, reset }
}
