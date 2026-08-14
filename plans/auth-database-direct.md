# Plan: Auth Database Langsung (Aplikasi Kebugaran Mobile)

## Context
- App kebugaran saat ini login via **backend-superapp** (`VITE_API_URL`, cookie session, field `identifier`).
- Requirement baru: **ganti ke pola cleanox-app** — backend **sendiri** di project app kebugaran yang **query MySQL Alora langsung** (`users` + `mst_employee`).
- **Tidak mengubah schema DB** — tidak migration, tidak tabel baru, tidak sentuh cleanox-app / backend-superapp.
- Login cukup **username + password**.
- Firebase (sesi olahraga + leaderboard) **tetap seperti sekarang**.

## Goal
1. Hapus ketergantungan auth ke backend-superapp.
2. Tambah Express API mini di app kebugaran yang baca DB Alora sama seperti cleanox (`aloraPool`).
3. FE login pakai JWT Bearer (bukan cookie Superapp).
4. Setelah login, identitas pegawai (`employee_id`, nama, kode) tersedia untuk tracking & leaderboard Firebase.

## Detailed Specifications

### Scope
- **Hanya** folder `Aplikasi Kebugaran Mobile/`
- **Out of scope:** perubahan `backend-superapp`, `cleanox-app`, struktur tabel MySQL

---

### A. Backend baru (mirror cleanox, disederhanakan)

#### Port & proxy
- API server: **`PORT_API=6001`** (hindari bentrok cleanox `:6000`)
- Vite dev: `:8443` dengan proxy `/api` → `http://localhost:6001`

#### File baru

**`server.js`**
- `express`, `cors`, `dotenv`, `express.json()`
- CORS: `origin: process.env.CORS_ORIGIN || 'http://localhost:8443'`, `credentials: false` (JWT, bukan cookie)
- Mount: `app.use('/api/auth', authRoutes)`
- Production: serve `dist/` static + fallback SPA (opsional, sama pola cleanox)
- Listen: `PORT_API || 6001`

**`api/shared/db/alora.js`**
- Copy pola `aloraPool` dari `cleanox-app/api/shared/db/cleanox.js` (hanya pool Alora):
  - Env: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
  - `mysql2/promise` pool, `timezone: '+07:00'`, `ssl: { rejectUnauthorized: false }`
- Export default `aloraPool`

**`api/auth/controllers/auth.controller.js`**
- `getEmployeeContext(employeeId)` — query sama cleanox:
  ```sql
  SELECT e.employee_id, e.full_name, e.employee_code, e.exit_date, e.is_deleted
  FROM mst_employee e WHERE e.employee_id = ?
  ```
- **`login(req, res)`**
  - Body: `{ username, password }` — keduanya wajib
  - Query: `SELECT id, name, email, username, password_hash FROM users WHERE username = ?`
  - `bcrypt.compare(password, password_hash)` — pakai `bcryptjs`
  - Ambil employee context by `user.id`
  - Reject 403 jika employee tidak ada / `is_deleted = 1` / `exit_date IS NOT NULL` (pegawai tidak aktif)
  - JWT sign payload: `{ id, email, name, username, employeeId, employeeName, employeeCode }`
  - Secret: `process.env.SESSION_SECRET`, expires: **`7d`**
  - Response:
    ```json
    { "token": "...", "user": { "id", "name", "email", "username", "employeeId", "employeeName", "employeeCode" } }
    ```
- **`getMe(req, res)`**
  - Pakai `req.user` dari middleware JWT
  - Re-fetch user + employee dari DB (validasi masih aktif)
  - Response: `{ "user": { ...same shape } }` (tanpa token)
- **`logout(req, res)`**
  - Stateless: `res.json({ message: 'Logout berhasil' })`

**`api/shared/middleware/auth.middleware.js`**
- Sama cleanox: verify `Authorization: Bearer <token>`, set `req.user`

**`api/auth/routes/auth.routes.js`**
- `POST /login` → login
- `GET /me` → authenticate → getMe
- `POST /logout` → authenticate → logout

Routes full path: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`

---

### B. Dependencies & scripts (`package.json`)

Tambah dependencies:
- `express`, `cors`, `dotenv`, `mysql2`, `bcryptjs`, `jsonwebtoken`

Tambah devDependencies:
- `concurrently`, `nodemon`

Update scripts:
```json
"dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
"dev:server": "nodemon server.js",
"dev:client": "vite --host 0.0.0.0",
"start": "node server.js"
```

---

### C. Environment

**`.env.example`** (update, hapus `VITE_API_URL` Superapp):

```env
# API server
PORT_API=6001
SESSION_SECRET=change-me
CORS_ORIGIN=http://localhost:8443

# MySQL Alora (sama credential cleanox-app aloraPool — copy dari .env cleanox/backend)
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASS=
DB_NAME=

# Firebase (tetap)
VITE_FIREBASE_API_KEY=
...
```

**`.env.local`** — user isi credential DB sendiri (jangan commit).

Hapus referensi `VITE_API_URL=http://localhost:3000` dari FE.

