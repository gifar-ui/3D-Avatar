---
name: GIFAR — 3D Avatar Portfolio
source: refs/ui-design-refrence.png (scan 2026-10-16)
stage: web/public/images/background-avatar.png
colors:
  bg: "#F2F4F9"
  bg-deep: "#E9EDF7"
  surface-solid: "#F7F8FC"
  ink-900: "#19283C"
  ink-800: "#0C2B6B"
  ink-700: "#223C6F"
  ink-600: "#586A8A"
  ink-500: "#5F6E8C"
  ink-300: "#899DBD"
  accent-600: "#3D52D9"
  accent-500: "#4E61E8"
  icon-blue: "#2152EA"
  violet-500: "#696FF9"
  violet-600: "#5859F5"
  accent-50: "#EDF1FE"
  accent-100: "#E9EDFC"
  accent-200: "#D6DDFD"
  line-subtle: "#DEE2EC"
typography:
  display-family: "Mochiy Pop One"
  family: "M PLUS Rounded 1c"
  display: { size: 52px, lineHeight: 1.14, weight: 400, family: display }
  h1: { size: 38px, lineHeight: 1.18, weight: 400, family: display }
  h2: { size: 22px, lineHeight: 1.25, weight: 700 }
  title: { size: 15px, lineHeight: 1.3, weight: 600 }
  body: { size: 15px, lineHeight: 1.65, weight: 400 }
  ui: { size: 14px, lineHeight: 1.2, weight: 500 }
  caption: { size: 12px, lineHeight: 1.45, weight: 500 }
  overline: { size: 11px, lineHeight: 1.2, weight: 700, tracking: 0.16em, case: upper }
rounded: { xs: 8px, sm: 10px, md: 12px, lg: 16px, xl: 20px, pill: 999px }
spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
motion:
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
  camera-ease: easeInOutCubic
  fast: 150ms
  base: 240ms
  slow: 450ms
  camera-in: 1600ms
  camera-out: 1300ms
---

# GIFAR — Design Foundation

Dokumen ini adalah **pondasi desain** untuk UI web avatar 3D. Isinya diturunkan dari hasil scan
`refs/ui-design-refrence.png`. Semua nilai bersifat **implementable**: setiap aturan menunjuk ke
token, angka, atau contoh.

- **Sumber visual:** `refs/ui-design-refrence.png` (mockup 2 state + catatan alur)
- **Aset panggung:** `web/public/images/background-avatar.png` (1536×1024, podium di tengah)
- **Skill yang dipakai saat menyusun dokumen:**
  - `glassmorphism` (bergside): struktur dokumen dan *quality gate*
  - `frontend-design` (Anthropic): perencanaan token dan pengendalian diri
  - `web-design-guidelines` (Vercel): dipakai untuk audit saat kode UI dibuat
- **Cara membaca angka:** ukuran dari mockup dikonversi ke kanvas desktop **1440 px** (faktor ×1,51
  dari frame mockup 953 px), lalu dibulatkan ke grid 4 px. Tanda ≈ berarti nilai hasil ukur.

---

## 1. Konteks & tujuan

**Intent (1 kalimat):** portofolio developer yang dibuka oleh karakter 3D. Pengunjung memilih satu
topik, lalu kamera mendekat dan karakter menjelaskannya dengan suara.

| | |
|---|---|
| Subjek | Gifar, Frontend Developer & Creative Technologist |
| Audiens | recruiter, klien, sesama developer |
| Tugas utama halaman | memperkenalkan diri dalam ≤ 1 menit per topik, dengan karakter sebagai pemandu |
| Momen paling khas | transisi sinematik full body → half body, lalu karakter bicara |

**Dua state utama** (dari anotasi di referensi):

| State | Isi | Pemicu |
|---|---|---|
| **01 Initial** — Full body + interactive cards | karakter penuh di atas podium, intro di kiri, 4 kartu topik melayang | load halaman, **Back**, nav *Home* |
| **02 Detail** — Half body + voice explanation | karakter setengah badan bergestur, menu topik di kiri, konten di kanan, audio player + transkrip | klik kartu / item nav / item menu topik |

**Topik** (dipakai bersama oleh kartu, nav, dan menu samping):

| id | Kartu (judul / subjudul) | Item nav | Ikon |
|---|---|---|---|
| `about` | Who am I? / Get to know me better | About | user |
| `skills` | Skills & Tools / My tech stack & tools | Skills | code `</>` |
| `projects` | Selected Projects / Things I've built | Projects | briefcase |
| `journey` | My Journey / Education & experience | Journey | map |

> Nav dan kartu adalah **pintu yang sama** ke topik yang sama. *Home* = kembali ke state 01.

---

## 2. Hasil scan referensi

### 2.1 State 01 — Initial (desktop 1440)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ GIFΛR            Home  About  Skills  Projects  Journey      (🔈) (Hi, I'm Gifar ●) │  nav ≈72px
│                  ‾‾‾‾                                                         │
│                              ┌──────────────┐   ☺        ┌───────────────┐    │
│  Hello,                      │ (👤)          │  /█\       │ (</>)          │    │
│  I'm Gifar  ← accent         │ Who am I?    │   █        │ Skills & Tools │    │
│  Frontend Developer · Creative│ Get to know →│   █        │ My tech stack →│    │
│                              └──────────────┘  / \       └───────────────┘    │
│  I build digital experiences   ┌──────────────┐  | |   ┌───────────────┐      │
│  that are simple, useful…      │ (💼)          │  | |   │ (🗺)           │      │
│                                │ Selected Proj│  | |   │ My Journey     │      │
│  ~Gifar~ (signature)           │ Things I've →│ (podium)│ Education &   →│      │
│                                └──────────────┘ ◯═══◯  └───────────────┘      │
│ (🖱) Scroll to explore                              Let's connect | in  gh  ✉  │
└──────────────────────────────────────────────────────────────────────────────┘
  kolom intro ≈ 48px dari kiri, lebar maks 360px · karakter ≈ 52% lebar · kartu mengapit karakter
