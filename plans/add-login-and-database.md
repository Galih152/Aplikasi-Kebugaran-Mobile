# Plan: Login + Firebase + Leaderboard (Aplikasi Kebugaran Mobile)

## Context
- App kebugaran saat ini: Vite/React PWA, data profil & sesi olahraga **100% localStorage**, belum ada auth/API/Firebase.
- Auth Superapp sudah ada di `backend-superapp` (`POST /auth/login`, `GET /auth/me`, `POST /auth/logout`) dengan **cookie session** (`credentials: "include"`).
- **Perubahan requirement:** API base **local** `backend-superapp` (default `http://localhost:3000`), **bukan** `https://api.waschenalora.com/` untuk development.
- Data olahraga & leaderboard disimpan di **Firebase Realtime Database** (project `dailyuser-2747f` dari plan awal).
- **Tidak mengubah logic auth Superapp** — hanya konsumsi endpoint yang sudah ada + konfigurasi CORS env untuk origin app kebugaran.

## Goal
1. User wajib login di awal menggunakan kredensial Alora (email/username + password) via API local Superapp.
2. Setelah tracking selesai, sesi olahraga tersimpan ke Firebase (beserta identitas pegawai dari login).
3. Tab Leaderboard menampilkan ranking pegawai yang pernah olahraga berdasarkan **total km** dan **jumlah sesi** (periode default: minggu berjalan).

## Detailed Specifications

### A. Konfigurasi environment

#### Aplikasi Kebugaran Mobile
Buat file `.env.local` (gitignore, tidak di-commit):
```
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=dailyuser-2747f.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://dailyuser-2747f-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=dailyuser-2747f
VITE_FIREBASE_STORAGE_BUCKET=dailyuser-2747f.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=481625882072
VITE_FIREBASE_APP_ID=1:481625882072:web:1fec2c420ceecba0e046ad
VITE_FIREBASE_MEASUREMENT_ID=G-1ZCBYLFFWL
```
Buat `.env.example` dengan placeholder (tanpa secret nyata).

#### backend-superapp (hanya env, tanpa ubah kode auth)
Tambahkan origin app kebugaran ke `CORS_ORIGIN` (comma-separated), contoh dev:
```
CORS_ORIGIN=http://localhost:5173,http://localhost:8443
```
App kebugaran dev berjalan di port **8443** (`vite.config.ts`).

---

### B. Dependencies (Aplikasi Kebugaran Mobile)

Tambah ke `package.json`:
- `firebase` (modular SDK v9+)

Tidak perlu `react-router` — gate auth tetap di `App.tsx` dengan state `authUser | null`.

---

### C. File baru — API client auth

**`src/lib/api.ts`**
- `BASE_URL` dari `import.meta.env.VITE_API_URL` (fallback `http://localhost:3000`)
- Fungsi `api(path, options)` — mirror Superapp FE:
  - `fetch(`${BASE_URL}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" } })`
  - throw `Error(message)` jika `!res.ok`
- Export:
  - `login(identifier: string, password: string)` → `POST /auth/login` body `{ identifier, password }`
  - `fetchMe()` → `GET /auth/me`
  - `logout()` → `POST /auth/logout`

**`src/lib/auth.ts`**
- Key localStorage: `alora.fitness.authUser` (cache profil ringkas, bukan sumber auth)
- Types:
```ts
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
```
- Fungsi:
  - `mapMeResponse(data)` — dari response `/auth/me` atau `/auth/login`
  - `saveAuthUser(user: AuthUser)`
  - `loadAuthUser(): AuthUser | null`
  - `clearAuthUser()`
  - `getDisplayName(user: AuthUser): string` — prioritas `employee.full_name` / `name`

---

### D. File baru — Firebase

**`src/lib/firebase.ts`**
- `initializeApp(firebaseConfig)` dari env `VITE_FIREBASE_*`
- Export `getDatabase(app)` (Realtime Database)
- **Tidak** init Analytics di tahap ini (hindari error SSR/PWA di dev tanpa consent)

**`src/lib/fitnessRemote.ts`**
- Path RTDB:
  - `fitness/sessions/{sessionId}` — dokumen sesi
  - `fitness/leaderboard/{employeeId}` — agregat per pegawai (denormalized untuk query cepat)
