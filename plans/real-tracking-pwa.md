# Plan: Real Movement Tracking + PWA (Android & iPhone)

## Context
- User melihat jarak/metrik naik padahal belum bergerak: GPS drift (+ filter longgar ≥3 m) dan timer/kalori ikut terasa “jalan sendiri”.
- Preferensi: **saat diam tetap rekam** (waktu sesi lanjut), **jarak tidak naik**; **bukan** auto-jeda.
- Background = **layar terkunci**; terbuka ke **PWA**; target **Android + iPhone**.
- Stack saat ini: Vite React web, GPS `watchPosition` hanya saat `running`, belum ada manifest/SW/Wake Lock; elapsed pakai `setInterval` (rentan saat tab throttle).

## Goal
- Jarak & kalori hanya bertambah dari **perpindahan GPS yang valid** (gerak nyata), bukan noise saat diam.
- Waktu sesi tetap berjalan saat diam (rekam terus) tanpa auto-pause.
- PWA installable di Android & iPhone; best-effort tracking saat layar kunci (dengan batasan platform, terutama iOS).
- Draft sesi aktif tersimpan di `localStorage` agar tidak hilang saat tab di-throttle/refresh.

## Detailed Specifications

### A. Filter gerak nyata (`src/lib/geo.ts`)

Ubah `appendFilteredPoint(points, next, sport, accuracy?)`:

1. **Accuracy gate:** tolak tambah jarak jika `accuracy` undefined atau `accuracy > 25` (lebih ketat dari 40).
2. **Noise vs accuracy:** tolak jika `distM < max(10, accuracy * 0.5)` — loncatan lebih kecil dari ketidakpastian GPS tidak dihitung jarak.
3. **Minimum speed (km/h)** antar titik terakhir yang diterima:
   - `run`: `minSpeed = 2`, `maxSpeed = 25`
   - `cycle`: `minSpeed = 4`, `maxSpeed = 80`
   - Hitung `speedKmh` dari `distKm / dtSec`; jika di luar rentang → `addedKm = 0` (titik boleh di-update sebagai “last known” **tanpa** menambah jarak — lihat poin 4).
4. **Update posisi tanpa jarak:** jika titik gagal gate jarak tapi accuracy bagus (`≤ 25`), ganti `points[last]` dengan `next` **atau** simpan `lastAccepted` terpisah di hook (pilih pendekatan hook di bawah) supaya drift tidak menumpuk sebagai polyline panjang palsu.
5. Export helper baru: `isMovementAccepted(addedKm: number): boolean` tidak perlu jika hook cukup cek `addedKm > 0`.

**Pendekatan exact di hook (disarankan):**
- Simpan `lastPointRef` (setiap fix GPS).
- Simpan `trackPoints` hanya saat `addedKm > 0` (atau first point).
- Distance hanya `+= addedKm` saat accepted.
- First point: set baseline, `addedKm = 0` (sama seperti sekarang).

### B. Hook `useGeolocationTrack` (`src/hooks/useGeolocationTrack.ts`)

Returns diperluas:
```ts
{
  points,           // hanya titik yang membentuk rute gerak valid (+ start)
  distanceKm,
  error,
  permission,
  reset,
  lastFix,          // { lat, lng, t, accuracy } | null — posisi terkini meski diam
  isMoving,         // true jika addedKm > 0 pada fix terakhir yang diterima sebagai gerak
}
```

- `watchPosition` options: `{ enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }`
- Saat diam: `isMoving = false`, `distanceKm` tidak berubah, `lastFix` tetap update untuk marker map.
- Map memakai `lastFix` untuk marker; `points` untuk polyline.

### C. Timer & kalori real (`TrackingScreen.tsx` + `calories.ts`)

1. **Elapsed wall-clock (bukan hanya setInterval):**
   - State: `startedAtMs`, `pausedAccumMs`, `running`.
   - Saat running: `elapsedSec = floor((Date.now() - startedAtMs - pausedAccumMs) / 1000)` di-refresh tiap 1s **dan** saat `visibilitychange` / resume.
   - Saat jeda manual: catat `pauseStartedMs`; saat lanjut: tambah ke `pausedAccumMs`.
   - Ini menjaga waktu akurat setelah layar kunci me-throttle `setInterval`.