```

Pengukuran (≈, kanvas 1440):

| Elemen | Ukuran / posisi |
|---|---|
| Padding horizontal halaman | 48px |
| Nav link: jarak antar teks | 32px; indikator aktif = garis 2px × ≈32px, 8px di bawah teks |
| Tombol suara | lingkaran 40px |
| Pill "Hi, I'm Gifar" | ≈168×44, radius pill, dot status 8px di kanan |
| Headline intro | 2 baris, top ≈180px dari atas viewport |
| Kartu topik | ≈256–280 × 128–140, padding 20px, ikon dalam chip bulat 40px |
| Susunan kartu | 2 kiri + 2 kanan dari karakter, **bertingkat** (kartu bawah bergeser ±16–40px) |
| Karakter | pusat ≈52% lebar; kaki ≈92% tinggi area; kepala ≈13% |
| Podium | ellipse ≈446px di bawah kaki (dari background) |
| Footer | *Scroll to explore* di kiri-bawah; *Let's connect* + 3 ikon 40px (gap 24px) di kanan-bawah |

### 2.2 State 02 — Detail (desktop 1440)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ GIFΛR            Home  About  Skills  Projects  Journey      (🔈) (Hi, I'm Gifar ●) │
│                                      ‾‾‾‾‾‾                                    │
│ (← Back)              ▄▄▄▄                 SKILLS & TOOLS        ┌────────────┐│
│                      █ ◕◕ █                What do I use?        │[</>] Skills ││
│  👤 Who am I?         ▀▄▄▀                 I work with modern…   │ My tech…    ││
│ ▌</> Skills & Tools ← aktif               ┌ Frontend ─────────┐  │────────────││
│  💼 Selected Projects /█████\             │[React][TS][TW][Vite]│ │ transcript ││
│  🗺 My Journey       ✋ ███  │             ├ Backend & Database ┤ │ …          ││
│                        ███  │             │[Node][Express][PG][MySQL]│ │ …   ││
│                        ███                ├ Tools & Others ────┤ │ 00:08/0:42 ││
│ ┌(▶)▁▃▅▇▅▃▁▁▁▁  0:08/0:42 🔈┐            │[Git][Docker][VS Code][Figma]│[← Back to topics]│
│ └──────────────────────────┘             └────────────────────┘  └────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
  menu ≈48px dari kiri · karakter ≈34% lebar · kolom konten ≈372px · panel transkrip ≈265px
```

| Elemen | Ukuran / posisi |
|---|---|
| Tombol Back | ≈100×40, radius 12, top ≈110px |
| Menu topik | item tinggi 46px, jarak antar item 8px, lebar 204px; aktif = bg `accent-50` + bar kiri 3px `accent-600` |
| Karakter | half body, pusat ≈34% lebar (sesuai `camera.js` saat ini) |
| Kolom konten | lebar ≈372px: overline → H1 → lead → 3 grup chip |
| Grup chip | ≈392×92 kartu glass, radius 12; chip ≈90×42, radius 10, ikon 18px + label 12px |
| Panel transkrip | ≈265×510, radius 20: header (tile ikon 40px gradient) → divider → teks → waktu + mini waveform → tombol *Back to topics* full width 44px |
| Audio player | ≈405×60, radius 16, kiri-bawah; tombol play bulat 40px gradient violet; waveform; waktu; volume |

### 2.3 Catatan alur di referensi ("Card Interaction")

1. Full body view → 2. klik kartu → 3. close up + voice. Penutup: *"Same character. Same style.
Different perspective."* Artinya kedua state harus terasa **satu dunia**: palet, kaca, dan karakter
sama, yang berubah hanya jarak kamera.

---

## 3. Design tokens

> **Aturan:** komponen **wajib** memakai token semantik (`--color-text-muted`), bukan nilai mentah
> (`#5F6E8C`). Token didefinisikan sekali di `:root` pada `web/src/style.css`.

### 3.1 Warna

Nilai di bawah adalah hasil sampling piksel dari referensi. Kolom *Kontras* adalah rasio WCAG
terhadap `bg` `#F2F4F9`.

