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

type MeEmployee = {
  employee_id?: number
  full_name?: string
  employee_code?: string | null
}

type MeUser = {
  id: number
  name: string
  email: string
  username?: string | null
  role: string
  employee?: MeEmployee | null
}

export function mapMeResponse(data: { user: MeUser }): AuthUser {
  const user = data.user
  const employee = user.employee

  if (!employee?.employee_id) {
    throw new Error('Akun tidak terdaftar sebagai karyawan aktif')
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    role: user.role,
    employeeId: employee.employee_id,
    employeeName: employee.full_name || user.name,
    employeeCode: employee.employee_code ?? null,
  }
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

export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_USER_KEY)
}

export function getDisplayName(user: AuthUser): string {
  return user.employeeName || user.name || 'Pengguna'
}
