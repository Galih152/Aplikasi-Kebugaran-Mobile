# Plan: Mobile Fullscreen Layout

## Context
- Aplikasi saat ini merender UI di dalam **phone frame mock** (fixed `375×812`, border radius 50, bezel, shadow) yang di-center di viewport.
- Ada **status bar palsu** (jam 9:41, notch, sinyal/baterai).
- `meta viewport` sudah ada, tetapi tidak terasa karena shell terkunci ke box fixed.
- User mengonfirmasi: layout harus menjadi **mobile fullscreen** — hilangkan frame/bezel, app isi layar, status bar palsu dihapus (pakai status OS).

## Goal
- UI mengisi penuh viewport perangkat (HP / DevTools mobile), tanpa mock device frame.
- Struktur navigasi (tab + tracking overlay) tetap sama; hanya shell layout yang berubah.
- Di layar lebar (desktop), konten tetap “mobile column” (lebar maksimal ~430px, center opsional) agar tidak meregang jelek, tanpa bezel dekoratif.

## Detailed Specifications

### File yang diubah
1. `src/App.tsx` — komponen `App` (default export), bagian return shell (~baris 788–855)
2. `src/index.css` — aturan `body` (dan opsional `#root` / `html`)

### File yang tidak diubah
- `HomeScreen`, `ActivityScreen`, `TrackingScreen`, `StatsScreen`, `ProfileScreen` — tidak diubah kecuali padding/spacing shell memengaruhi; konten layar sudah `width: 100%` relatif parent
- `index.html` — `meta viewport` sudah cukup; tidak perlu diubah
- Token warna `C`, state `tab` / `sport` / `tracking`, bottom nav logic — tidak diubah

### Perubahan exact di `src/App.tsx` (`App` return)

**Sebelum (konsep):**
- Outer: center + padding 20px 12px + minHeight 100vh
- Inner: width 375, height 812, borderRadius 50, border 10px, boxShadow besar
- Status bar palsu (blok penuh)
- Content scroll + bottom nav di dalam frame

**Sesudah (konsep):**
1. **Outer shell** diganti menjadi container fullscreen:
   - `width: '100%'`
   - `maxWidth: 430` (mobile column di desktop; tidak ada bezel)
   - `height: '100dvh'` (fallback visual: `minHeight: '100vh'` jika perlu digabung via style)
   - `margin: '0 auto'` (center horizontal di desktop)
   - `display: 'flex'`, `flexDirection: 'column'`
   - `overflow: 'hidden'`
   - `background: C.bg`
   - **Hapus:** padding luar 20px 12px yang membuat “kartu di tengah”, alignItems/justifyContent center pada wrapper luar (kecuali center via margin auto pada column)
   - **Hapus:** border, borderRadius frame, boxShadow bezel, fixed height 812, fixed width 375

2. **Status bar palsu dihapus sepenuhnya** (blok jam 9:41 + notch + sinyal/baterai).

3. **Safe area (notch/home indicator) via padding:**
   - Scrollable content: tetap `flex: 1`, `overflowY: 'auto'`, `padding: '8px 18px'`, tambah `paddingTop` yang mempertimbangkan safe area: gunakan `paddingTop: 'max(8px, env(safe-area-inset-top))'` — karena inline style tidak mendukung `max()` dengan baik di semua kasus, prefer set di CSS class atau gunakan style string via CSS di `index.css` untuk class shell.
   - **Pendekatan yang dipilih (eksplisit):** tambah class CSS di `index.css` untuk shell, content, dan bottom nav agar `env(safe-area-inset-*)` bisa dipakai dengan benar; di JSX pasang `className` pada tiga elemen shell. Inline style tetap boleh untuk warna/layout non-safe-area.

4. **Bottom nav:**
   - Tetap `flexShrink: 0`, layout flex 4 tab sama
   - Padding bawah diganti agar respect home indicator: `paddingBottom: max(12px, env(safe-area-inset-bottom))` via CSS class
   - Padding atas/samping tetap mirip: `8px 12px` + safe bottom
   - Saat `tracking === true`, bottom nav tetap disembunyikan (logic existing)