| Token | Hex | Sampel dari | Kontras | Peran |
|---|---|---|---|---|
| `--color-bg` | `#F2F4F9` | latar frame | — | latar halaman |
| `--color-bg-deep` | `#E9EDF7` | sudut lavender | — | gradien/vignette latar |
| `--color-surface-solid` | `#F7F8FC` | isi kartu | — | fallback kaca tanpa blur |
| `--color-text-display` (`ink-900`) | `#19283C` | "Hello," | 13.5 | headline intro |
| `--color-text-heading` (`ink-800`) | `#0C2B6B` | "What do" | 12.1 | heading detail |
| `--color-text-title` (`ink-700`) | `#223C6F` | judul kartu | 9.8 | judul kartu, panel, menu |
| `--color-text-secondary` (`ink-600`) | `#586A8A` | role line | 5.0 ✅ | teks sekunder |
| `--color-text-muted` (`ink-500`) | `#5F6E8C` | **disesuaikan** | 4.7 ✅ | paragraf, subjudul kartu, nav tidak aktif |
| `--color-decor` (`ink-300`) | `#899DBD` | subjudul kartu | 2.5 ❌ | **hanya dekoratif** (placeholder, disabled, garis) |
| `--color-accent-text` (`accent-600`) | `#3D52D9` | **disesuaikan** | 5.6 ✅ | overline, link, fokus, bar menu aktif |
| `--color-accent` (`accent-500`) | `#4E61E8` | "Gifar" | 4.5 ✅ | kata aksen di headline, underline nav aktif |
| `--color-icon` | `#2152EA` | stroke ikon | 4.9 | ikon dalam chip |
| `--color-media` (`violet-500`) | `#696FF9` | tombol play | 3.6 (UI ≥3 ✅) | kontrol audio |
| `--color-media-strong` (`violet-600`) | `#5859F5` | waveform aktif | — | bar waveform yang sudah diputar |
| `--color-accent-50` | `#EDF1FE` | menu aktif | — | latar item aktif |
| `--color-accent-100` | `#E9EDFC` | chip ikon | — | latar chip ikon |
| `--color-accent-200` | `#D6DDFD` | chip nomor | — | waveform belum diputar, hover halus |
| `--color-line` | `#DEE2EC` | ring podium | — | divider, hairline |

**Penyesuaian aksesibilitas** (konflik estetika vs aksesibilitas → aksesibilitas menang):
- Teks kecil di referensi memakai `#78839D` (3.45), `#899DBD` (2.50), dan `#8598B5` (2.67). Semuanya
  **gagal AA 4.5:1**. Diganti dengan `ink-500 #5F6E8C` (4.66). Hierarki dijaga lewat **ukuran dan
  bobot**, bukan dengan memudarkan warna.
- Overline "SKILLS & TOOLS" di referensi berwarna `#4F6CF4` (3.99) pada 11px, juga gagal. Diganti
  dengan `accent-600 #3D52D9` (5.6).

**Gradien** (hanya untuk elemen media dan ikon brand, bukan dekorasi latar):
- `--gradient-media: linear-gradient(135deg, #7380F4 0%, #5859F5 100%)`: tombol play, tile ikon panel.

### 3.2 Tipografi

**Typeface** (diubah 2026-10-16 atas permintaan: nuansa anime Jepang). Keduanya dari Google Fonts:

| Peran | Font | Alasan |
|---|---|---|
| Display: headline, H1, wordmark | **Mochiy Pop One** (satu bobot, 400) | huruf pop tebal yang membulat, khas judul anime dan game Jepang |
| Teks & UI | **M PLUS Rounded 1c** (400 · 500 · 700 · 800) | gothic bulat khas UI aplikasi/game Jepang, nyaman untuk paragraf |

- Keduanya punya glyph Jepang (hiragana/katakana), sehingga aksen seperti ギファル tetap konsisten.
- **Mochiy hanya punya satu bobot.** Elemen display **wajib** `font-weight: 400`, karena bobot lain
  membuat browser menebalkan huruf secara sintetis. `letter-spacing: 0`.
- M PLUS Rounded tidak punya bobot 600; role yang tertulis 600 dirender 700.
- Mochiy lebih lebar ±5% dari font sebelumnya. Ukuran display diturunkan (56 → 52px) agar "I'm Gifar"
  (≈251px) tidak menabrak kartu "Who am I?".
- Alternatif yang dibandingkan di kanvas: **B** Dela Gothic One + M PLUS Rounded 1c (gaya *title
  card*), **C** Zen Maru Gothic saja (lebih lembut).
- `font-variant-numeric: tabular-nums` **wajib** untuk waktu audio (`0:08 / 0:42`).

| Role | Desktop | Mobile (<768) | Weight | Line-height | Pakai di |
|---|---|---|---|---|---|
| `display` (Mochiy) | 52px | 32px | 400 | 1.14 | "Hello, I'm Gifar" |
| `h1` (Mochiy) | 38px | 26px | 400 | 1.18 | "What do I use?" |
| `h2` | 22px | 20px | 700 | 1.25 | judul grup besar (opsional) |
| `title` | 15px | 15px | 700 | 1.3 | judul kartu, judul panel |
| `body` | 15px | 15px | 400 | 1.65 | paragraf, lead, transkrip (14px) |
| `ui` | 14px | 14px | 500 | 1.2 | nav, tombol, menu |
| `caption` | 12px | 12px | 500 | 1.45 | subjudul kartu, label chip, waktu |
| `overline` | 11px | 11px | 700 | 1.2, tracking 0.16em, UPPERCASE | label seksi detail ("SKILLS & TOOLS") |

- Panjang baris paragraf **maks 60ch** (intro ≈ 34ch, lead detail ≈ 48ch).
- **Wordmark "GIFΛR":** Mochiy Pop One, kapital, tracking ≈0.12em. Huruf A tanpa palang (Λ) dibuat
  sebagai **SVG** dengan ujung dan sambungan bulat (stroke 3.3/16), agar menyatu dengan huruf Mochiy.