---

### D. Vite proxy (`vite.config.ts`)

Tambah di `server`:
```ts
proxy: {
  '/api': {
    target: 'http://localhost:6001',
    changeOrigin: true,
  },
},
```

---

### E. Perubahan Frontend

**`src/lib/api.ts`** — rewrite:
- `BASE_URL = '/api'` (relative, lewat proxy dev / same-origin prod)
- Hapus `credentials: 'include'`
- Tambah helper `authHeaders()`: baca token dari `getToken()`, set `Authorization: Bearer ...`
- `login(username, password)` → `POST /auth/login` body `{ username, password }`
- `fetchMe()` → `GET /auth/me` dengan Bearer
- `logout()` → `POST /auth/logout` dengan Bearer

**`src/lib/auth.ts`** — rewrite mapping:
- Key baru: `alora.fitness.token` + `alora.fitness.authUser`
- `setAuth(token, user)`, `getToken()`, `clearAuth()` (hapus token + user)
- Hapus `mapMeResponse` format Superapp (`user.employee.employee_id`)
- Tambah `mapAuthUser(data)` dari response login/me langsung (`employeeId`, `employeeName`, `employeeCode` flat)
- `AuthUser` type tetap sama

**`src/components/LoginScreen.tsx`**
- Ganti state `identifier` → `username`
- Label: **Username** (bukan email/username)
- Placeholder & validasi: "Username dan password wajib diisi"
- Submit: `login(username, password)` → `setAuth(data.token, mapAuthUser(data))` → `onSuccess`
- Hapus teks footer "API lokal backend-superapp"

**`src/App.tsx`**
- Bootstrap auth:
  - Jika `getToken()` ada → `fetchMe()` → update user cache
  - Jika tidak / gagal → `clearAuth()` → LoginScreen
- `handleLogout`: `logout()` API + `clearAuth()`
- Tidak ubah flow Firebase / leaderboard / tracking

---

### F. Yang TIDAK diubah
- Firebase config & `fitnessRemote.ts`
- `LeaderboardScreen`, tracking, localStorage sesi
- Schema DB Alora
- cleanox-app, backend-superapp (zero file changes)
- Tidak pakai `cleanoxPool` / `mst_role` (tidak perlu untuk app olahraga)

---

### G. Alur setelah implementasi

```
[LoginScreen]
  username + password
  → POST /api/auth/login (server.js :6001)
  → mysql: users + mst_employee
  ← JWT + user

[App bootstrap]
  Bearer token → GET /api/auth/me

[Tracking selesai]
  → localStorage + Firebase (tetap)

[Logout]
  clear token lokal (+ optional POST /api/auth/logout)
```

---

## Implementation Checklist

1. Tambah dependencies backend (`express`, `cors`, `dotenv`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `concurrently`, `nodemon`) di `package.json` + update scripts `dev` / `dev:server` / `dev:client` / `start`.
2. Buat `api/shared/db/alora.js` — pool MySQL Alora (env `DB_*`).
3. Buat `api/shared/middleware/auth.middleware.js` — JWT Bearer verify.
4. Buat `api/auth/controllers/auth.controller.js` — `login`, `getMe`, `logout` (username + password, query `users` + `mst_employee`).
5. Buat `api/auth/routes/auth.routes.js` — mount routes.
6. Buat `server.js` — Express + CORS + `/api/auth` + listen `:6001`.
7. Update `vite.config.ts` — proxy `/api` → `http://localhost:6001`.
8. Update `.env.example` — `PORT_API`, `SESSION_SECRET`, `DB_*`, Firebase; hapus `VITE_API_URL` Superapp.
9. Rewrite `src/lib/api.ts` — base `/api`, Bearer header, tanpa cookie.
10. Rewrite `src/lib/auth.ts` — token storage + `mapAuthUser` flat response.
11. Update `src/components/LoginScreen.tsx` — field username saja.
12. Update `src/App.tsx` — bootstrap token/me, logout clear token.
13. Jalankan `pnpm install` → update `pnpm-lock.yaml`.
14. Manual test: `pnpm dev` → login username/password pegawai aktif → Home → tracking → leaderboard → logout.

---

## Risks / Catatan

- Credential DB harus sama aksesnya dengan cleanox (`DB_HOST`, dll.) — copy dari env yang sudah jalan, **bukan** ubah DB.
- Dua app (cleanox `:6000`, kebugaran `:6001`) boleh jalan bersamaan.
- JWT 7 hari — user tidak perlu login ulang setiap buka app (beda session Superapp 2 jam).
- Production deploy: perlu jalankan `server.js` + build Vite; proxy dev tidak ada di prod — FE hit `/api` same origin.
- Firebase rules tetap manual di Console.

---

## Out of Scope

- Register user baru
- Perubahan tabel / migration
- Integrasi `mst_role` Cleanox
- Perubahan backend-superapp CORS atau auth
