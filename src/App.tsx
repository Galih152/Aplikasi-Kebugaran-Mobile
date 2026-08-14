import { useState, useEffect } from 'react'
import type { ActivitySession, Sport, UserProfile } from '@/types/fitness'
import {
  isProfileComplete,
  loadProfile,
  loadSessions,
  saveProfile,
  saveSession,
  sessionsBySport,
  weekTotals,
} from '@/lib/storage'
import { fmtTime, fmtDateId, fmtDurationHours, formatPace, formatSpeed } from '@/lib/format'
import { fetchMe, logout as apiLogout } from '@/lib/api'
import {
  clearAuth,
  getDisplayName,
  getToken,
  mapAuthUser,
  saveAuthUser,
  type AuthUser,
} from '@/lib/auth'
import { saveSessionRemote } from '@/lib/fitnessRemote'
import ProfileSetup from '@/components/ProfileSetup'
import TrackingScreen from '@/components/TrackingScreen'
import LoginScreen from '@/components/LoginScreen'
import LeaderboardScreen from '@/components/LeaderboardScreen'

/* ─── TOKENS ──────────────────────────────────────────────── */
const C = {
  bg: '#D6EEF0',
  card: '#FFFFFF',
  salmon: '#F4907A',
  salmonLight: '#FDDDD6',
  teal: '#5BBDBC',
  tealLight: '#D2EFEE',
  green: '#88C76C',
  greenLight: '#D9F0CC',
  dark: '#1C1C22',
  mid: '#6B6B80',
  soft: '#B0B0C0',
  cardBg2: '#F5F5F8',
}

type Tab = 'home' | 'activity' | 'diary' | 'leaderboard' | 'marathon'

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/* ─── ICONS ───────────────────────────────────────────────── */
function IconRun({ size = 20, color = C.dark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9.9 8.6L7 23h2.1l1.8-8 2.1 2v6h2V13l-2.1-2 .6-3C14.8 10 16.8 11 19 11V9c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-.9-1.7-.9-.3 0-.6.1-.9.2L6 7v4h2V8.3l1.9-.7z"/>
    </svg>
  )
}

function IconBike({ size = 20, color = C.dark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M15.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S3.1 13.5 5 13.5 8.5 15.1 8.5 17 6.9 20.5 5 20.5zm11.5-8.5c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zM16 8l-3-3-1 1 2 2-4.5 5H5v2h5l3-3.5L15 14h4v-2h-3.5L16 8z"/>
    </svg>
  )
}

function IconBell({ size = 18, color = C.dark }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function IconChevronRight({ size = 16, color = C.mid }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
  )
}

function IconPlay({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><polygon points="5 3 19 12 5 21 5 3"/></svg>
  )
}

function IconTrophy({ size = 14, color = C.salmon }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
  )
}

function IconFlame({ size = 14, color = C.salmon }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
  )
}

function IconClock({ size = 14, color = C.teal }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  )
}