- **Tanda tangan "Gifar":** script tulisan tangan, dibuat sebagai **SVG path**. Bisa digambar sekali
  (stroke draw ≈1.2s) sebagai bagian dari satu-satunya momen motion saat load. Lihat §7.

### 3.3 Spacing, radius, ukuran

- **Spacing (basis 4px):** `--space-1 4` · `-2 8` · `-3 12` · `-4 16` · `-5 20` · `-6 24` · `-8 32` · `-10 40` · `-12 48` · `-16 64`
- **Radius berhierarki** (bukan satu radius untuk semua):

| Token | Nilai | Untuk |
|---|---|---|
| `--radius-xs` | 8px | chip kecil, tile ikon kecil |
| `--radius-sm` | 10px | chip teknologi, tile ikon 40px |
| `--radius-md` | 12px | tombol Back, grup chip, item menu |
| `--radius-lg` | 16px | kartu topik, audio player |
| `--radius-xl` | 20px | panel transkrip |
| `--radius-pill` | 999px | pill sapaan, tombol ikon bulat |

- **Target sentuh:** minimal **40×40px** (desktop), **44×44px** (touch).

### 3.4 Kaca (glassmorphism) & elevasi

Tiga tingkat. Semakin tinggi tingkatnya, semakin solid dan semakin jelas bayangannya.

| Token | Background | Blur | Border | Shadow | Untuk |
|---|---|---|---|---|---|
| `--glass-1` | `rgba(255,255,255,.55)` | 16px | `1px rgba(255,255,255,.7)` | `0 8px 24px -12px rgba(54,72,160,.18)` | pill, tombol ikon, chip |
| `--glass-2` | `rgba(255,255,255,.66)` | 20px | `1px rgba(255,255,255,.8)` | `0 14px 36px -16px rgba(54,72,160,.22), 0 2px 6px rgba(54,72,160,.05)` | kartu topik, grup chip, audio player |
| `--glass-3` | `rgba(255,255,255,.78)` | 24px | `1px rgba(255,255,255,.9)` | `0 24px 48px -20px rgba(54,72,160,.25)` | panel transkrip, menu mobile |

- Semua tingkat memakai highlight atas `inset 0 1px 0 rgba(255,255,255,.9)` dan
  `backdrop-filter: blur(n) saturate(140%)`.
- **Fallback wajib:** jika `backdrop-filter` tidak didukung, atau saat
  `prefers-reduced-transparency: reduce`, pakai `--color-surface-solid` dengan alpha .94.
- Warna bayangan **lavender** `rgba(54,72,160,…)`, **bukan** abu-abu `rgba(0,0,0,.1)`.

### 3.5 Motion

| Token | Nilai | Untuk |
|---|---|---|
| `--ease` | `cubic-bezier(0.22,1,0.36,1)` | UI (kartu muncul, hover) |
| `--dur-fast` | 150ms | hover, press |
| `--dur-base` | 240ms | muncul/hilang komponen |
| `--dur-slow` | 450ms | panel detail masuk |
| kamera masuk | 1600ms easeInOutCubic | full → half (sudah ada di `camera.js`) |
| kamera keluar | 1300ms easeInOutCubic | half → full |

### 3.6 Layering & breakpoint

- **z-index:** background 0 · canvas 3D 1 · UI konten 10 · nav 20 · overlay/menu mobile 30 · toast 40
- **Breakpoint:** `≥1200` desktop (acuan) · `1024–1199` laptop · `768–1023` tablet · `<768` mobile.
  Untuk 3D: viewport **portrait** (aspect < 0.9) memakai layout kamera vertikal (sudah ada di `camera.js`).

---

## 4. Panggung 3D & latar

- `background-avatar.png` adalah **lapisan paling belakang** (CSS, `object-fit: cover`). Canvas 3D
  di atasnya transparan (`alpha: true`).
- **Podium harus tepat di bawah kaki karakter.** Pusat podium di gambar berada pada ≈(50%, 75%).
  Posisi kaki di layar dihitung dari kamera (proyeksi bone kaki), lalu `background-position` digeser
  agar keduanya bertemu. Bayangan elips di bawah kaki tetap dipakai.
- **State 02:** latar ikut "mendekat" (scale 1 → 1.15, sedikit blur 0 → 2px) selama 1600ms bersama
  kamera, supaya terasa satu gerakan sinematik.
- ⚠️ Gambar latar punya **2 kartu dekoratif palsu** (kiri ≈x 6–20%, kanan ≈x 81–93%). Kartu ini
  bersaing dengan kartu topik asli. Opsi: (a) tutup dengan kartu asli di posisi yang sama, (b) minta
  versi latar tanpa kartu, atau (c) mask/crop. **Disarankan (b).**
- Karakter = elemen paling berani di halaman (*spend your boldness in one place*). UI di sekitarnya
  tetap tenang: kaca tipis, warna terbatas, tanpa dekorasi tambahan.

---

## 5. Komponen

Semua komponen interaktif **wajib** punya state: default · hover · focus-visible · active (pressed) ·
disabled (bila relevan). Fokus = ring `2px solid --color-accent-text`, offset 2px.

### 5.1 Navbar
- **Anatomi:** wordmark (kiri) · 5 link (tengah) · tombol suara + pill sapaan (kanan). Tanpa latar
  (transparan di atas panggung), tinggi 72px, padding horizontal 48px.
- **Link:** `ui`, warna `text-muted`. Aktif = `text-title` + underline 2px `--color-accent`, dengan
  `aria-current="page"`.
