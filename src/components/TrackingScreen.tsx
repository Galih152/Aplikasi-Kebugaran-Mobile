import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivitySession, Sport, UserProfile } from '@/types/fitness'
import TrackingMap from '@/components/TrackingMap'
import { useGeolocationTrack } from '@/hooks/useGeolocationTrack'
import { calcCalories, avgSpeedKmh, paceMinPerKm, formatPace, formatSpeed } from '@/lib/calories'
import { downsamplePoints } from '@/lib/geo'
import { fmtTime } from '@/lib/format'
import { clearActiveDraft, loadActiveDraft, saveActiveDraft } from '@/lib/storage'

const C = {
  card: '#FFFFFF',
  salmon: '#F4907A',
  teal: '#5BBDBC',
  dark: '#1C1C22',
  mid: '#6B6B80',
  soft: '#B0B0C0',
}

function IconPlay({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><polygon points="5 3 19 12 5 21 5 3"/></svg>
  )
}

function IconPause({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
  )
}

function IconStop({ size = 16, color = C.dark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
  )
}

function IconChevronLeft({ size = 20, color = C.dark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
  )
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export default function TrackingScreen({
  sport,
  profile,
  onBack,
  onSaved,
}: {
  sport: Sport
  profile: UserProfile
  onBack: () => void
  onSaved: (session: ActivitySession) => void
}) {
  const draftRef = useRef(loadActiveDraft())
  const draft = draftRef.current
  const canRestore = !!(draft && draft.sport === sport)

  const [running, setRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [pausedAccumMs, setPausedAccumMs] = useState(0)
  const [pauseStartedMs, setPauseStartedMs] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [showInstallHint] = useState(() => !isStandaloneDisplay())
  const restoredRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const accentColor = sport === 'run' ? C.salmon : C.teal
  const {
    points,
    distanceKm,
    movingDurationSec,
    error,
    reset,
    hydrate,
    lastFix,
    isMoving,
  } = useGeolocationTrack({ active: running, sport })

  const computeElapsed = useCallback(() => {
    if (startedAtMs == null) return 0
    const pauseExtra = pauseStartedMs != null ? Date.now() - pauseStartedMs : 0
    const paused = pausedAccumMs + (running ? 0 : pauseExtra)
    return Math.max(0, Math.floor((Date.now() - startedAtMs - paused) / 1000))
  }, [startedAtMs, pausedAccumMs, pauseStartedMs, running])

  const persistDraft = useCallback(() => {
    if (startedAtMs == null || !startedAt) return
    saveActiveDraft({
      sport,
      startedAt,
      startedAtMs,
      pausedAccumMs: pausedAccumMs + (pauseStartedMs != null && !running ? Date.now() - pauseStartedMs : 0),
      running,
      distanceKm,
      movingDurationSec,
      points,
      updatedAt: new Date().toISOString(),
    })
  }, [sport, startedAt, startedAtMs, pausedAccumMs, pauseStartedMs, running, distanceKm, movingDurationSec, points])

  const requestWakeLock = useCallback(async () => {
    try {
      if (!('wakeLock' in navigator) || !running) return
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      // best-effort
    }
  }, [running])

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release()
    } catch {
      // ignore
    }
    wakeLockRef.current = null
  }, [])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (!canRestore || !draft) return
    hydrate({
      points: draft.points,
      distanceKm: draft.distanceKm,
      movingDurationSec: draft.movingDurationSec,
    })
    setStartedAt(draft.startedAt)
    setStartedAtMs(draft.startedAtMs)
    setPausedAccumMs(draft.pausedAccumMs)
    setRunning(draft.running)
    if (!draft.running) setPauseStartedMs(Date.now())
  }, [canRestore, draft, hydrate])

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation tidak didukung di perangkat ini.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError('Izin lokasi ditolak. Aktifkan lokasi di pengaturan browser/HP.')
        } else {
          setLocateError('Gagal mengambil lokasi. Coba lagi di area terbuka.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    handleLocate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const tick = () => setElapsedSec(computeElapsed())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [computeElapsed])

  useEffect(() => {
    if (lastFix) setUserLocation({ lat: lastFix.lat, lng: lastFix.lng })
  }, [lastFix])

  useEffect(() => {
    if (running) {
      void requestWakeLock()
    } else {
      void releaseWakeLock()
    }
    return () => {
      void releaseWakeLock()
    }
  }, [running, requestWakeLock, releaseWakeLock])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setElapsedSec(computeElapsed())
        if (running) void requestWakeLock()
      }
      persistDraft()
    }
    const onHide = () => persistDraft()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
    }
  }, [computeElapsed, persistDraft, running, requestWakeLock])

  useEffect(() => {
    if (startedAtMs == null) return
    persistDraft()
    const id = window.setInterval(() => persistDraft(), 5000)
    return () => clearInterval(id)
  }, [startedAtMs, persistDraft, points, distanceKm, movingDurationSec, running])

  const calories = calcCalories({
    sport,
    weightKg: profile.weightKg,
    distanceKm,
    durationSec: movingDurationSec,
  })
  const speed = avgSpeedKmh(distanceKm, elapsedSec)
  const pace = paceMinPerKm(distanceKm, elapsedSec)
  const metricLabel = sport === 'run' ? 'Pace' : 'Speed'
  const metricValue = sport === 'run' ? formatPace(pace) : formatSpeed(speed)
  const mapLocation = lastFix
    ? { lat: lastFix.lat, lng: lastFix.lng }
    : userLocation

  const handleBack = () => {
    if (running || elapsedSec > 0) {
      const ok = window.confirm('Buang sesi tracking ini?')
      if (!ok) return
    }
    clearActiveDraft()
    reset()
    onBack()
  }

  const handleToggle = () => {
    setRunning((r) => {
      if (!r) {
        // start or resume
        if (startedAtMs == null) {
          const now = Date.now()
          setStartedAt(new Date(now).toISOString())
          setStartedAtMs(now)
          setPausedAccumMs(0)
          setPauseStartedMs(null)
        } else if (pauseStartedMs != null) {
          setPausedAccumMs((p) => p + (Date.now() - pauseStartedMs))
          setPauseStartedMs(null)
        }
        return true
      }
      // pause
      setPauseStartedMs(Date.now())
      return false
    })
  }

  const handleSave = () => {
    const endedAt = new Date().toISOString()
    const durationSec = computeElapsed()
    const session: ActivitySession = {
      id: crypto.randomUUID?.() ?? Date.now().toString(36),
      sport,
      startedAt: startedAt ?? endedAt,
      endedAt,
      durationSec,
      distanceKm: Math.round(distanceKm * 100) / 100,
      calories,
      avgPaceOrSpeed: sport === 'run' ? paceMinPerKm(distanceKm, durationSec) : avgSpeedKmh(distanceKm, durationSec),
      points: downsamplePoints(points),
    }
    clearActiveDraft()
    onSaved(session)
    reset()
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button
        onClick={handleBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: C.mid,
          fontSize: 14,
          fontWeight: 600,
          padding: 0,
          alignSelf: 'flex-start',
        }}
      >
        <IconChevronLeft size={20} color={C.mid} /> Kembali
      </button>

      <TrackingMap
        points={points}
        userLocation={mapLocation}
        accentColor={accentColor}
        following={running}
        locating={locating}
        onLocate={handleLocate}
      />

      {showInstallHint && (
        <div style={{ fontSize: 11, color: C.mid, background: C.card, borderRadius: 12, padding: '10px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          Pasang ke Home Screen (PWA) untuk tracking lebih stabil saat layar terkunci.
        </div>
      )}

      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 14,
          border: 'none',
          cursor: locating ? 'wait' : 'pointer',
          background: C.card,
          color: accentColor,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'Nunito, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          opacity: locating ? 0.7 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
        {locating ? 'Mengambil lokasi…' : mapLocation ? 'Perbarui lokasi saya' : 'Ambil lokasi perangkat'}
      </button>

      {(error || locateError) && (
        <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, background: '#FFECEC', borderRadius: 12, padding: '10px 12px' }}>
          {locateError || error}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>
            {distanceKm.toFixed(2)}
          </span>
          <span style={{ fontSize: 16, color: C.mid, fontWeight: 500 }}>km</span>
        </div>
        <div style={{ fontSize: 12, color: C.soft, marginTop: 4 }}>
          {running ? (isMoving ? 'Bergerak' : 'Diam · jarak tidak naik') : 'Siap tracking'} · {sport === 'run' ? 'Lari' : 'Sepeda'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, borderRadius: 16, background: C.card, padding: '12px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.soft, marginBottom: 2 }}>Waktu</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{fmtTime(elapsedSec)}</div>
        </div>
        <div style={{ flex: 1, borderRadius: 16, background: C.card, padding: '12px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.soft, marginBottom: 2 }}>{metricLabel}</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{metricValue}</div>
        </div>
        <div style={{ flex: 1, borderRadius: 16, background: C.card, padding: '12px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.soft, marginBottom: 2 }}>Kalori</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{calories}</div>
          <div style={{ fontSize: 9, color: C.soft }}>estimasi</div>
        </div>
      </div>

      <button
        onClick={handleToggle}
        style={{
          width: '100%',
          padding: 16,
          borderRadius: 20,
          border: 'none',
          cursor: 'pointer',
          background: running
            ? 'linear-gradient(135deg, #FF3B30, #FF6961)'
            : `linear-gradient(135deg, ${accentColor}, ${sport === 'run' ? '#F7C59F' : '#9FE0DF'})`,
          color: '#fff',
          fontSize: 16,
          fontWeight: 800,
          fontFamily: 'Nunito, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: running ? '0 8px 24px rgba(255,59,48,0.4)' : `0 8px 24px ${accentColor}55`,
        }}
      >
        {running ? (
          <><IconPause size={18} /> Jeda</>
        ) : elapsedSec > 0 ? (
          <><IconPlay size={18} /> Lanjut</>
        ) : (
          <><IconPlay size={18} /> {sport === 'run' ? 'Mulai Lari' : 'Mulai Sepeda'}</>
        )}
      </button>

      {elapsedSec > 0 && !running && (
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: 13,
            borderRadius: 18,
            border: '1.5px solid #E8E8EE',
            background: 'transparent',
            cursor: 'pointer',
            color: C.mid,
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <IconStop size={14} color={C.mid} /> Selesai & Simpan
        </button>
      )}
    </div>
  )
}
