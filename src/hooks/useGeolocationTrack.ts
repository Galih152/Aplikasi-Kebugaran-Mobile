import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeoPoint, Sport } from '@/types/fitness'
import { evaluateMovement } from '@/lib/geo'

type Permission = 'unknown' | 'granted' | 'denied'

export type LastFix = {
  lat: number
  lng: number
  t: number
  accuracy: number
}

export function useGeolocationTrack(opts: {
  active: boolean
  sport: Sport
}) {
  const { active, sport } = opts
  const [points, setPoints] = useState<GeoPoint[]>([])
  const [distanceKm, setDistanceKm] = useState(0)
  const [movingDurationSec, setMovingDurationSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<Permission>('unknown')
  const [lastFix, setLastFix] = useState<LastFix | null>(null)
  const [isMoving, setIsMoving] = useState(false)

  const pointsRef = useRef<GeoPoint[]>([])
  const lastAcceptedRef = useRef<GeoPoint | null>(null)
  const distanceRef = useRef(0)
  const movingRef = useRef(0)

  useEffect(() => {
    if (!active) {
      setIsMoving(false)
      return
    }

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
        const accuracy = pos.coords.accuracy
        setLastFix({ lat: next.lat, lng: next.lng, t: next.t, accuracy })

        const result = evaluateMovement(lastAcceptedRef.current, next, sport, accuracy)

        if (!lastAcceptedRef.current) {
          if (accuracy <= 25) {
            lastAcceptedRef.current = next
            pointsRef.current = [next]
            setPoints([next])
            setIsMoving(false)
          }
          return
        }

        if (result.accepted && result.addedKm > 0) {
          lastAcceptedRef.current = next
          pointsRef.current = [...pointsRef.current, next]
          distanceRef.current += result.addedKm
          movingRef.current += result.dtSec
          setPoints(pointsRef.current)
          setDistanceKm(distanceRef.current)
          setMovingDurationSec(movingRef.current)
          setIsMoving(true)
        } else {
          setIsMoving(false)
        }
      },
      (err) => {
        setIsMoving(false)
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied')
          setError('Izin lokasi ditolak. Aktifkan lokasi untuk tracking map.')
        } else {
          setError('Gagal membaca lokasi. Coba lagi di area terbuka.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [active, sport])

  const reset = useCallback(() => {
    pointsRef.current = []
    lastAcceptedRef.current = null
    distanceRef.current = 0
    movingRef.current = 0
    setPoints([])
    setDistanceKm(0)
    setMovingDurationSec(0)
    setLastFix(null)
    setIsMoving(false)
    setError(null)
  }, [])

  const hydrate = useCallback((data: {
    points: GeoPoint[]
    distanceKm: number
    movingDurationSec: number
  }) => {
    pointsRef.current = data.points
    lastAcceptedRef.current = data.points.length > 0 ? data.points[data.points.length - 1] : null
    distanceRef.current = data.distanceKm
    movingRef.current = data.movingDurationSec
    setPoints(data.points)
    setDistanceKm(data.distanceKm)
    setMovingDurationSec(data.movingDurationSec)
  }, [])

  return {
    points,
    distanceKm,
    movingDurationSec,
    error,
    permission,
    reset,
    hydrate,
    lastFix,
    isMoving,
  }
}