- **Perilaku:** *Home* → state 01. Link topik → state 02 untuk topik itu (sama dengan klik kartu).
- **Mobile:** link disembunyikan di tombol menu (ikon 44px). Wordmark dan tombol suara tetap tampil.

### 5.2 Pill sapaan "Hi, I'm Gifar ●" & tombol suara
- **Pill:** `--glass-1`, radius pill, `ui`, dot 8px `--color-accent` di kanan. **Usulan perilaku:**
  klik → karakter melambai + menyapa (gesture *wave* yang sudah ada). Dot = indikator "karakter
  siap". *(Perlu konfirmasi, lihat §11.)*
- **Tombol suara:** 40px bulat, `--glass-1`, ikon speaker. Mute/unmute narasi, dengan
  `aria-pressed` dan label "Mute narration" / "Unmute narration".

### 5.3 Intro (hanya state 01)
- **Urutan:** headline `display` 2 baris (nama dengan `--color-accent`) → role line `ui` 15px
  `text-secondary` → paragraf `body` `text-muted` (≤34ch) → tanda tangan SVG ≈100×60.
- **Rata kiri**, top ≈180px, lebar maks 360px. Semantik: `h1` untuk headline.

### 5.4 Kartu topik (state 01)
- **Anatomi:** chip ikon 40px (bg `accent-100`, ikon 20px `--color-icon`) → judul `title`
  `text-title` → subjudul `caption` `text-muted` → panah 16px di kanan-bawah.
- **Material:** `--glass-2`, radius 16, padding 20, ukuran ≈264×132.
- **Interaksi:** seluruh kartu adalah satu `<button>` (bukan div). Hover → naik 2px + shadow
  `glass-3` (150ms). Press → turun ke 0. Focus-visible → ring.
- **Posisi:** 2 kartu di kiri dan 2 di kanan karakter, bertingkat (lihat §2.1). Kartu **tidak**
  boleh menutupi wajah atau tangan karakter.
- **Mobile:** kartu menjadi grid 2×2 kompak (ikon + judul saja, ≈ penuh lebar ÷ 2) di bawah karakter.

### 5.5 Tombol Back & menu topik (state 02)
- **Back:** `--glass-1`, radius 12, ≈100×40, ikon ← + "Back". Kembali ke state 01.
- **Menu topik:** daftar 4 item (ikon 20px + label `ui`). Aktif: bg `accent-50`, bar kiri 3px
  `accent-600`, label `text-title` 600, dengan `aria-current="true"`. Klik item lain → ganti topik
  **tanpa** kembali ke full body: kamera tetap, konten dan narasi berganti.
- **Mobile:** menu menjadi tab horizontal yang bisa di-scroll di atas panel konten.

### 5.6 Kolom konten (state 02)
- **Urutan:** overline (`accent-600`) → `h1` (`ink-800`, dengan kata aksen `--color-accent`) → lead
  `body` `text-muted` ≤48ch → isi topik.
- **Isi "Skills":** 3 grup (Frontend · Backend & Database · Tools & Others). Tiap grup = kartu
  `--glass-2` radius 12 dengan judul `caption` 600 + baris chip.
- **Chip teknologi:** `--glass-1`, radius 10, tinggi 42, logo 18px **berwarna asli brand** + label
  `caption`. Chip bersifat informasi, **bukan** tombol (tanpa hover lift).
- Topik lain mengikuti kerangka yang sama: *About* = paragraf + fakta singkat; *Projects* = daftar
  kartu proyek; *Journey* = timeline. Penomoran urutan **hanya** dipakai di Journey, karena isinya
  memang berurutan.

### 5.7 Panel transkrip (state 02)
- **Anatomi:** header (tile ikon 40px `--gradient-media` radius 10 + judul topik `title` +
  subjudul `caption`) → divider `--color-line` → teks narasi `body` 14px → baris waktu (tabular) +
  mini waveform → tombol "Back to topics" (outline, full width, 44px).
- **Material:** `--glass-3`, radius 20, lebar ≈265, tinggi maks = area konten (isi scroll).
- **Sinkronisasi per kata:** teks berjalan mengikuti audio. Waktu tiap kata diambil dari `words` di
  `.lipsync.json`; tanpa audio, waktunya diperkirakan dari kecepatan baca. Kata yang sudah diucapkan
  memakai `text-display`, kata yang sedang diucapkan memakai `accent-text` di atas sorotan `accent-100`
  (radius 4), dan sisanya tetap `text-muted` (AA). Hanya warna yang berubah, tidak ada perubahan
  ketebalan huruf, jadi baris tidak bergeser.
- **Auto-scroll:** kalau teks lebih panjang dari card, card bergulir halus sehingga kata yang sedang
  diucapkan berada sekitar ⅓ dari atas. Scroll manual (wheel/touch/drag) menjeda auto-scroll selama
  2.5 s. Di compact, teks transkrip punya scroller sendiri (maks 220px) supaya sheet tidak ikut bergeser.

### 5.8 Audio player (state 02)
- **Anatomi:** tombol play/pause 40px (`--gradient-media`, ikon putih) → waveform → waktu
  `0:08 / 0:42` (`caption`, tabular) → tombol volume.
- **Waveform:** bar 2px, gap 3px, radius penuh. Bagian yang sudah diputar `violet-600`, sisanya
  `accent-200`. Klik/drag = seek, dengan `role="slider"`, `aria-valuenow`, dan tombol ←/→ ±5 detik.