2. **Kalori:**
   - Ubah `calcCalories` agar memakai **`movingDurationSec`** (bukan total elapsed), di samping `distanceKm`.
   - Hook/TrackingScreen akumulasi `movingDurationSec`: tiap detik running, jika `isMoving` true dalam window terakhir (mis. ada accepted point dalam 5 detik terakhir) → `movingDurationSec++`; **atau** lebih sederhana: `movingDurationSec` dihitung ulang sebagai `distanceKm / avgSpeed` tidak stabil.
   - **Exact pilihan plan:** akumulasi di hook:
     - Setiap kali `addedKm > 0`, tambahkan `dtSec` antar last-accepted dan current (clamp 0–30s) ke `movingDurationSec`.
   - `calcCalories({ sport, weightKg, distanceKm, durationSec: movingDurationSec })`.
   - UI tetap tampilkan **waktu sesi total** (`elapsedSec`); label kalori “estimasi”; pace/speed pakai `elapsedSec` atau moving — **exact:** pace/speed display pakai `distanceKm` + `elapsedSec` (standar olahraga: termasuk idle), tapi kalori pakai `movingDurationSec` supaya diam tidak membakar kalori palsu.

3. **Tidak ada auto-pause** saat diam.

### D. Draft sesi aktif (`src/lib/storage.ts` + TrackingScreen)

- Key baru: `alora.fitness.activeDraft`
- Type `ActiveDraft`:
  ```ts
  {
    sport: Sport
    startedAt: string
    pausedAccumMs: number
    running: boolean
    distanceKm: number
    movingDurationSec: number
    points: GeoPoint[]
    updatedAt: string
  }
  ```
- Functions: `saveActiveDraft`, `loadActiveDraft`, `clearActiveDraft`
- Autosave draft tiap accepted point + tiap ~5s saat running + pada `visibilitychange` / `pagehide`
- Saat buka TrackingScreen: jika ada draft sport sama → tawarkan resume via `window.confirm` atau auto-resume; **exact:** auto-resume draft jika `updatedAt` < 6 jam, else clear.
- Saat Selesai & Simpan / buang sesi: `clearActiveDraft`

### E. PWA (Android + iPhone)

**Dependensi:** `vite-plugin-pwa` (workbox).

**File/config:**
1. `vite.config.ts` — tambah plugin `VitePWA({...})`:
   - `registerType: 'autoUpdate'`
   - `includeAssets`: favicon/icons
   - `manifest`:
     - `name`: `Aplikasi Bugar` (atau `Alora Bugar`)
     - `short_name`: `Bugar`
     - `display`: `standalone`
     - `orientation`: `portrait`
     - `theme_color`: `#D6EEF0`
     - `background_color`: `#D6EEF0`
     - `start_url`: `./`
     - icons 192 & 512 (generate PNG sederhana di `public/icons/` — solid color + text “B” jika belum ada aset brand)
2. `index.html`:
   - `meta name="viewport"` tambah `viewport-fit=cover`
   - `meta name="apple-mobile-web-app-capable" content="yes"`
   - `meta name="apple-mobile-web-app-status-bar-style" content="default"`
   - `link rel="apple-touch-icon"` → icon 192
3. `src/main.tsx` — virtual SW register dari `vite-plugin-pwa/client` (`registerSW`) jika plugin mengekspos; ikuti API plugin default.
4. **Wake Lock** di TrackingScreen saat `running === true`:
   - `navigator.wakeLock?.request('screen')` — best-effort; lepas saat pause/unmount; re-request pada `visibilitychange` visible.
   - Catatan: user tetap bisa kunci layar manual; Wake Lock membantu mencegah sleep otomatis saat app foreground.

5. UI kecil di TrackingScreen (opsional 1 baris): “Pasang ke Home Screen untuk tracking lebih stabil” jika `display-mode` bukan standalone — **include** teks singkat di bawah map.