5. **Tidak mengubah** mapping tab, label, icon, accentColor, atau conditional rendering screen.

### Perubahan exact di `src/index.css`

1. **`html, body, #root`:**
   - `height: 100%` / `min-height: 100%`
   - `margin: 0` pada body (sudah ada)
   - Hapus dari `body`: `display: flex`, `align-items: center`, `justify-content: center` (centering pindah ke column `maxWidth` di App)

2. **Tambah class (nama exact):**
   - `.app-shell` — fullscreen column: `width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; overflow: hidden; background: #D6EEF0;`
   - `.app-content` — `flex: 1; overflow-y: auto; padding: 8px 18px; padding-top: max(8px, env(safe-area-inset-top)); background: #D6EEF0;`
   - `.app-bottom-nav` — `flex-shrink: 0; padding: 8px 12px; padding-bottom: max(12px, env(safe-area-inset-bottom)); background: #FFFFFF; border-top: 1px solid #EEF0F5; box-shadow: 0 -4px 20px rgba(0,0,0,0.05); display: flex; gap: 4px;`

3. **Pertahankan:** font imports, `* { box-sizing }`, scrollbar hide, `body` font-family & background.

4. **Viewport height fallback (opsional di CSS):**
   ```css
   @supports not (height: 100dvh) {
     .app-shell { height: 100vh; }
   }
   ```

### Props / types
- Tidak ada type/prop baru.
- Tidak ada komponen baru; hanya className pada elemen shell existing.

### Out of scope
- Refactor screen components
- PWA manifest / Capacitor / React Native
- Mengganti inline style di dalam screen menjadi Tailwind
- Mengubah mock data atau fitur tracking

## Implementation Checklist
1. Buat/isi file plan ini (`plans/mobile-fullscreen-layout.md`) — sudah.
2. Di `src/index.css`: hapus `display: flex`, `align-items: center`, `justify-content: center` dari `body`.
3. Di `src/index.css`: pastikan `html, body, #root` punya tinggi penuh (`height: 100%` / `min-height: 100%` sesuai kebutuhan agar shell `100dvh` tidak collapse).
4. Di `src/index.css`: tambah class `.app-shell` dengan spek di atas + fallback `@supports not (height: 100dvh)`.
5. Di `src/index.css`: tambah class `.app-content` dengan padding + `safe-area-inset-top`.
6. Di `src/index.css`: tambah class `.app-bottom-nav` dengan padding + `safe-area-inset-bottom`, background putih, border-top, shadow, flex.
7. Di `src/App.tsx`: ganti outer wrapper + phone frame menjadi **satu** elemen dengan `className="app-shell"` (hapus width 375, height 812, border, radius, shadow, padding luar center).
8. Di `src/App.tsx`: **hapus seluruh blok Status Bar** palsu (jam, notch, ikon).
9. Di `src/App.tsx`: pasang `className="app-content"` pada div scrollable; hapus inline style yang digantikan class (padding/overflow/flex/background); pertahankan children (tracking / tabs) apa adanya.
10. Di `src/App.tsx`: pasang `className="app-bottom-nav"` pada div bottom nav; pindahkan style layout ke class; pertahankan map tombol tab + conditional `!tracking` + inline style per-tombol (active/accent) seperti sekarang.
11. Verifikasi manual: di browser DevTools device mode, UI mengisi tinggi layar tanpa bezel; bottom nav tidak tertutup home indicator; di desktop lebar, column max 430px center; navigasi tab & tracking masih berfungsi.

## Risks / Catatan
- `100dvh` vs address bar mobile browser: `dvh` mengurangi jump; fallback `100vh` untuk browser lama.
- Safe-area hanya relevan di device dengan notch; di desktop `env()` = 0, aman.
- `maxWidth: 430` adalah keputusan layout desktop-preview; bukan phone frame. Jika nanti ingin full-bleed di tablet, perlu keputusan terpisah.
- Jangan biarkan double padding (inline + class) pada content/nav — hapus inline yang redundant saat pindah ke class.