- **Material:** `--glass-2`, radius 16, ≈405×60, kiri-bawah (desktop). Di mobile: menempel di bawah,
  lebar penuh − 32px.
- Status play di player **harus sama** dengan gerak mulut karakter (lihat integrasi TTS di §11).

### 5.9 Footer (state 01)
- **Kiri:** "Scroll to explore" + ikon mouse (`caption`, `text-muted`). *(Perilaku perlu
  konfirmasi, lihat §11.)*
- **Kanan:** "Let's connect" + divider vertikal + 3 tombol ikon 40px (LinkedIn, GitHub, Email),
  masing-masing dengan `aria-label` dan link eksternal `rel="noopener"`.

---

## 6. Responsif

**Implementasi (2026-10-16): dua layout**, dipilih di `stage.js` dan ditulis ke `<html data-layout>`:

| Area | **wide**: lebar ≥1200 **dan** rasio ≥1.25 | **compact**: selain itu (ponsel, tablet, jendela tinggi) |
|---|---|---|
| Nav | penuh | wordmark + suara + menu (sheet) |
| State 01 | komposisi referensi pada bingkai 1440×720 yang diskalakan `k` | intro ringkas atas · karakter tengah · kartu 2×2 bawah |
| State 02 | menu kiri · karakter 34% · konten + transkrip kanan | tab topik · karakter atas · konten + transkrip dalam bottom sheet · player menempel bawah |

- **Bingkai wide:** `k = clamp(min(vw/1440, vh/720), 0.83, 1.3)`. Posisi dan ukuran kotak ×`k`;
  ukuran teks ×`ks = clamp(k, 0.92, 1.2)` supaya tidak terlalu kecil. Sisa tinggi layar dibagi rata
  atas-bawah.
- **Kamera** menempatkan karakter pada anchor yang sama: full = kepala 13% / kaki 92.5% bingkai, x 52%;
  half = kepala 12%, potongan ikat pinggang di bawah bingkai, x 34.5%.
- **Latar** mengikuti kamera: podium selalu di bawah titik berdiri karakter, dan skalanya ikut ukuran
  karakter di layar (`Backdrop` di `stage.js`).

- **Latar compact** terkunci ke karakter (tanpa *cover*), tepinya memudar ke gradien `.backdrop`.
  Tinggi karakter di layar dibatasi supaya lingkaran besar (1,37× tinggi karakter) muat di lebar layar.
- **Bottom sheet (compact, state 02):** sheet diam di 51vh dan **naik menutupi karakter saat
  di-scroll**, berhenti di bawah baris tab. Permukaannya kaca: putih .56→.70, `blur(18px) saturate(160%)`,
  sehingga karakter tetap samar terlihat. Area di atas sheet tetap bisa di-tap (melambai). Jangan pasang
  `mask`/`filter` pada scroller-nya, karena itu mematikan backdrop blur sheet.
- **Area scroll:** scrollbar tipis, thumb violet `rgba(105,111,249,.35)` (hover .6), tanpa track.
  Teks transkrip memudar di tepi atas/bawah, kolom topik (wide) memudar di bawah, dan tab topik mobile
  memudar di kanan sebagai tanda masih ada tab lain.
- Tidak ada scroll horizontal. Margin samping mobile 16px.
- Teks panjang di kartu/menu: maksimal 1 baris, sisanya `text-overflow: ellipsis`, dan judul
  lengkapnya tetap tersedia untuk pembaca layar.

---

## 7. Interaksi & motion

```
            klik kartu / nav topik
 [01 Initial] ───────────────────────▶ [02 Detail: topik X]
      ▲   kamera 1600ms, lalu gestur + narasi   │  pilih topik lain (kamera tetap,
      │                                         │  konten crossfade 240ms)
      └──── Back / Back to topics / nav Home ───┘  kamera 1300ms
```

- **Satu momen orkestrasi saat load:** karakter berjalan masuk → berdiri → tanda tangan tergambar →
  kartu muncul **bersamaan** (fade 240ms). Tidak ada animasi masuk per-section lainnya.
- **Urutan masuk detail** (sudah ada di kode): klik → UI state 01 memudar (150ms) → kamera 1600ms
  → panel detail masuk (450ms) → gestur tangan → narasi mulai.
- **Pindah topik = karakter berjalan keluar-masuk:** panel konten, transkrip, dan player memudar
  (240ms), narasi berhenti, lalu karakter berjalan keluar layar. **Arah ditentukan oleh posisi:**
  karakter keluar lewat tepi terdekat dari posisinya sekarang, lalu masuk dari tepi terdekat ke posisi
  tujuan. Kiri → kanan = keluar kiri, masuk kanan; kanan → kiri = keluar kanan, masuk kiri; kanan →
  kanan = keluar dan masuk lewat kanan; kiri → kiri = lewat kiri. Karakter tidak pernah menyeberangi
  layar untuk kembali ke sisi yang sama. Di compact (karakter selalu di tengah): ke topik berikutnya
  keluar kiri dan masuk kanan, ke topik sebelumnya sebaliknya. Setelah tiba dan menghadap
  kamera, panel muncul lagi, diikuti gestur pembuka dan narasi. Kecepatan 1.45 m/s, dengan ritme
  animasi jalan ikut dipercepat. Klik topik lain saat karakter berjalan langsung mengalihkan
  tujuannya, tanpa menunggu. Dengan reduced motion: tanpa berjalan, hanya crossfade 240ms.