- Type `RemoteSession`:
```ts
{
  id: string
  employeeId: number
  employeeName: string
  employeeCode: string | null
  sport: 'run' | 'cycle'
  startedAt: string
  endedAt: string
  durationSec: number
  distanceKm: number
  calories: number
  avgPaceOrSpeed: number
  pointCount: number        // jumlah titik GPS (points array tidak disimpan penuh di RTDB awal)
  createdAt: string
}
```
- Type `LeaderboardEntry`:
```ts
{
  employeeId: number
  employeeName: string
  employeeCode: string | null
  totalKm: number
  sessionCount: number
  lastActivityAt: string
  updatedAt: string
}
```
- Fungsi:
  - `saveSessionRemote(session: ActivitySession, user: AuthUser): Promise<void>`
    - `push`/`set` ke `fitness/sessions/{id}`
    - `transaction` update `fitness/leaderboard/{employeeId}`: increment `sessionCount`, add `totalKm`, update `lastActivityAt`
  - `fetchLeaderboard(): Promise<LeaderboardEntry[]>` — read `fitness/leaderboard`, sort by `totalKm` desc, tie-break `sessionCount`
  - `getMyRank(entries, employeeId): number | null`

**Catatan Firebase Security Rules (manual di Firebase Console, di luar repo):**
- Dev awal: rules permissive untuk testing (document di plan risks)
- Prod nanti: restrict write `leaderboard/{employeeId}` hanya jika `employeeId` match (butuh Firebase Auth atau custom token — **out of scope** fase ini; catat sebagai risk)

---

### E. Types — perubahan

**`src/types/fitness.ts`**
- Extend `ActivitySession`:
```ts
employeeId?: number
employeeName?: string
```
- Extend `UserProfile`:
```ts
employeeId?: number
```
- Tambah export re-use `LeaderboardEntry` dari `fitnessRemote` atau duplikasi type di `fitness.ts`

---

### F. Komponen baru

**`src/components/LoginScreen.tsx`**
- Props: `onSuccess: (user: AuthUser) => void`
- State: `identifier`, `password`, `error`, `loading`
- UI: konsisten token warna app (`C.salmon`, `C.teal`, `Nunito`)
- Submit → `login()` → map user → `saveAuthUser` → `onSuccess`
- Validasi: field tidak kosong

**`src/components/LeaderboardScreen.tsx`**
- Props: `authUser: AuthUser`, `sport: Sport` (filter opsional per sport — fase 1: **semua sport digabung**)
- State: `entries`, `loading`, `error`, `sortBy: 'km' | 'sessions'`
- Fetch `fetchLeaderboard()` on mount
- Tampilkan:
  - Top list (rank, nama, total km, jumlah sesi)
  - Badge "Kamu" untuk baris `employeeId === authUser.employeeId`
  - Toggle sort: Total KM / Jumlah Sesi
- Empty state: "Belum ada pegawai yang mencatat olahraga"

---

### G. Perubahan file existing

**`src/App.tsx`**
- State baru:
  - `authUser: AuthUser | null`
  - `authLoading: boolean` (bootstrap `/auth/me`)
- `useEffect` mount:
  1. `fetchMe()` → set `authUser` + `saveAuthUser`
  2. on fail → `clearAuthUser`, `authUser = null`
- Render gate:
  - `authLoading` → loading screen sederhana
  - `!authUser` → `<LoginScreen onSuccess={setAuthUser} />`
  - `authUser` → shell existing
- Tab type extend: `'home' | 'activity' | 'diary' | 'marathon' | 'leaderboard'`
- Bottom nav tambah tab **Leaderboard** (icon trophy)
- `HomeScreen`: `displayName` dari `authUser` (bukan `profile?.name`)
- `ProfileScreen`:
  - Tampilkan nama + employee code dari `authUser`
  - Tombol **Keluar** → `logout()` + `clearAuthUser()` + reset state
- `handleSaved(session)`:
  1. Enrich session dengan `employeeId`, `employeeName` dari `authUser`
  2. `saveSession(session)` lokal (tetap)
  3. `saveSessionRemote(session, authUser)` — fire-and-forget dengan toast/error silent log (jangan block UI)
