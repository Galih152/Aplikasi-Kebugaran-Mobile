import { useEffect, useMemo, useState } from 'react'
import type { AuthUser } from '@/lib/auth'
import { fetchLeaderboard, getMyRank, sortLeaderboard } from '@/lib/fitnessRemote'
import type { Sport } from '@/types/fitness'

const C = {
  card: '#FFFFFF',
  salmon: '#F4907A',
  salmonLight: '#FDDDD6',
  teal: '#5BBDBC',
  tealLight: '#D2EFEE',
  dark: '#1C1C22',
  mid: '#6B6B80',
  soft: '#B0B0C0',
}

function IconTrophy({ size = 18, color = C.salmon }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  )
}

export default function LeaderboardScreen({
  authUser,
  sport,
}: {
  authUser: AuthUser
  sport: Sport
}) {
  const [sortBy, setSortBy] = useState<'km' | 'sessions'>('km')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchLeaderboard>>>([])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchLeaderboard()
        if (!cancelled) setEntries(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat leaderboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = useMemo(() => sortLeaderboard(entries, sortBy), [entries, sortBy])
  const myRank = useMemo(() => getMyRank(sorted, authUser.employeeId), [sorted, authUser.employeeId])
  const accentColor = sport === 'run' ? C.salmon : C.teal
  const accentLight = sport === 'run' ? C.salmonLight : C.tealLight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>
            Leaderboard
          </div>
          <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>Pegawai yang aktif olahraga</div>
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: accentLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconTrophy color={accentColor} />
        </div>
      </div>

      {myRank != null && (
        <div
          style={{
            borderRadius: 16,
            background: accentLight,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: accentColor,
          }}
        >
          Posisi kamu: #{myRank}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {(['km', 'sessions'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortBy(key)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              background: sortBy === key ? accentColor : C.card,
              color: sortBy === key ? '#fff' : C.mid,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: sortBy === key ? `0 4px 12px ${accentColor}55` : '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            {key === 'km' ? 'Total KM' : 'Jumlah Sesi'}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ fontSize: 13, color: C.mid, textAlign: 'center', padding: 24 }}>Memuat...</div>
      )}

      {!loading && error && (
        <div
          style={{
            borderRadius: 16,
            background: C.card,
            padding: 16,
            color: '#FF3B30',
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div
          style={{
            borderRadius: 16,
            background: C.card,
            padding: 20,
            color: C.mid,
            fontSize: 13,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          Belum ada pegawai yang mencatat olahraga
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((entry, index) => {
            const isMe = entry.employeeId === authUser.employeeId
            return (
              <div
                key={entry.employeeId}
                style={{
                  borderRadius: 16,
                  background: isMe ? accentLight : C.card,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: isMe ? `1.5px solid ${accentColor}` : '1.5px solid transparent',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: index < 3 ? accentColor : '#EBEBF0',
                    color: index < 3 ? '#fff' : C.mid,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: C.dark,
                      fontFamily: 'Nunito, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.employeeName}
                    {isMe && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: accentColor, fontWeight: 800 }}>
                        Kamu
                      </span>
                    )}
                  </div>
                  {entry.employeeCode && (
                    <div style={{ fontSize: 11, color: C.soft }}>{entry.employeeCode}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>
                    {sortBy === 'km' ? entry.totalKm.toFixed(1) : entry.sessionCount}
                  </div>
                  <div style={{ fontSize: 10, color: C.soft }}>
                    {sortBy === 'km' ? 'km' : 'sesi'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