**Batasan yang ditulis di Risks (bukan fitur):** iOS Safari tidak menjamin GPS kontinu saat layar kunci penuh; PWA best-effort.

### F. Map UI sync

- `TrackingMap`: props `userLocation` dari `lastFix` (bukan hanya track points).
- Polyline hanya dari `points` gerak valid.
- Tombol locate tetap ada.

### G. Out of scope
- Capacitor / native background location plugin
- Auto-pause saat diam
- Backend sync
- Ganti Check-in dummy (bukan bagian request ini)

### File touch list
| Path | Aksi |
|------|------|
| `src/lib/geo.ts` | Perketat filter gerak |
| `src/hooks/useGeolocationTrack.ts` | lastFix, isMoving, movingDurationSec, filter baru |
| `src/lib/calories.ts` | Pastikan pakai duration = moving; dokumentasi param |
| `src/lib/storage.ts` | Draft active session |
| `src/types/fitness.ts` | Type `ActiveDraft` |
| `src/components/TrackingScreen.tsx` | Wall-clock elapsed, draft, wake lock, kalori moving |
| `src/components/TrackingMap.tsx` | Marker dari lastFix |
| `vite.config.ts` | `vite-plugin-pwa` |
| `index.html` | Apple PWA meta + viewport-fit |
| `src/main.tsx` | register SW bila perlu |
| `public/icons/icon-192.png`, `icon-512.png` | Icon PWA |
| `package.json` / `pnpm-lock.yaml` | Tambah `vite-plugin-pwa` (+ sync lockfile) |

## Implementation Checklist
1. Tulis plan file `plans/real-tracking-pwa.md` (file ini).
2. Perketat `appendFilteredPoint` di `src/lib/geo.ts` sesuai spek A (accuracy 25, dist vs accuracy, min/max speed run & cycle).
3. Update `useGeolocationTrack`: baseline first point; distance hanya saat accepted; expose `lastFix`, `isMoving`, `movingDurationSec`; opsi watch `maximumAge: 0`.
4. Update `calcCalories` / pemakaiannya: `durationSec` = `movingDurationSec` dari hook.
5. Refactor `TrackingScreen` elapsed ke wall-clock + pause accumulator; hapus ketergantungan murni pada interval untuk kebenaran waktu.
6. Tambah type `ActiveDraft` + `save/load/clearActiveDraft` di storage.
7. Wiring autosave draft + restore draft di `TrackingScreen`; clear saat save/buang.
8. Install `vite-plugin-pwa`; konfigurasi di `vite.config.ts`; sync `pnpm-lock.yaml` via `pnpm install --lockfile-only` (dan npm lock jika dipakai).
9. Buat `public/icons/icon-192.png` dan `icon-512.png` (placeholder brand).
10. Update `index.html` (viewport-fit, apple meta, apple-touch-icon).
11. Register service worker dari entry (`main.tsx`) sesuai API `vite-plugin-pwa`.
12. Tambah Wake Lock request/release di `TrackingScreen` saat running.
13. Sync `TrackingMap` marker ke `lastFix`; polyline hanya points valid.
14. Tambah hint singkat install PWA jika bukan standalone.
15. Verifikasi manual: diam setelah Mulai → jarak & kalori tidak naik, waktu naik; jalan → jarak naik; jeda manual stop GPS; Selesai simpan ke riwayat; refresh mid-run restore draft; build PWA OK; update `pnpm-lock.yaml` jika dependency baru.

## Risks / Catatan
- **iOS:** GPS saat layar terkunci pada PWA sering terbatas; jangan janjikan paritas app native.
- **Android:** battery saver bisa tetap mematikan lokasi background.
- Filter terlalu ketat bisa menolak gerak pelan (jalan kaki sangat lambat) — minSpeed 2 km/h run adalah trade-off.
- Wake Lock tidak mencegah user mengunci layar manual.
- Setelah tambah `vite-plugin-pwa`, CI frozen-lockfile butuh `pnpm-lock.yaml` ter-update.
