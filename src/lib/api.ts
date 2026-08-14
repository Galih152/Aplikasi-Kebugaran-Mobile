import { getToken } from '@/lib/auth'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const BASE_URL = API_BASE ? `${API_BASE}/api` : '/api'

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    let message = 'Network error'
    if (res.status === 404) {
      message = 'API tidak ditemukan. Pastikan deploy Vercel sudah include serverless /api.'
    } else {
      const err = await res.json().catch(() => null)
      message = err?.message || `Request failed (${res.status})`
    }
    throw new Error(message)
  }

  return res.json()
}

export function login(username: string, password: string) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe() {
  return api('/auth/me')
}

export function logout() {
  return api('/auth/logout', { method: 'POST' })
}