/* ─── LINE CHART ──────────────────────────────────────────── */
function LineChart({ data, color, height = 80 }: { data: number[]; color: string; height?: number }) {
  const w = 300
  const h = height
  const pad = 12
  const safe = data.length > 0 ? data : [0]
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  const pts = safe.map((v, i) => {
    const x = pad + (i / Math.max(safe.length - 1, 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)
    return `${x},${y}`
  })
  const polyline = pts.join(' ')
  const lastPt = pts[pts.length - 1].split(',')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${polyline} ${w - pad},${h}`} fill="url(#lg)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="5" fill={color} />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="9" fill={color} fillOpacity="0.2" />
    </svg>
  )
}

function Avatar({ size = 44 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${C.salmon}, #F7C59F)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '2px solid #fff' }}>
      <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="15" r="8" fill="#fff" fillOpacity="0.9"/>
        <path d="M4 36c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#fff" fillOpacity="0.9"/>
      </svg>
    </div>
  )
}

/* ─── HOME SCREEN ─────────────────────────────────────────── */
function HomeScreen({
  sport,
  setSport,
  sessions,
  authUser,
  onStartActivity,
}: {
  sport: Sport
  setSport: (s: Sport) => void
  sessions: ActivitySession[]
  authUser: AuthUser
  onStartActivity: () => void
}) {
  const totals = weekTotals(sessions, sport)
  const weekly = totals.weekly
  const totalKm = totals.totalKm.toFixed(1)
  const accentColor = sport === 'run' ? C.salmon : C.teal
  const displayName = getDisplayName(authUser)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={46} />
          <div>
            <div style={{ fontSize: 13, color: C.mid, fontFamily: 'DM Sans, sans-serif' }}>Selamat datang,</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>
              {displayName}
            </div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <IconBell size={18} color={C.dark} />
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 22, background: `linear-gradient(135deg, ${accentColor}, ${sport === 'run' ? '#F7C59F' : '#9FE0DF'})`, padding: '16px 18px', position: 'relative', overflow: 'hidden', minHeight: 110 }}>
        <div style={{ position: 'absolute', right: -10, top: -10, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: '4px 10px', marginBottom: 8 }}>
          <IconTrophy size={12} color="#fff" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Tracking</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: 'Nunito, sans-serif', lineHeight: 1.25, maxWidth: 200 }}>
          {sport === 'run' ? 'Mulai Lari\ndengan Map' : 'Mulai Sepeda\ndengan Map'}
        </div>
        <button onClick={onStartActivity} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 24, padding: '7px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconPlay size={10} color={accentColor} />
          </div>
          Mulai
        </button>
        <div style={{ position: 'absolute', right: 16, bottom: 16, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sport === 'run' ? <IconRun size={36} color="rgba(255,255,255,0.8)" /> : <IconBike size={36} color="rgba(255,255,255,0.8)" />}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: C.mid, marginBottom: 8, fontWeight: 500 }}>Jenis Olahraga</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['run', 'cycle'] as Sport[]).map((s) => (
            <button key={s} onClick={() => setSport(s)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 20px', borderRadius: 16,
              background: sport === s ? (s === 'run' ? C.salmonLight : C.tealLight) : C.card,
              border: `1.5px solid ${sport === s ? (s === 'run' ? C.salmon : C.teal) : 'transparent'}`,
              cursor: 'pointer', flex: 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: sport === s ? (s === 'run' ? C.salmon : C.teal) : '#EBEBF0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s === 'run' ? <IconRun size={22} color={sport === s ? '#fff' : C.mid} /> : <IconBike size={22} color={sport === s ? '#fff' : C.mid} />}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: sport === s ? (s === 'run' ? C.salmon : C.teal) : C.mid }}>
                {s === 'run' ? 'Lari' : 'Sepeda'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 20, background: C.card, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: C.mid, fontWeight: 500 }}>Beban Mingguan</div>
          <span style={{ fontSize: 11, color: accentColor, fontWeight: 700, background: sport === 'run' ? C.salmonLight : C.tealLight, borderRadius: 10, padding: '2px 8px' }}>{totalKm} km</span>
        </div>
        <div style={{ fontSize: 11, color: C.soft, marginBottom: 8 }}>7 hari terakhir dari tracking lokal</div>
        <LineChart data={weekly} color={accentColor} height={72} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {WEEK_DAYS.map((d, i) => (
            <span key={i} style={{ fontSize: 10, color: C.soft, textAlign: 'center', flex: 1 }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── ACTIVITY SCREEN ─────────────────────────────────────── */
function ActivityScreen({
  sport,
  sessions,
  onOpenTracking,
}: {
  sport: Sport
  sessions: ActivitySession[]
  onOpenTracking: () => void
}) {
  const [activeTab, setActiveTab] = useState<'practise' | 'timer' | 'checkin'>('practise')
  const history = sessionsBySport(sport, sessions)
  const accentColor = sport === 'run' ? C.salmon : C.teal
  const accentLight = sport === 'run' ? C.salmonLight : C.tealLight

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>Diary Aktivitas</div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['practise', 'timer', 'checkin'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: activeTab === t ? accentColor : C.card,
            color: activeTab === t ? '#fff' : C.mid,
            fontSize: 13, fontWeight: 600,
            boxShadow: activeTab === t ? `0 4px 12px ${accentColor}55` : '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            {t === 'practise' ? 'Latihan' : t === 'timer' ? 'Timer' : 'Check In'}
          </button>
        ))}
      </div>

      {activeTab === 'timer' && (
        <div style={{ borderRadius: 20, background: C.dark, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#2A2A32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClock size={18} color={accentColor} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Tracking Map</div>
              <div style={{ fontSize: 11, color: '#8A8A9A' }}>Mulai {sport === 'run' ? 'lari' : 'sepeda'} dengan GPS</div>
            </div>
          </div>
          <button onClick={onOpenTracking} style={{ width: 42, height: 42, borderRadius: '50%', background: accentColor, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 4px 12px ${accentColor}66` }}>
            <IconPlay size={16} />
          </button>
        </div>
      )}

      {activeTab === 'practise' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>Riwayat Terbaru</div>
          {history.length === 0 && (
            <div style={{ borderRadius: 16, background: C.card, padding: 16, color: C.mid, fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              Belum ada aktivitas. Mulai dari Beranda.
            </div>
          )}
          {history.map((act) => {
            const metric =
              act.sport === 'run'
                ? formatPace(act.avgPaceOrSpeed)
                : formatSpeed(act.avgPaceOrSpeed)
            return (
              <div key={act.id} style={{ borderRadius: 16, background: C.card, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.soft, marginBottom: 2 }}>{fmtDateId(act.endedAt)}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>{act.distanceKm.toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: C.mid }}>km</span>
                    </div>
                  </div>
                  <div style={{ background: accentLight, borderRadius: 10, padding: '4px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>{metric}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconClock size={12} color={C.teal} />
                    <span style={{ fontSize: 11, color: C.mid, fontWeight: 500 }}>{fmtTime(act.durationSec)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IconFlame size={12} color={C.salmon} />
                    <span style={{ fontSize: 11, color: C.mid, fontWeight: 500 }}>{act.calories} kal</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'checkin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Pemanasan', duration: '5 menit', done: true },
            { label: sport === 'run' ? 'Lari Interval' : 'Sepeda Tempo', duration: '20 menit', done: true },
            { label: 'Pendinginan', duration: '5 menit', done: false },
          ].map((item, i) => (
            <div key={i} style={{ borderRadius: 16, background: C.card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: item.done ? accentColor : '#EBEBF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{item.label}</div>
                <div style={{ fontSize: 11, color: C.soft }}>{item.duration}</div>
              </div>
              <IconChevronRight size={16} color={C.soft} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── STATS SCREEN ────────────────────────────────────────── */
function StatsScreen({ sport, sessions }: { sport: Sport; sessions: ActivitySession[] }) {
  const accentColor = sport === 'run' ? C.salmon : C.teal
  const totals = weekTotals(sessions, sport)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>Statistik</div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, borderRadius: 18, background: C.card, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: C.tealLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconClock size={14} color={C.teal} />
            </div>
            <span style={{ fontSize: 11, color: C.mid, fontWeight: 500 }}>Waktu</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>{fmtDurationHours(totals.durationSec)}</div>
          <div style={{ fontSize: 10, color: C.soft, marginTop: 2 }}>Jam (7 hari)</div>
        </div>
        <div style={{ flex: 1, borderRadius: 18, background: C.green, padding: '14px 16px', boxShadow: `0 4px 12px ${C.green}55` }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 6 }}>Aktivitas</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', fontFamily: 'Nunito, sans-serif', lineHeight: 1 }}>{totals.count}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Sesi</div>
        </div>
      </div>

      <div style={{ borderRadius: 18, background: C.card, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Ringkasan Minggu Ini</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: C.soft }}>Total km</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{totals.totalKm}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.soft }}>Kalori (estimasi)</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: accentColor, fontFamily: 'Nunito, sans-serif' }}>{totals.calories}</div>
          </div>
        </div>
        <LineChart data={totals.weekly} color={accentColor} height={80} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {WEEK_DAYS.map((d, i) => (
            <span key={i} style={{ fontSize: 10, color: C.soft, textAlign: 'center', flex: 1 }}>{d}</span>
          ))}
        </div>
      </div>

      <div style={{ borderRadius: 18, background: C.card, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sport === 'run' ? <IconRun size={20} color="#fff" /> : <IconBike size={20} color="#fff" />}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>
            {sport === 'run' ? 'Mode Lari' : 'Mode Sepeda'}
          </div>
          <div style={{ fontSize: 10, color: C.soft }}>
            {sport === 'run' ? 'Metrik pace · MET lari' : 'Metrik kecepatan · MET sepeda'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── PROFILE SCREEN ──────────────────────────────────────── */
function ProfileScreen({
  profile,
  authUser,
  onEdit,
  onLogout,
}: {
  profile: UserProfile | null
  authUser: AuthUser
  onEdit: () => void
  onLogout: () => void
}) {
  const bmi =
    profile && isProfileComplete(profile)
      ? profile.weightKg / (profile.heightCm / 100) ** 2
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>Profil</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
        <Avatar size={72} />
        <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>
          {getDisplayName(authUser)}
        </div>
        {authUser.employeeCode && (
          <div style={{ fontSize: 12, color: C.mid, fontWeight: 600 }}>{authUser.employeeCode}</div>
        )}
        <div style={{ fontSize: 12, color: C.soft }}>Data tubuh untuk estimasi kalori</div>
      </div>

      <div style={{ borderRadius: 18, background: C.card, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {isProfileComplete(profile) && profile ? (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.soft }}>Tinggi</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{profile.heightCm} cm</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.soft }}>Berat</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{profile.weightKg} kg</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.soft }}>BMI</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{bmi?.toFixed(1)}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.mid }}>Profil belum diisi. Isi tinggi & berat sebelum tracking.</div>
        )}
        <button
          onClick={onEdit}
          style={{
            marginTop: 14,
            width: '100%',
            padding: 12,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: C.salmonLight,
            color: C.salmon,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {isProfileComplete(profile) ? 'Edit Data Tubuh' : 'Isi Data Tubuh'}
        </button>
        <button
          onClick={onLogout}
          style={{
            marginTop: 10,
            width: '100%',
            padding: 12,
            borderRadius: 14,
            border: '1.5px solid #E8E8EE',
            cursor: 'pointer',
            background: 'transparent',
            color: C.mid,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Keluar
        </button>
      </div>
    </div>
  )
}

function AuthLoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.bg,
        color: C.mid,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Memuat...
    </div>
  )
}

/* ─── APP SHELL ───────────────────────────────────────────── */
export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [sport, setSport] = useState<Sport>('run')
  const [tracking, setTracking] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [pendingTrack, setPendingTrack] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    setProfile(loadProfile())
    setSessions(loadSessions())
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      const token = getToken()
      if (!token) {
        if (!cancelled) {
          clearAuth()
          setAuthUser(null)
          setAuthLoading(false)
        }
        return
      }

      try {
        const data = await fetchMe()
        const user = mapAuthUser(data)
        if (!cancelled) {
          saveAuthUser(user)
          setAuthUser(user)
        }
      } catch {
        if (!cancelled) {
          clearAuth()
          setAuthUser(null)
        }
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    }

    bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [])

  const requestStartTracking = () => {
    if (!isProfileComplete(profile)) {
      setPendingTrack(true)
      setShowProfileSetup(true)
      return
    }
    setTracking(true)
  }

  const handleProfileSave = (p: UserProfile) => {
    saveProfile(p)
    setProfile(p)
    setShowProfileSetup(false)
    if (pendingTrack) {
      setPendingTrack(false)
      setTracking(true)
    }
  }

  const handleSaved = (session: ActivitySession) => {
    if (!authUser) return

    const enriched: ActivitySession = {
      ...session,
      employeeId: authUser.employeeId,
      employeeName: authUser.employeeName,
    }

    saveSession(enriched)
    setSessions(loadSessions())

    saveSessionRemote(enriched, authUser).catch((err) => {
      console.error('[App] Gagal sync sesi ke Firebase:', err)
    })
  }

  const handleLogout = async () => {
    try {
      await apiLogout()
    } catch (err) {
      console.error('[App] Logout error:', err)
    }
    clearAuth()
    setAuthUser(null)
    setTracking(false)
    setShowProfileSetup(false)
    setPendingTrack(false)
    setTab('home')
  }

  const accentColor = sport === 'run' ? C.salmon : C.teal

  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Beranda' },
    { id: 'activity', label: 'Aktivitas' },
    { id: 'diary', label: 'Statistik' },
    { id: 'leaderboard', label: 'Rank' },
    { id: 'marathon', label: 'Profil' },
  ]

  const tabIcons: Record<Tab, React.ReactNode> = {
    home: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    activity: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    diary: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    leaderboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
    ),
    marathon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  }

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <AuthLoadingScreen />
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <LoginScreen onSuccess={setAuthUser} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {tracking && isProfileComplete(profile) && profile ? (
          <TrackingScreen
            sport={sport}
            profile={profile}
            onBack={() => setTracking(false)}
            onSaved={handleSaved}
          />
        ) : showProfileSetup ? (
          <ProfileSetup
            initial={profile}
            onSave={handleProfileSave}
            onCancel={() => {
              setShowProfileSetup(false)
              setPendingTrack(false)
            }}
            title={pendingTrack ? 'Lengkapi Profil dulu' : 'Data Tubuh'}
          />
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen
                sport={sport}
                setSport={setSport}
                sessions={sessions}
                authUser={authUser}
                onStartActivity={requestStartTracking}
              />
            )}
            {tab === 'activity' && (
              <ActivityScreen sport={sport} sessions={sessions} onOpenTracking={requestStartTracking} />
            )}
            {tab === 'diary' && <StatsScreen sport={sport} sessions={sessions} />}
            {tab === 'leaderboard' && <LeaderboardScreen authUser={authUser} sport={sport} />}
            {tab === 'marathon' && (
              <ProfileScreen
                profile={profile}
                authUser={authUser}
                onEdit={() => setShowProfileSetup(true)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </div>

      {!tracking && !showProfileSetup && (
        <div className="app-bottom-nav">
          {tabs.map((t) => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: active ? (sport === 'run' ? C.salmonLight : C.tealLight) : 'transparent',
                color: active ? accentColor : C.soft,
                transition: 'all 0.2s',
              }}>
                {tabIcons[t.id]}
                <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'Nunito, sans-serif', color: active ? accentColor : C.soft }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
