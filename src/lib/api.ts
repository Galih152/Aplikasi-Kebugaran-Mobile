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
    const err = await res.json().catch(() => ({ message: 'Network error' }))
    throw new Error(err.message || 'Request failed')
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
