const TOKEN_KEY = 'alora.fitness.token'
const AUTH_USER_KEY = 'alora.fitness.authUser'

export type AuthUser = {
  id: number
  name: string
  email: string
  username: string | null
  role: string
  employeeId: number
  employeeName: string
  employeeCode: string | null
}

type AuthPayload = {
  token: string
  user: AuthUser
}

type MePayload = {
  user: AuthUser
}

export function mapAuthUser(data: AuthPayload | MePayload): AuthUser {
  const user = data.user

  if (!user?.employeeId) {
    throw new Error('Akun tidak terdaftar sebagai karyawan aktif')
  }

  return user
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function loadAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export function getDisplayName(user: AuthUser): string {
  return user.employeeName || user.name || 'Pengguna'
}