- **Layout bergantian (wide):** About dan Projects = menu · KARAKTER · konten · transkrip
  (karakter x 34.5%). Skills dan Journey = menu · konten · KARAKTER · transkrip (karakter x 62.9%,
  konten di x 300, player di bawah transkrip). Menu dan Back **tidak pernah pindah**. Sisi kanan
  dicapai dengan menggeser karakter di dunia 3D (`sideOffset` di `stage.js`), bukan kamera, jadi
  latar tidak meloncat. `.wash--detail` ikut dicerminkan. Di compact karakter selalu di tengah, tapi
  tetap berjalan keluar-masuk. Home ↔ topik di sisi kanan: karakter berjalan ke posisinya sambil
  kamera zoom.
- **Gestur saat bicara (acak):** selama narasi diputar, gestur *present* (telapak terbuka) berulang
  pada waktu acak: tahan 1.2–2.8 s, lalu jeda 1.4–4.2 s setelah gestur selesai. Tangan kiri atau kanan
  dipilih acak, 65% berganti tangan dari sebelumnya. Mengangguk hanya kadang-kadang (40%), kecuali pada
  gestur pembuka. Saat audio di-pause, berhenti, atau selesai, tangan yang terangkat **langsung turun**
  (0.4 s) dan tidak ada gestur baru sampai audio diputar lagi.
- **Kepala vs cursor:** saat audio diputar, kepala **tidak** mengikuti cursor. Kepala tetap menghadap
  penonton, hanya dengan lirikan kecil (35% dari lirikan idle). Setelah audio berhenti, kepala kembali
  mengikuti cursor begitu cursor digerakkan. Nilainya ada di `TALK` dan `PRESENT_TIMING` di `avatar.js`.
- Kartu boleh punya **float halus** (±4px, 6s) **hanya** di state 01. Matikan saat hover dan saat
  reduced motion.
- **`prefers-reduced-motion: reduce`:** kamera langsung lompat (durasi 0, sudah ada), tanpa float,
  tanpa stroke-draw tanda tangan, crossfade 0ms. Karakter tetap idle tapi tanpa berjalan masuk.

---

## 8. Aksesibilitas (kriteria yang bisa diuji)

| # | Kriteria | Cara uji |
|---|---|---|
| A1 | Teks ≤18px memiliki kontras ≥ 4.5:1 terhadap latar efektifnya (termasuk di atas kaca) | cek token §3.1; sampling screenshot |
| A2 | Komponen UI dan ikon bermakna ≥ 3:1 | tombol play `violet-500` vs bg = 3.6 |
| A3 | Semua aksi bisa dilakukan dengan keyboard; urutan Tab: nav → intro → kartu (kiri-atas → kanan-bawah) → footer | navigasi Tab manual |
| A4 | `:focus-visible` terlihat di semua kontrol (ring 2px `accent-600`) | Tab ke setiap kontrol |
| A5 | Kartu dan item menu adalah `<button>`; nav adalah `<nav>` dengan `<a>` + `aria-current` | inspeksi DOM |
| A6 | Narasi punya teks setara (panel transkrip); audio **tidak** autoplay sebelum ada interaksi pengguna | klik kartu baru memulai audio |
| A7 | Canvas 3D punya label (`aria-label`) dan tidak menjebak fokus | pembaca layar |
| A8 | Pergantian state diumumkan (`aria-live="polite"` pada judul topik) | pembaca layar |
| A9 | Reduced motion dan reduced transparency dihormati (§3.4, §7) | emulasi media query di DevTools |
| A10 | Target sentuh ≥ 44px di mobile | ukur di 390×844 |

---

## 9. Konten & tone

- Bahasa UI mengikuti referensi: **Inggris**, kalimat sederhana, sentence case.
- **Judul kartu** = pertanyaan atau kata benda singkat. **Subjudul** = apa yang didapat
  ("Get to know me better").
- **Tombol** menyebut aksinya: "Back to topics", bukan "Return". Nama aksi konsisten: kartu
  "Skills & Tools" ↔ nav "Skills" ↔ panel "Skills & Tools".
- **Narasi:** orang pertama, santai, maksimal ≈45 detik per topik.

| ✅ Do | ❌ Don't |
|---|---|
| "Things I've built" | "Explore my amazing portfolio of projects" |
| "Couldn't load the narration. Read the transcript instead." | "Oops! Something went wrong 😢" |

---

## 10. Anti-pattern (dilarang)

- Memakai `#899DBD` / `#8598B5` untuk teks yang harus dibaca (gagal kontras), bukan `ink-500`.
- Bayangan abu-abu netral `rgba(0,0,0,.1)` atau satu radius untuk semua elemen.
- Menambah elemen dekoratif baru (blob, partikel, gradien latar) di luar `background-avatar.png`.
- Animasi masuk per-section, atau hover lift pada elemen yang bukan tombol (chip teknologi).
- Kartu atau panel yang menutupi wajah atau tangan karakter saat gestur.
- `<div onclick>` untuk kartu, menu, atau player.
- Audio autoplay saat halaman dibuka.
- Kaca tanpa fallback `backdrop-filter`.

### Catatan dari skill `frontend-design`
Skill ini menandai beberapa ciri yang ada di referensi sebagai "default generik":
- satu kata beraksen di headline
- overline huruf kapital
- pemisah tengah "·"
- panah "→" di kartu