- Pass `authUser` ke `LeaderboardScreen`

**`src/lib/storage.ts`**
- Tidak ubah key existing; profil tubuh tetap terpisah dari auth

**`vite.config.ts`**
- Tidak wajib proxy — FE langsung ke `localhost:3000` via `VITE_API_URL` + CORS backend

---

### H. Alur auth (local Superapp)

```
[LoginScreen]
  POST http://localhost:3000/auth/login
  { identifier, password }
  credentials: include
  ← Set-Cookie alora.sid

[Bootstrap App]
  GET http://localhost:3000/auth/me
  credentials: include
  ← { user: { id, name, email, username, role, employee: { employee_id, full_name, employee_code, ... } } }

[Logout]
  POST http://localhost:3000/auth/logout
  clearAuthUser()
```

Mapping `AuthUser`:
- `employeeId` ← `user.employee.employee_id`
- `employeeName` ← `user.employee.full_name || user.name`
- `employeeCode` ← `user.employee.employee_code`

---

### I. Alur data olahraga → Firebase

```
[TrackingScreen selesai]
  → ActivitySession (lokal + employeeId)
  → saveSession(localStorage)
  → saveSessionRemote(Firebase)
       fitness/sessions/{id}
       fitness/leaderboard/{employeeId} (transaction increment)

[LeaderboardScreen]
  → fetchLeaderboard()
  → sort km / sessions
```

Points GPS: **tidak** upload full array ke RTDB fase 1 (hemat bandwidth); simpan `pointCount` saja. Array tetap di localStorage.

---

## Implementation Checklist

1. Tambah dependency `firebase` di `Aplikasi Kebugaran Mobile/package.json`.
2. Buat `.env.example` dan dokumentasi `.env.local` dengan `VITE_API_URL=http://localhost:3000` + Firebase vars.
3. Update `CORS_ORIGIN` di env `backend-superapp` agar include `http://localhost:8443` (dan origin LAN jika pakai `--host`).
4. Buat `src/lib/api.ts` — client fetch dengan `credentials: "include"`.
5. Buat `src/lib/auth.ts` — types, map response, localStorage cache.
6. Buat `src/lib/firebase.ts` — init Firebase dari env.
7. Buat `src/lib/fitnessRemote.ts` — save session + fetch/update leaderboard RTDB.
8. Extend `src/types/fitness.ts` — field `employeeId`, `employeeName` opsional di session.
9. Buat `src/components/LoginScreen.tsx`.
10. Buat `src/components/LeaderboardScreen.tsx`.
11. Refactor `src/App.tsx` — auth bootstrap, login gate, tab leaderboard, logout, enrich onSaved + Firebase sync.
12. Update `HomeScreen` / `ProfileScreen` di `App.tsx` — nama dari `authUser`.
13. Manual test: backend-superapp running port 3000, app kebugaran port 8443, login valid, `/auth/me` restore, tracking save, leaderboard tampil.

---

## Risks / Catatan

- **CORS wajib** — tanpa `CORS_ORIGIN` include origin app kebugaran, login dari browser akan gagal (preflight/cookie).
- **Cookie cross-port** — `localhost:8443` → `localhost:3000` di dev OK dengan `sameSite: lax` (non-prod backend).
- **Session 2 jam** — user harus login ulang setelah session Superapp expired; acceptable fase 1.
- **Firebase rules** — RTDB default open berbahaya; set rules testing di Console sebelum deploy publik.
- **Firebase config di env** — jangan commit `.env.local`; apiKey Firebase boleh public tapi rules harus ketat.
- **Offline sync** — fase 1: jika Firebase gagal, sesi tetap tersimpan lokal; tidak ada retry queue (nice-to-have later).
- **Leaderboard scope** — hanya pegawai yang pernah submit sesi; tidak pull seluruh `mst_employee`.
- **Tidak ubah** controller/route auth di `backend-superapp` — hanya env CORS.

---

## Out of Scope (fase ini)

- Endpoint auth baru di backend-superapp
- Firebase Authentication (custom token)
- Upload full GPS polyline ke cloud
- Filter leaderboard per departemen/perusahaan
- Periode cutoff custom (gunakan minggu kalender 7 hari untuk highlight opsional later)
