# Plan: Deploy Full-Stack di Vercel (Auth + Firebase)

## Context
- App kebugaran: Vite FE + Express auth (`server.js`) query MySQL Alora + Firebase RTDB.
- Deploy Vercel saat ini **hanya static** → `POST /api/auth/login` → **404** (tidak ada serverless function).
- User ingin **satu deploy Vercel** yang jalan sempurna (login + app), tanpa host API terpisah.

## Goal
1. `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` jalan di domain Vercel yang sama.
2. FE tetap pakai `/api` (same-origin) — tidak wajib `VITE_API_URL` di production.
3. Dev lokal tetap: `pnpm dev` (Vite `:8443` + API `:6001` via proxy).
4. Tidak ubah schema DB; tidak ubah cleanox-app / backend-superapp.

## Arsitektur Target

```
Vercel (satu project)
├── Static: dist/          → https://xxx.vercel.app/*
└── Serverless: api/index.js → /api/*  (Express auth + MySQL)

Dev lokal
├── Vite :8443  proxy /api → :6001
└── server.js :6001 (Express sama)
```

---

## Detailed Specifications

### A. Restruktur backend (hindari konflik folder `api/` Vercel)

Pindahkan kode backend dari `api/` → `server/`:

| Lama | Baru |
|---|---|
| `api/shared/db/alora.js` | `server/db/alora.js` |
| `api/shared/middleware/auth.middleware.js` | `server/middleware/auth.middleware.js` |
| `api/auth/controllers/auth.controller.js` | `server/auth/auth.controller.js` |
| `api/auth/routes/auth.routes.js` | `server/auth/auth.routes.js` |

Hapus folder `api/shared`, `api/auth` setelah pindah.

**`server/app.js`** (baru) — factory Express, **tanpa** `app.listen()`:
```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/auth.routes.js';

dotenv.config();

export function createApp() {
  const app = express();

  const allowedOrigins = [
    process.env.CORS_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:8443',
  ].filter(Boolean);

  app.use(cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, allowedOrigins[0] ?? true);
    },
    credentials: false,
  }));

  app.use(express.json());
  app.use('/api/auth', authRoutes);

  return app;
}
```

**`server.js`** (update) — dev lokal saja:
```js
import { createApp } from './server/app.js';
const app = createApp();
app.listen(PORT_API || 6001, ...);
```

**`api/index.js`** (baru) — entry Vercel Serverless:
```js
import { createApp } from '../server/app.js';
const app = createApp();
export default app;
```

Vercel `@vercel/node` menjalankan Express sebagai serverless handler.

---

### B. `vercel.json` (baru, root project)

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- `/api/*` → serverless `api/index.js`
- SPA fallback untuk React Router paths (PWA)

---

### C. Frontend `src/lib/api.ts`

- Default production: `BASE_URL = '/api'` (same-origin Vercel)
- Opsional override dev/staging: `VITE_API_URL` (tetap didukung)
```ts
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const BASE_URL = API_BASE ? `${API_BASE}/api` : '/api'
```
- **Jangan set** `VITE_API_URL` di Vercel production (biar same-origin).

---

### D. Environment Variables di Vercel

Set di **Settings → Environment Variables** (Production + Preview):

| Key | Wajib | Keterangan |
|---|---|---|
| `DB_HOST` | Ya | Host MySQL Alora |
| `DB_PORT` | Ya | `3306` |
| `DB_USER` | Ya | |
| `DB_PASS` | Ya | |
| `DB_NAME` | Ya | `waschen` |
| `SESSION_SECRET` | Ya | JWT secret |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Opsional | `0` jika SSL MySQL bermasalah (sama backend) |
| `VITE_FIREBASE_*` | Ya | Semua key Firebase (build-time) |

**Tidak wajib di Vercel production:**
- `CORS_ORIGIN` — same-origin; `VERCEL_URL` auto-set oleh Vercel
- `VITE_API_URL` — kosongkan agar pakai `/api`
- `PORT_API` — Vercel set sendiri

Setelah save → **Redeploy**.

---

### E. MySQL firewall (infra, di luar kode)

Serverless Vercel connect ke MySQL dari IP dinamis. Pastikan:
- MySQL host **menerima koneksi eksternal**, atau
- Whitelist / allow `0.0.0.0/0` (dev) atau gunakan connection pooler, atau
- Host DB sudah public seperti `103.197.189.185` (sama env lokal)

Jika login return 500 "server error" setelah 404 fixed → cek koneksi DB dari Vercel logs.

---

### F. `package.json`

Tidak ubah script build. Pastikan dependencies backend ada di `dependencies` (sudah).

Opsional tambah script:
```json
"vercel-build": "vite build"
```
(Vercel default pakai `build` — OK)

---

### G. Perbaikan error message FE (opsional kecil)

Di `src/lib/api.ts`, jika `!res.ok` dan body bukan JSON, tampilkan pesan lebih jelas:
- 404 → "API tidak ditemukan — redeploy Vercel"
- 500 → message dari server

---

## Alur verifikasi

```
1. Deploy Vercel dengan env DB + SESSION_SECRET + VITE_FIREBASE_*
2. Buka https://aplikasi-kebugaran-mobile-test.vercel.app
3. Login username/password
4. Network tab: POST /api/auth/login → 200 + { token, user }
5. Tracking → Firebase sync
6. Tab Rank → leaderboard load
```

---

## Implementation Checklist

1. Pindahkan `api/shared/db/alora.js` → `server/db/alora.js` (update import paths).
2. Pindahkan `api/shared/middleware/auth.middleware.js` → `server/middleware/auth.middleware.js`.
3. Pindahkan `api/auth/controllers/auth.controller.js` → `server/auth/auth.controller.js` (fix import pool path).
4. Pindahkan `api/auth/routes/auth.routes.js` → `server/auth/auth.routes.js` (fix imports).
5. Buat `server/app.js` dengan `createApp()` + CORS dinamis (VERCEL_URL + localhost).
6. Update `server.js` — import `createApp()`, hanya `listen()` untuk dev lokal.
7. Buat `api/index.js` — `export default createApp()`.
8. Hapus folder lama `api/shared`, `api/auth` (setelah pindah).
9. Buat `vercel.json` — build + rewrites API + SPA fallback.
10. Pastikan `src/lib/api.ts` default `BASE_URL = '/api'` (VITE_API_URL opsional).
11. Update `.env.example` — dokumentasi env Vercel vs lokal.
12. `pnpm install` + update lockfile jika perlu.
13. Test lokal: `pnpm dev` → login masih jalan.
14. Test Vercel: push → redeploy → login 200 (bukan 404).

---

## Risks / Catatan

- **Cold start** serverless: login pertama bisa lambat 1–3 detik.
- **MySQL connection limit**: pool `connectionLimit: 10` di serverless — cukup untuk auth ringan; monitor jika traffic tinggi.
- **Vercel Hobby timeout**: function max 10s (Hobby) — auth query cukup.
- Folder `api/index.js` + `server/` terpisah agar Vercel tidak deploy file controller sebagai endpoint terpisah.
- Preview deployments: set env DB di **Preview** juga jika mau test branch.

---

## Out of Scope

- Migrate Firebase ke Vercel KV
- Register user baru
- Custom domain setup
- Host API terpisah (tidak perlu jika plan ini dieksekusi)
