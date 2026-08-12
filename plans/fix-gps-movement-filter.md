# Plan: Fix GPS Movement Acceptance (Cycle & Run)

## Context
- GPS/map marker bergerak (`lastFix` update), tapi jarak/tracking tidak naik — terutama setelah bersepeda.
- Filter di `evaluateMovement` terlalu ketat + bug: titik ditolak tidak menggeser baseline, sehingga `dtSec` membengkak dan `speedKmh` jatuh di bawah `minSpeed` → gerak nyata terus ditolak.
- Mode sepeda memakai `minSpeed: 4` (lebih ketat dari lari `2`).

## Goal
- Saat user benar-benar jalan/sepeda, jarak, polyline, dan status “Bergerak” naik sesuai GPS.
- Saat diam, jarak tetap tidak “jalan sendiri” (hindari drift), tanpa auto-pause.
- Perbaiki bug baseline `lastAccepted` agar penolakan sementara tidak merusak perhitungan speed.

## Detailed Specifications

### File diubah
1. `src/lib/geo.ts` — `evaluateMovement` + `speedLimits`
2. `src/hooks/useGeolocationTrack.ts` — baseline accuracy, update lastAccepted saat reject tertentu
3. (Opsional UI) `src/components/TrackingScreen.tsx` — tidak wajib kecuali label; biarkan status Diam/Bergerak

### A. Longgarkan gate di `evaluateMovement` (`src/lib/geo.ts`)

Ganti threshold exact:

| Gate | Sekarang | Baru |
|------|----------|------|
| Accuracy reject | `> 25` atau undefined | `> 50` atau undefined |
| minDist | `max(10, accuracy * 0.5)` | `max(5, accuracy * 0.35)` |
| Run min/max speed | 2 / 25 | **1.2** / 25 |
| Cycle min/max speed | 4 / 80 | **2.5** / 80 |

Return type tetap:
```ts
{ accepted: boolean; addedKm: number; dtSec: number }
```

Tambah return field (exact):
```ts
{ accepted: boolean; addedKm: number; dtSec: number; reason?: 'accuracy' | 'distance' | 'speed' | 'ok' }
```
(untuk debug internal; UI tidak wajib menampilkan).

**Aturan speed dengan dtSec:**
- Jika `dtSec > 15`, **jangan** pakai minSpeed ketat terhadap seluruh gap itu. Exact:
  - Hitung `speedKmh` seperti sekarang.
  - Jika gagal minSpeed **dan** `dtSec > 15` **dan** `distM >= max(8, accuracy * 0.4)`, tetap **accept** sebagai gerak (anggap user bergerak di antara fix jarang) — ini menutup bug “diam filter → speed terlalu rendah”.
  - Tetap tolak jika `speedKmh > maxSpeed` (teleport/noise ekstrem).

### B. Hook: baseline & lastAccepted (`useGeolocationTrack.ts`)

1. **Baseline first point:** izinkan set `lastAccepted` jika `accuracy <= 50` (selaras gate baru), bukan 25.
2. **Saat gerak ditolak karena distance terlalu kecil** (`reason === 'distance'`): **jangan** ubah `lastAccepted` (tetap diam/noise kecil).
3. **Saat ditolak karena speed terlalu rendah dengan dtSec pendek** (`reason === 'speed'` dan dtSec ≤ 15): jangan geser `lastAccepted`.
4. **Saat ditolak karena accuracy buruk:** jangan geser `lastAccepted`.
5. **Saat accepted:** update `lastAccepted`, tambah point, `distanceKm`, `movingDurationSec` seperti sekarang.
6. **Tambahan exact untuk mencegah stuck:** jika `distM` dari `lastAccepted` ke `next` sudah `>= 25` meter **dan** accuracy ≤ 50 **dan** speed ≤ maxSpeed, treat sebagai accepted meski minSpeed gagal (mirror rule A untuk gap besar) — boleh hanya di `evaluateMovement` agar satu tempat.

Tidak perlu mengubah signature return hook (`lastFix`, `isMoving`, dll. tetap).

### C. Tidak diubah
- Tidak mengembalikan rumus jarak fake dari timer.
- Tidak auto-pause.
- PWA / Wake Lock / draft storage tetap.
- Kalori tetap dari `movingDurationSec`.

### D. Verifikasi
- Mode **Sepeda**: Mulai → bersepeda pelan–sedang → jarak naik dalam ~10–30 detik, status “Bergerak”.
- Mode **Lari/jalan**: sama.
- Diam di tempat 30 detik: jarak tidak naik signifikan (naik ≤ noise yang lolos; target ideal 0 atau &lt; 0.02 km).
- Marker tetap mengikuti GPS.

## Implementation Checklist
1. Tulis plan `plans/fix-gps-movement-filter.md` (file ini).
2. Update `speedLimits` di `src/lib/geo.ts`: run min 1.2, cycle min 2.5; max tetap.
3. Update accuracy reject di `evaluateMovement` dari 25 → 50.
4. Update `minDist` menjadi `max(5, accuracy * 0.35)`.
5. Tambah rule: jika `dtSec > 15` dan `distM >= max(8, accuracy * 0.4)` dan speed ≤ maxSpeed → accept meski di bawah minSpeed; set `reason: 'ok'`.
6. Tambah field `reason` pada return `evaluateMovement`.
7. Di `useGeolocationTrack`: baseline first point pakai `accuracy <= 50`.
8. Pastikan hanya path `accepted && addedKm > 0` yang menambah jarak; `isMoving` true hanya saat itu.
9. Sesuaikan `appendFilteredPoint` (jika masih dipakai) agar memanggil logic baru tanpa merusak perilaku.
10. Verifikasi manual singkat: sepeda + diam; pastikan `npm run build` / tsc lolos.

## Risks / Catatan
- Longgarkan filter sedikit meningkatkan risiko drift vs sebelumnya; rule minDist + maxSpeed tetap membatasi.
- Accuracy 50 m masih umum di urban; lebih realistis daripada 25 m.
- Jika GPS update sangat jarang (&gt;15s) saat layar kunci, rule dtSec&gt;15 sengaja mengizinkan jarak agar tracking tidak “mati”.