**Semuanya tetap dipakai** karena referensi ini adalah brief Anda, dan *brief selalu menang*.
Disiplin pemakaiannya:
- **Aksen headline:** hanya untuk nama ("Gifar") dan inti pertanyaan topik ("I use?"), satu per
  heading.
- **Overline:** hanya di kolom konten state 02, tidak di tempat lain.
- **Pemisah "·":** hanya di role line.
- **Panah:** hanya pada elemen yang benar-benar membuka sesuatu (kartu topik).

---

## 11. Keputusan terbuka (perlu konfirmasi)

1. **Konten nyata** untuk 4 topik, link sosial (LinkedIn, GitHub, Email), dan file tanda tangan.
   Sementara memakai copy dari referensi.
2. **Pill "Hi, I'm Gifar"**: usulan = klik → karakter menyapa. Setuju?
3. **"Scroll to explore"**: halaman ini satu layar. Usulan: scroll/swipe = berpindah antar topik
   kartu (fokus bergilir). Alternatif: dihapus.
4. **Latar tanpa kartu dekoratif** (§4): mau dibuatkan versi bersih?
5. **Narasi/TTS:** dikerjakan di worktree `text-to-speech` (audio + `visemes.json` + `lipsync.js`).
   Player di §5.8 akan disambungkan ke sana saat digabung.

---

## 12. Peta kode (sudah diimplementasikan 2026-10-16)

| File | Isi |
|---|---|
| `web/index.html` | struktur semantik: `header>nav`, `main` (view home + view detail), loader; font Google |
| `web/src/style.css` | token §3, kaca 3 tingkat + fallback, layout `wide` dan `compact` |
| `web/src/content.js` | **satu-satunya tempat copy**: `profile` + `topics[]` (judul, heading, lead, isi, transkrip) |
| `web/src/ui.js` | membangun DOM dari `content.js` (nav, kartu, menu topik, isi topik, transkrip, player) |
| `web/src/stage.js` | pengukuran layout, anchor kamera, dan latar yang mengikuti kamera |
| `web/src/narration.js` | timeline narasi; **sementara simulasi dari teks** (mulut mengikuti vokal teks) sampai audio TTS disambungkan |
| `web/src/icons.js` | ikon Lucide inline + wordmark GIFΛR |
| `web/src/main.js` | hash router `#/` ↔ `#/<topik>`, transisi kamera, gestur + narasi, scroll antar topik (wide), menu mobile |
| `web/src/camera.js` | shot full/half; posisi dari `stage.js`; potongan half body di ikat pinggang |
| `web/public/images/` | `background-avatar.png`, `logos/*.svg` (Simple Icons, warna brand) |

**Perilaku yang dipilih untuk keputusan terbuka (§11), bisa diubah:**
- **Pill sapaan:** klik → karakter melambai.
- **Scroll to explore** (wide): scroll ke bawah = topik berikutnya (Home → About → Skills → Projects
  → Journey), ke atas = sebelumnya. Jeda 1.4 detik antar langkah; tidak aktif saat sedang menggulir
  panel yang punya scroll sendiri.
- **Link:** setiap topik punya URL (`#/skills`), jadi tombol Back browser dan deep link berfungsi.

---

## 13. QA checklist (code review)

- [ ] Tidak ada hex mentah di komponen; semua warna lewat token `--color-*`
- [ ] Kontras teks lolos A1 (cek `ink-500`, `accent-600` di atas kaca)
- [ ] Kaca punya fallback `@supports not (backdrop-filter: …)` dan `prefers-reduced-transparency`
- [ ] Radius sesuai hierarki §3.3 (kartu 16, panel 20, chip 10, tombol 12)
- [ ] Waktu audio memakai `tabular-nums`
- [ ] Kartu, menu, dan kontrol player adalah elemen semantik dengan focus ring terlihat
- [ ] Nav, kartu, dan menu topik membuka topik yang sama; *Home*/*Back* kembali ke state 01
- [ ] Podium latar sejajar kaki karakter di 1440×900, 1280×800, dan 390×844
- [ ] Tidak ada kartu atau panel yang menutupi wajah/tangan karakter di ketiga ukuran tersebut
- [ ] Reduced motion: tanpa walk-in, float, stroke-draw; kamera lompat
- [ ] Audio tidak autoplay sebelum interaksi
- [ ] Audit `web-design-guidelines` dijalankan pada `web/index.html`, `web/src/*.js`, `web/src/style.css`
- [ ] Screenshot state 01 dan 02 dibandingkan berdampingan dengan `refs/ui-design-refrence.png`

---

## 14. Revisi v2 home (2026-10-16, disetujui)

- Home **hanya karakter + 4 kartu**. Blok intro ("Hello, I'm Gifar", paragraf, tanda tangan) dihapus dari home.
- Karakter di **tengah** (x 50%), kartu simetris 2 kiri + 2 kanan, bertingkat.
- Identitas: **name plate** kaca kecil di depan podium (`Gifar · Frontend Developer & Creative Technologist`; mobile: hanya role pertama) + `h1` tersembunyi untuk SEO/pembaca layar.
- Paragraf intro + tanda tangan pindah ke topik **Who am I?** (`signature: true` di `content.js`).
- Wash home menjadi vignette kiri-kanan agar kartu dekoratif di `background-avatar.png` tidak terbaca sebagai kartu asli.
- Mobile: tanpa judul besar; karakter lebih besar, name plate di atas grid kartu.
