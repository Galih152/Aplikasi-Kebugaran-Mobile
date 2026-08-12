# Plan: Usable Map Tracking + Profil User + Local Storage

## Context
- App saat ini masih prototype: tracking timer + jarak/kalori fake, tanpa GPS/map, tanpa persistensi, dengan UI denyut jantung (HR) di beberapa layar.
- Keputusan Innovate yang disepakati:
  - Hapus HR (dan VO₂ di tracking); fokus tracking map untuk lari & sepeda.
  - Profil user: tinggi + berat; **blokir Mulai** jika profil belum lengkap (opsi B).
  - Map: Leaflet + OSM + Geolocation API.
  - Kalori: rumus MET × berat × waktu; intensitas dari pace/speed; tinggi untuk profil/BMI.
  - Persistensi fase 1: `localStorage`.
  - Pembeda sport: pilihan user + MET beda + metrik (pace `/km` vs `km/h`), bukan auto-detect dari kecepatan.

## Goal
- Aplikasi bisa dipakai: isi profil → tracking GPS + peta → simpan sesi → riwayat dari data lokal.
- Tidak ada tampilan/data denyut jantung.
- Kalori dihitung dari berat user + jarak + durasi + jenis olahraga (MET).

## Detailed Specifications

### Dependensi baru
- Install runtime: `leaflet`, `react-leaflet` (versi kompatibel React 19).
- Install types: `@types/leaflet` (devDependency).
- Import CSS Leaflet di entry tracking map: `leaflet/dist/leaflet.css` (dari `src/main.tsx` atau modul map).

### File yang dibuat
| Path | Isi |
|------|-----|
| `src/types/fitness.ts` | Types: `Sport`, `UserProfile`, `GeoPoint`, `ActivitySession` |
| `src/lib/storage.ts` | Key `localStorage`, load/save profil & sesi |
| `src/lib/geo.ts` | Haversine distance, filter lonjakan, downsample polyline |
| `src/lib/calories.ts` | MET lookup + `calcCalories(...)` + pace/speed helpers |
| `src/lib/format.ts` | `fmtTime`, `fmtPace`, `fmtSpeed`, `fmtDateId` (pindah dari App bila perlu) |
| `src/components/ProfileSetup.tsx` | Form tinggi/berat (gate sebelum tracking / first run) |
| `src/components/TrackingMap.tsx` | Peta Leaflet + polyline + marker posisi |
| `src/components/TrackingScreen.tsx` | Layar tracking GPS (ganti implementasi di App) |
| `src/hooks/useGeolocationTrack.ts` | watchPosition saat aktif, akumulasi titik & jarak |

### File yang diubah
| Path | Perubahan |
|------|-----------|
| `package.json` | Dependensi leaflet |
| `src/main.tsx` | Import `leaflet/dist/leaflet.css` |
| `src/App.tsx` | Hapus HR/mock history hardcode; wiring profil, sessions, gate tracking; render screen baru; Activity/Stats/Profile baca data lokal |
| `src/index.css` | Class tinggi map (`.tracking-map { height: ... }`) agar Leaflet punya dimensi |

### Types exact (`src/types/fitness.ts`)
```ts
export type Sport = 'run' | 'cycle'

export type UserProfile = {
  heightCm: number
  weightKg: number
  name?: string
  updatedAt: string // ISO
}

export type GeoPoint = {
  lat: number
  lng: number
  t: number // epoch ms
}

export type ActivitySession = {
  id: string
  sport: Sport
  startedAt: string // ISO
  endedAt: string
  durationSec: number
  distanceKm: number
  calories: number
  avgPaceOrSpeed: number // run: min/km; cycle: km/h
  points: GeoPoint[] // sudah di-downsample
}
```

### Storage exact (`src/lib/storage.ts`)
- Keys:
  - `alora.fitness.profile` → `UserProfile | null`
  - `alora.fitness.sessions` → `ActivitySession[]`
- Functions:
  - `loadProfile(): UserProfile | null`
  - `saveProfile(profile: UserProfile): void`
  - `isProfileComplete(profile: UserProfile | null): boolean` — true jika `heightCm` 100–250 dan `weightKg` 30–250
  - `loadSessions(): ActivitySession[]`
  - `saveSession(session: ActivitySession): void` — prepend, max 50 sesi (buang tertua)
  - `sessionsBySport(sport: Sport): ActivitySession[]`

### Geo exact (`src/lib/geo.ts`)
- `haversineKm(a: GeoPoint, b: GeoPoint): number`
- `appendFilteredPoint(points: GeoPoint[], next: GeoPoint, sport: Sport): { points: GeoPoint[]; addedKm: number }`
  - Abaikan jika `accuracy` buruk (opsional param accuracy > 40m)
  - Abaikan jika delta jarak implisit speed absurd: run > 25 km/h, cycle > 80 km/h (dari jarak/waktu antar titik)
  - Abaikan titik terlalu dekat (< 3m) untuk mengurangi noise
- `downsamplePoints(points: GeoPoint[], maxPoints = 500): GeoPoint[]` — keep first/last + evenly spaced

