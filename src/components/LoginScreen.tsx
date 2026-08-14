import { useState } from 'react'
import { login as apiLogin } from '@/lib/api'
import { mapAuthUser, setAuth, type AuthUser } from '@/lib/auth'

const C = {
  card: '#FFFFFF',
  salmon: '#F4907A',
  dark: '#1C1C22',
  mid: '#6B6B80',
  soft: '#B0B0C0',
  bg: '#D6EEF0',
}

export default function LoginScreen({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi')
      return
    }

    setLoading(true)
    try {
      const data = await apiLogin(username.trim(), password)
      const user = mapAuthUser(data)
      setAuth(data.token, user)
      onSuccess(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 20,
        padding: '24px 20px',
        background: C.bg,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: C.dark,
            fontFamily: 'Nunito, sans-serif',
            marginBottom: 6,
          }}
        >
          Aplikasi Bugar
        </div>
        <div style={{ fontSize: 14, color: C.mid, lineHeight: 1.5 }}>
          Masuk dengan username Alora untuk tracking dan leaderboard
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          borderRadius: 22,
          background: C.card,
          padding: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            disabled={loading}
            style={{
              border: '1.5px solid #E8E8EE',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 15,
              fontFamily: 'DM Sans, sans-serif',
              color: C.dark,
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
            style={{
              border: '1.5px solid #E8E8EE',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 15,
              fontFamily: 'DM Sans, sans-serif',
              color: C.dark,
              outline: 'none',
            }}
          />
        </label>

        {error && (
          <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600, lineHeight: 1.4 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 4,
            width: '100%',
            padding: 15,
            borderRadius: 16,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            background: `linear-gradient(135deg, ${C.salmon}, #F7C59F)`,
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'Nunito, sans-serif',
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