### Calories exact (`src/lib/calories.ts`)
- Formula: `kcal = MET * weightKg * (durationSec / 3600)`
- MET dinamis dari intensitas:
  - **Run** (dari speed km/h = distanceKm / hours):
    - < 6 km/h → MET 6.0
    - 6–8 → 8.3
    - 8–10 → 9.8
    - ≥ 10 → 11.0
  - **Cycle**:
    - < 16 km/h → MET 4.0
    - 16–20 → 6.8
    - 20–25 → 8.0
    - ≥ 25 → 10.0
- Jika `distanceKm === 0` atau `durationSec === 0` → calories `0`
- Helpers:
  - `avgSpeedKmh(distanceKm, durationSec): number`
  - `paceMinPerKm(distanceKm, durationSec): number` (untuk run)
  - `formatPace(minPerKm): string` → `5'26"/km`
  - `formatSpeed(kmh): string` → `24.9 km/h`
  - `calcCalories({ sport, weightKg, distanceKm, durationSec }): number` (bulatkan integer)

### Profil / gate
- State di `App`: `profile: UserProfile | null` di-load dari storage saat mount.
- `ProfileSetup` props:
  - `initial?: UserProfile | null`
  - `onSave: (p: UserProfile) => void`
- Fields: tinggi (cm, number), berat (kg, number); validasi min/max sama `isProfileComplete`.
- Saat user tekan Mulai (Home) atau play Timer (Activity):
  - Jika `!isProfileComplete(profile)` → set flag `showProfileSetup = true` (modal/full screen di dalam shell), **jangan** buka tracking.
  - Setelah save → `saveProfile` + set state → boleh lanjut buka tracking (opsional auto-open tracking setelah save jika datang dari intent Mulai).
- `ProfileScreen`: tampilkan tinggi, berat, BMI (`weight / (height/100)^2`), tombol edit yang membuka form yang sama; hapus dependensi sosial palsu boleh diganti ringkas (nama opsional default “Pengguna”).

### TrackingMap (`src/components/TrackingMap.tsx`)
- Props: `points: GeoPoint[]`, `accentColor: string`, `following: boolean`
- `MapContainer` + `TileLayer` OSM (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) + attribution
- `Polyline` dari points; `Marker` di titik terakhir
- Saat points bertambah dan `following`, pan ke last point
- Tinggi container: class `.tracking-map` = `height: 220px; width: 100%; border-radius: 16px; overflow: hidden;`
- Fix default marker icon Leaflet di bundler (set `Icon.Default.mergeOptions` dengan URL dari `leaflet` images atau divIcon sederhana) — wajib agar marker tidak 404 di Vite.

### Hook `useGeolocationTrack`
- Params: `{ active: boolean; sport: Sport }`
- Returns: `{ points, distanceKm, error: string | null, permission: 'unknown' | 'granted' | 'denied' }`
- Saat `active === true`: `navigator.geolocation.watchPosition` dengan `{ enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }`
- Saat `active === false`: clear watch
- Akumulasi jarak via `appendFilteredPoint`
- Error message user-facing jika permission denied / unsupported

### TrackingScreen (baru)
- Props: `{ sport, profile: UserProfile, onBack, onSaved: (session: ActivitySession) => void }`
- State: `running` (boolean), `elapsed` (detik, interval 1s hanya saat running), `startedAt` (ISO | null)
- GPS hook `active = running`
- UI **tanpa** HR dan **tanpa** VO₂
- Layout (urutan):
  1. Tombol Kembali (jika `running` atau elapsed > 0: konfirmasi discard sederhana via `window.confirm`)
  2. `TrackingMap`
  3. Jarak besar (km dari GPS, 2 desimal) + label Target info teks kecil opsional (run 10 / cycle 50) — **progress tidak memaksa berhenti**
  4. Stats row: Waktu | Pace (run) atau Speed (cycle) | Kalori live (`calcCalories` dengan weight dari profile)
  5. Tombol Mulai / Jeda / Lanjut
  6. Tombol “Selesai & Simpan” saat `elapsed > 0 && !running`:
     - Bangun `ActivitySession` (id = `crypto.randomUUID()` atau `Date.now().toString(36)`)
     - `points = downsamplePoints(...)`
     - `calories = calcCalories(...)`
     - `avgPaceOrSpeed` = paceMinPerKm (run) atau avgSpeedKmh (cycle)
     - Panggil `onSaved(session)` lalu `onBack()`

### ActivityScreen changes
- Hapus field `hr` dari tampilan riwayat; hapus `IconHeart` usage di sini.
- `history` dari `sessionsBySport(sport)` (bukan `RUN_HISTORY`/`BIKE_HISTORY`).
- Tampilkan: tanggal (`endedAt` format lokal ID), km, time (`fmtTime(durationSec)`), cal, pace/speed string.
- Hapus `rank` dari UI (atau biarkan kosong) — rank mock dihapus.
- Sub-tab practise/timer/checkin: timer play tetap memanggil `onOpenTracking` (dengan gate di App).
- Jika sessions kosong: empty state teks “Belum ada aktivitas. Mulai dari Beranda.”

### StatsScreen / HomeScreen changes
- Hapus blok Detak Jantung, IconHeart, “waktu di zona HR”.
- Weekly chart: hitung 7 hari terakhir dari sessions lokal per sport (jumlah km per hari); jika kosong, array zeros.
- Kartu waktu / sesi / poin: derive sederhana dari sessions (total duration, count); **hapus poin palsu** atau ganti dengan total km minggu ini.
- MultiLineChart kalori burn vs target: boleh diganti chart sederhana total kalori per sesi terakhir (max 5) dari data lokal; jika terlalu besar scope, **hapus MultiLineChart mock** dan ganti satu ringkasan total kalori minggu ini (pilih opsi ringkas: **hapus MultiLineChart mock**, tampilkan total km + total kalori minggu ini).

### Hapus HR secara menyeluruh
- Hapus `IconHeart` jika tidak terpakai.
- Hapus field `hr` dari semua data.
- Hapus kartu HR di TrackingScreen lama.
- Hapus VO₂ dari TrackingScreen.
- Hapus konstanta `RUN_HISTORY` / `BIKE_HISTORY` hardcode (diganti storage).

### App shell wiring
- State: `profile`, `sessions`, `tracking`, `showProfileSetup`, `pendingTrack` (boolean — intent buka tracking setelah profil disimpan).
- `useEffect` mount: load profile + sessions.
- `requestStartTracking()`:
  - if incomplete profile → `showProfileSetup=true`, `pendingTrack=true`
  - else → `tracking=true`
- Setelah `saveProfile` dari setup: update state; if `pendingTrack` → `tracking=true`, clear pending.
- `handleSaved(session)`: `saveSession` + `setSessions(loadSessions())`.
- Saat `tracking`: render `TrackingScreen` dengan props di atas (bukan komponen lama inline).

### Out of scope
- Backend / auth / sync cloud
- IndexedDB
- Auto-detect sport dari kecepatan
- Wearable / sensor HR
- PWA install, background tracking saat layar mati (browser limitation)

## Implementation Checklist
1. Tulis plan file ini (`plans/map-tracking-local-storage.md`).
2. Install `leaflet`, `react-leaflet`, `@types/leaflet`; pastikan `npm run dev` tetap jalan.
3. Buat `src/types/fitness.ts` dengan types di spesifikasi.
4. Buat `src/lib/format.ts` (pindahkan `pad`/`fmtTime` dari App + formatter tanggal/pace/speed yang dibutuhkan).
5. Buat `src/lib/geo.ts` (haversine, filter, downsample).
6. Buat `src/lib/calories.ts` (MET tables + `calcCalories` + helpers intensitas).
7. Buat `src/lib/storage.ts` (profile + sessions CRUD lokal).
8. Buat `src/hooks/useGeolocationTrack.ts`.
9. Buat `src/components/TrackingMap.tsx` + fix icon Leaflet + class CSS map di `src/index.css`.
10. Import `leaflet/dist/leaflet.css` di `src/main.tsx`.
11. Buat `src/components/ProfileSetup.tsx` (form tinggi/berat + validasi).
12. Buat `src/components/TrackingScreen.tsx` (map + GPS + metrik tanpa HR/VO₂ + simpan sesi).
13. Update `App.tsx`: load profile/sessions; gate `requestStartTracking`; render ProfileSetup overlay; ganti TrackingScreen lama.
14. Update ActivityScreen: riwayat dari sessions, hapus HR/rank mock.
15. Update HomeScreen: weekly dari sessions; Mulai pakai `requestStartTracking`.
16. Update StatsScreen: hapus HR; ringkasan dari sessions; hapus MultiLineChart mock sesuai spek.
17. Update ProfileScreen: tampil tinggi/berat/BMI + edit via ProfileSetup; bersihkan elemen sosial palsu yang mengganggu (opsional minimal: tampilkan metrik profil nyata).
18. Hapus dari `App.tsx`: `RUN_HISTORY`, `BIKE_HISTORY`, `IconHeart`, sisa UI HR/VO₂, TrackingScreen inline lama.
19. Verifikasi manual: isi profil → mulai lari → izinkan GPS → lihat polyline → jeda → simpan → muncul di Aktivitas; ganti sepeda; cek kalori beda MET; refresh browser data tetap ada; tanpa profil tidak bisa tracking.

## Risks / Catatan
- GPS hanya reliable di HTTPS atau localhost; permission denied harus punya UI error jelas.
- Leaflet + React StrictMode: pastikan watchPosition di-cleanup; map container jangan double-init.
- `localStorage` quota: downsample wajib; max 50 sesi.
- Kalori = estimasi MET, bukan medis — boleh label kecil “estimasi”.
- `react-leaflet` v4 vs v5: pilih versi yang peer-dep-nya cocok React 19 saat install; jika bentrok, pin versi yang documented support React 18/19.
- Safe-area shell existing (`app-shell` dll.) tetap; jangan mengembalikan phone frame.
