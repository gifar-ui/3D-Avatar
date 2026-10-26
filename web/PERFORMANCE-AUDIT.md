# Audit Performa: Animasi & 3D

Tanggal: 22 Oktober 2026 · Cakupan: `web/` (Three.js + three-vrm + GSAP), runtime di browser.
Tujuan: browser lebih enteng **tanpa mengurangi** fitur, animasi, atau tampilan yang ada.

---

## 1. Ringkasan

Halaman ini sudah lancar di laptop ini (hampir semua frame tepat waktu). Yang berat adalah
**pekerjaan GPU dan CPU yang terbuang**, bukan fps yang jatuh. Di perangkat yang lebih lemah,
pemborosan inilah yang akan berubah menjadi patah-patah dan baterai cepat habis.

Tiga perbaikan dengan dampak terbesar. Semuanya tidak terlihat oleh pengunjung (✅ = sudah dikerjakan, hasilnya di §8):

| # | Masalah | Perbaikan | Dampak terukur |
|---|---|---|---|
| P1 ✅ | Cincin progres player di-update tiap frame, memaksa **seluruh halaman di-repaint ~104×/detik** saat narasi berjalan | Update cincin cukup ~10–15×/detik | Repaint dokumen 104 → 7×/s, paint 16,7 → 0,7 ms/s, **GPU halaman detail −27%** (bersama P2) |
| P2 ✅ | Transisi warna kata subtitle (100 ms) ikut memicu repaint tiap frame | Warna kata berubah instan (atau transisi lewat opacity) | Bagian dari angka P1 |
| P4 ✅ | Parallax kartu Home menulis variabel CSS **~1.800×/detik** (dobel, dan 144×/s di layar 144 Hz) | Satu tulisan per frame per kartu, hanya saat nilainya berubah | Style recalc saat kursor bergerak **85 → ~53 ms/s** (−38%) |

---

## 2. Cara mengukur

- **Perangkat:** laptop ini. Chrome dengan GPU sungguhan (ANGLE Direct3D11, AMD Radeon iGPU), layar
  **144 Hz**, skala 1×, viewport 1440×849. Bukan headless, supaya GPU dan ClearType sama dengan
  pemakaian nyata.
- **Keadaan yang diukur** (masing-masing 3–4 detik):
  - Home diam
  - Home dengan kursor bergerak
  - Halaman detail Skills saat narasi berjalan
  - Pindah topik (avatar berbalik, berjalan keluar, lalu masuk lagi)
- **Metrik:**
  - FPS dan p95 frame time (dari `requestAnimationFrame`), serta jumlah frame > 20 ms.
  - Waktu script, style recalc, dan layout per detik (CDP `Performance.getMetrics`).
  - Waktu sibuk proses GPU (`CrGpuMain`) dan compositor (`VizCompositorThread`), dari trace Chrome.
  - Draw call per canvas WebGL (hook `drawElements`) dan event `Paint` per elemen DOM.
  - Profil CPU JavaScript (CDP Profiler).
- **Atribusi:** setiap tersangka dimatikan sementara (CSS/JS disuntikkan), lalu diukur ulang.
  Angka GPU antar-run cukup berisik (±100 ms/s), jadi perbandingan penting diulang 2×.

Skrip pengukurannya ada di scratchpad sesi ini (`shot/perf.cjs`, `perfdetail.cjs`,
`perfmouse.cjs`, `paints.cjs`, `draws.cjs`). Kalau ingin dipakai lagi, skrip itu bisa dipindah ke
`web/scripts/perf/`.

---

## 3. Kondisi saat ini (baseline)

| Keadaan | FPS (rAF) | p95 frame | Frame >20 ms | Script | Style recalc | GPU sibuk | Compositor |
|---|---|---|---|---|---|---|---|
| Home diam | 144 | 7,1 ms | 0 | 139 ms/s | 0 | 263 ms/s | 200 ms/s |
| Home, kursor bergerak | 142 | 7,1 ms | 1 | 172 ms/s | **86 ms/s** | 669 ms/s | 311 ms/s |
| Detail, narasi berjalan | 134 | 13,8 ms | 1 | 180 ms/s | 24 ms/s | **620–820 ms/s** | 198 ms/s |
| Pindah topik (berjalan) | 133 | 13,8 ms | 10 | 191 ms/s | 23 ms/s | 653 ms/s | 167 ms/s |

Data lain:
- 3D: avatar **23–24 draw call**, ~52 ribu segitiga, 38 tekstur di GPU. JS heap 21–25 MB.
- Canvas set 3D (`#set`) **tidak** menggambar saat kamera diam (terverifikasi: 0 draw call).
- Avatar digambar setiap frame kedua (72 fps) di layar 144 Hz, karena ada `MIN_FRAME_MS`.

Cara membaca kolom "GPU sibuk": 820 ms/s berarti proses GPU sibuk 82% dari setiap detik. Di laptop
ini masih muat, tapi di iGPU yang lebih lemah atau layar retina (piksel 4×), angka itulah yang
membuat frame mulai jatuh.

---

## 4. Temuan & rekomendasi (urut dampak)

### P1. Cincin progres player memicu repaint seluruh halaman tiap frame — **prioritas tinggi**
- **Lokasi:** `src/ui.js` `renderNarration()`, yaitu `ring.style.strokeDashoffset` yang ditulis
  setiap frame selama narasi berjalan, dipanggil dari loop di `src/main.js`.
- **Penyebab:** setiap perubahan cincin 44 px menandai layer root halaman sebagai kotor. Akibatnya
  Chrome me-repaint **#document (1442×848 px) ~104×/detik**, dan panel topik ikut dirasterisasi
  ulang: memo dengan bayangan blur besar dan kertas miring, yang memang mahal digambar.
- **Bukti:**
  - Narasi dijeda → paint 0 ms/s.
  - Narasi berjalan → paint 16,7 ms/s, 104 repaint dokumen per detik.
  - Tanpa update cincin (+P2) → paint 0,7 ms/s, repaint dokumen 7/s.
  - GPU halaman detail: rata-rata ~620 → ~450 ms/s (dua kali ulang: 684/516/690/592 vs
    491/454/468/388).
  - Panel disembunyikan (`.topic`) → GPU 433 ms/s dan semua frame tepat waktu. Ini mengonfirmasi
    bahwa panel yang ikut digambar ulang adalah sumber biayanya.
- **Perbaikan:** batasi update cincin ke ~10–15×/detik. Narasi terpendek 21 detik, jadi per 100 ms
  cincin hanya maju ~0,6 px, dan perbedaannya tidak terlihat. Teks waktu sudah hanya ditulis saat
  berubah, jadi tidak perlu diubah.
- **Yang sudah dicoba dan tidak membantu:** `will-change` pada player/subtitle/panel. Repaint
  dokumen tetap ~105/s, jadi pemicunya harus dikurangi, bukan dibungkus layer.
- **Dampak visual:** tidak ada.
- **Status:** terverifikasi dengan pengukuran (mensimulasikan cincin yang tidak di-update).

### P2. Transisi warna kata subtitle memicu repaint beruntun — **prioritas tinggi**
- **Lokasi:** `src/style.css`, `.subtitle .w { transition: color 100ms ease; }`.
- **Penyebab:** setiap kata yang menyala menganimasikan `color` selama 100 ms. Itu properti
  paint, bukan composite, jadi setiap frame transisi ikut memicu repaint (~60 paint/s subtitle).
- **Perbaikan, pilih salah satu:**
  1. Warna berubah instan. Pergantian 100 ms nyaris tidak terlihat pada subtitle.
  2. Tetap ada fade: kata yang sudah diucapkan ditumpuk sebagai lapisan putih yang di-fade lewat
     `opacity` (properti composite, tidak memicu paint). Sedikit lebih rumit, tapi tampilannya
     sama persis.
- **Dampak visual:** opsi 1 nyaris tidak terlihat, opsi 2 tidak ada.
- **Status:** terverifikasi (opsi 1, disuntikkan lewat CSS).

### P3. Bayangan memo Skills mahal dirasterisasi — **cukup diselesaikan lewat P1/P2**
- **Lokasi:** `.memo::before` dan `.route__map::before` (box-shadow blur 24–32 px + rotasi).
- **Bukti:** tanpa bayangan memo, GPU detail turun ke ~460 ms/s. Tapi biaya itu hanya muncul karena
  panel digambar ulang tiap frame (P1/P2). Setelah pemicunya hilang, panel cukup dirasterisasi
  sekali.
- **Rekomendasi:** jangan ubah desain bayangannya. Kerjakan P1 dan P2, lalu ukur ulang.

### P4. Parallax kartu Home menulis variabel CSS ~1.800×/detik — **prioritas tinggi**
- **Lokasi:** `src/motion.js` `cardParallax()`. Ada dua `gsap.quickTo` (x dan y), dan
  **masing-masing** punya `onUpdate: write` yang menulis `--px` dan `--py` ke 4 kartu.
- **Penyebab:**
  - Setiap tick, tulisan terjadi 2× (sekali per tween) × 2 variabel × 4 kartu = 16 `setProperty`.
  - Tick GSAP berjalan mengikuti refresh layar: 144×/s di layar ini, padahal 3D hanya digambar
    72×/s.
  - Terukur 5.504 tulisan `--px` dalam 3 detik.
- **Bukti:** memblokir tulisan `--px`/`--py` menurunkan style recalc saat kursor bergerak dari
  **85 → 53 ms/s**.
- **Perbaikan:**
  - Satu fungsi tulis per tick, untuk kedua sumbu sekaligus.
  - Lewati tulisan kalau nilainya sama dengan sebelumnya. Nilainya sudah dibulatkan ke piksel
    utuh di CSS, jadi bisa dibandingkan setelah dibulatkan.
  - Opsional: tulis hanya pada frame yang dirender (72 Hz).
- **Dampak visual:** tidak ada. Gerakan parallax sama persis.
- **Status:** penyebab terverifikasi. Angka sesudah perbaikan masih estimasi (−30% sampai −40%
  style).

### P5. Sisa style recalc saat kursor bergerak (~53 ms/s) — **sedang** (✅ lihat §9)
- Setelah P4 masih tersisa ~53 ms/s. Kandidatnya: tilt kartu saat hover (`--rx`/`--ry`, ~400
  tulisan/s; memblokirnya hanya −7 ms/s), sheen, efek magnet tombol, dan efek hover huruf di nav.
- Rekomendasi: kerjakan P4 dulu, lalu ukur ulang dengan trace `UpdateLayoutTree` per elemen.

### P6. Render avatar adalah biaya GPU terbesar saat diam — **sedang (penting di layar retina)** (✅ lihat §9)
- **Bukti:** Home diam GPU 263 ms/s. Kalau canvas avatar disembunyikan, 76 ms/s. Jadi menggambar
  avatar ≈ 190 ms/s (~2,6 ms per frame) di skala 1×.
- **Penyebab:**
  - Canvas avatar selebar layar penuh dengan MSAA (`antialias: true`), padahal avatar hanya
    mengisi sebagian.
  - Material MToon menggambar setiap mesh dua kali (isi + outline).
  - Di layar retina (`devicePixelRatio` 2), jumlah pikselnya 4×.
- **Yang sudah baik:** batas 72 fps di layar >100 Hz (`MIN_FRAME_MS`), dan penurunan resolusi
  otomatis kalau frame lambat (`adaptResolution`).
- **Opsi (tanpa mengurangi tampilan di layar biasa):**
  1. Batasi DPR canvas avatar ke 1,5 di layar retina (saat ini maksimal 2). Perbedaannya hampir
     tidak terlihat pada gaya cel-shading, dan pikselnya berkurang ~44%.
  2. Render hanya area avatar (scissor + viewport mengikuti kotak pembatas avatar di layar).
     Lebih rumit, dan hemat terutama saat tampilan seluruh badan.
- **Status:** biaya terukur di skala 1×. Dampak di layar retina dan HP **belum diukur**, perlu tes
  di perangkat.

### P7. JavaScript per frame (~140–190 ms/s CPU) — **rendah** (✅ sebagian, lihat §9)
- Profil CPU di halaman detail (self time per detik):
  - `updateMatrixWorld` 12 ms, `updateWorldMatrix` 8 ms, `multiplyMatrices` 10 ms, `applyMatrix4`
    10 ms (perhitungan matriks scene graph VRM).
  - `vrm.update` 11 ms (spring bone ~80 joint + ekspresi), `projectObject` 9 ms.
  - `renderNarration` 3 ms, `tie.js` ~4 ms.
- **Peluang:**
  - Matriks dunia dihitung dua kali per frame: oleh `vrm.update` dan lagi oleh `renderer.render`
    (`scene.matrixWorldAutoUpdate`). Bisa dihemat ~10–20 ms/s dengan satu update manual. Perlu
    hati-hati karena urutannya dengan spring bone penting.
  - `tie.js` menghitung `lineNow()` dua kali per frame (`update` dan `hold`). Cukup sekali
    (~2 ms/s).
- **Status:** dari profil. Penghematan masih estimasi.

### P8. Beban unduh & memori GPU — **sedang (waktu muat, HP)** (✅ sebagian, lihat §9)
Ini tidak memengaruhi fps, tapi memengaruhi seberapa "enteng" halaman saat dibuka dan seberapa
besar memori yang dipakai. Semua angka di bawah estimasi, belum diukur:

| Aset | Ukuran | Opsi |
|---|---|---|
| `avatar_v2.vrm` | 4,5 MB | Tekstur → KTX2/Basis (memori GPU −70–80%, decode tidak memblok thread utama); geometri → meshopt |
| `idle.fbx` + `walk.fbx` | 1,2 MB | Konversi ke klip GLB/JSON yang sudah di-retarget (lebih kecil, parse jauh lebih cepat dari FBXLoader) |
| Set 3D (4 set) | ~1,4 MB | Lightmap WebP sudah kecil; opsional KTX2 untuk memori GPU |
| Bundle JS | 1,04 MB (289 KB gzip) | Pisahkan `FBXLoader` / halaman `sets-preview` dari bundle utama |

---

## 5. Yang sudah baik (pertahankan)

- Loop render tunggal di `gsap.ticker`, dibatasi 72 fps di layar >100 Hz.
- Resolusi turun otomatis kalau frame terus lambat (`adaptResolution`).
- Canvas set 3D hanya menggambar saat kamera bergerak.
- Animasi UI memakai `transform`/`opacity`. Tidak ada `transition: all`.
- Pick avatar lewat `readPixels` di sekitar klik, bukan raycast ke mesh skinned.
- Variabel animasi didaftarkan `@property … inherits: false`, jadi tidak memicu recalc anak-anak
  elemen.
- Reduced motion dihormati di semua animasi baru (memo, Journey, dasi).

---

## 6. Yang belum terverifikasi

- **HP kelas menengah** (layar 120 Hz, budget 8 ms per frame) dan **layar retina**: semua angka di
  atas berasal dari laptop dengan layar skala 1×.
- **Safari**: `backdrop-filter` pada kartu kaca biasanya jauh lebih mahal di sana.
- Angka GPU antar-run bervariasi ±100 ms/s. Perbandingan penting sudah diulang 2×, tapi
  perubahan di bawah ~15% sebaiknya dianggap belum pasti.

---

## 7. Urutan implementasi yang disarankan

1. **P1 + P2**: kecil, aman, dampak terbesar di halaman detail.
2. **P4**: kecil, aman, dampak besar di Home.
3. Ukur ulang dengan skrip yang sama. Bandingkan tabel baseline di §3.
4. **P6 opsi 1** (DPR 1,5 di retina) setelah dites di perangkat retina.
5. **P7, P8** sesuai kebutuhan: P8 kalau waktu muat di HP jadi perhatian.

---

## 8. Hasil implementasi P1, P2, P4 (22 Oktober 2026)

Diukur ulang dengan skrip yang sama, di perangkat dan keadaan yang sama dengan baseline.

| Perbaikan | Yang diubah | Sebelum | Sesudah |
|---|---|---|---|
| P1 | `ui.js` `renderNarration()`: cincin maju dalam langkah 1/12 detik (`RING_HZ = 12`) | Repaint #document 104/s, paint 16,7 ms/s | Repaint #document 22/s (12 dari cincin, sisanya pergantian cue), paint 3,0 ms/s |
| P2 | `style.css`: kata subtitle putih, yang belum diucapkan diredupkan `opacity: 0.7`; transisinya `opacity 100ms` | Transisi `color` (paint) | Transisi `opacity` (composite). Tampilan sama: putih 70% di atas latar subtitle |
| P1+P2 | Halaman detail saat narasi berjalan | GPU ~620 ms/s (516–690), p95 13,8 ms, style ~44 ms/s | GPU **316–362 ms/s**, p95 **7,2 ms**, style 9,5 ms/s |
| P4 | `motion.js` `cardParallax()`: satu tulisan per tick untuk kedua sumbu, nilai sudah dibulatkan ke piksel kartu, dan ditulis hanya saat piksel itu berubah | 5.504 tulisan `--px` / 3 s, style 85 ms/s | **33** tulisan `--px` / 3 s, style **63–67 ms/s** (−23%) |

Catatan:

- Angka GPU halaman detail diambil dari jendela ukur kedua (narasi diulang dari awal). Jendela
  pertama masih menangkap animasi masuk panel Skills, jadi lebih tinggi (575–678 ms/s).
- P4 tidak mencapai estimasi −38%. Beberapa `setProperty` dalam satu frame hanya memicu satu style
  recalc, jadi yang berpengaruh adalah jumlah frame yang berubah, bukan jumlah tulisan. Sisa style
  recalc saat kursor bergerak kini didominasi tilt kartu (`--rx`/`--ry`, ~400 tulisan/s), yaitu
  P5.
- Gerakan parallax identik saat kartu diam. Selama animasi masuk, pembulatan bisa berbeda maksimal
  1 px.

---

## 9. Hasil implementasi P5–P8 (22 Oktober 2026)

| # | Keputusan | Yang diubah | Hasil |
|---|---|---|---|
| P5 | Dirapikan, sisanya diterima | `hover.js` `cardTilt()`: `--rx`/`--ry` ditulis sekali per tick, tidak lagi dua kali (pola yang sama dengan P4) | Style recalc Home saat kursor bergerak: **86 → 49 ms/s** (P4 + P5). Sisanya satu recalc per frame selama efek hover (tilt, sheen, ikon, panah) bergerak. Biayanya ~0,6 ms per recalc, apa pun elemennya: sudah diuji dengan mematikan `card-float` dan `backdrop-filter`, hasilnya tidak berubah. Menguranginya lagi berarti menurunkan fps animasi hover, jadi tidak dikerjakan. |
| P6 | Adaptif, bukan batas tetap | `main.js`: resolusi turun kalau frame rata-rata > **22 ms** (sebelumnya 28 ms) selama 3 detik | Perangkat yang kuat (termasuk retina) tetap memakai resolusi penuh. Perangkat yang tidak sanggup turun resolusinya sebelum terasa patah-patah (< ~45 fps), bukan baru di < ~36 fps. Batas DPR 1,5 tidak dipakai karena akan menurunkan ketajaman di retina yang kuat. **Belum dites di perangkat retina/HP.** |
| P7 | Sebagian | `tie.js`: garis dasi diukur sekali per frame (`hold()`), lalu `update()` frame berikutnya memakainya | Hasilnya identik: pose tubuh tidak berubah di antara kedua titik itu. Hemat ~2 ms/s. Hitungan matriks ganda (`vrm.update` + `renderer.render`) **tidak diubah**, karena berisiko pada spring bone dan dasi, sementara hematnya hanya ~10–20 ms/s. |
| P8a | Dikerjakan | Animasi `idle`/`walk`: FBX → JSON yang sudah di-bake (`scripts/bake_clips.mjs`). `mixamo.js` tidak memakai `FBXLoader` lagi | Unduhan animasi **1.149 KB → 322 KB** (~90 KB gzip). Bundle JS **1.052 → 988 KB** (gzip 293 → 272 KB). Tidak ada parsing FBX saat load. Data klip identik (selisih maks. 5·10⁻⁷ untuk VRM 0.x dan 1.0, 53 track). |
| P8b | Diuji, tidak dipakai | Kompresi geometri meshopt (lossless) pada `avatar_v2.vrm` | File mentah 4,39 → 3,30 MB, tapi setelah gzip hanya 3,02 → 2,93 MB (−3%), ditambah decoder di browser. Tidak sepadan. Versi lossy (kuantisasi) bisa lebih kecil, tapi mengubah data mesh/morph. |
| P8c | Tidak dikerjakan | Tekstur KTX2 | Total tekstur hanya 1,9 MB (kebanyakan ≤ 1024 px). KTX2 butuh transcoder ~0,5 MB dan kompresinya lossy pada tekstur anime. |

Pengukuran sesudah semua perbaikan (jendela ukur kedua, narasi sudah berjalan, 3 run A/B selang-seling):

| Keadaan | Baseline (§3) | Sekarang |
|---|---|---|
| Home diam | GPU 263 ms/s, script 139 ms/s | GPU 269 ms/s, script 137 ms/s (tidak berubah, memang tidak ada yang diubah di sini) |
| Home, kursor bergerak | style 86 ms/s | style **49 ms/s** |
| Detail, narasi berjalan | GPU 620–820 ms/s, p95 13,8 ms | GPU **281–369 ms/s**, p95 **7,1 ms** |

Catatan pengukuran:
- Angka di laptop ini bisa melonjak 1,5–2× kalau ada aplikasi lain yang sibuk di latar belakang. Satu
  rangkaian pengukuran sempat menunjukkan script ~330 ms/s di semua keadaan. Run A/B selang-seling
  (kode lama vs baru, bergantian) menunjukkan kode lama dan baru setara, jadi lonjakan itu berasal
  dari lingkungan, bukan dari perubahan kode.
- File `public/animations/*.fbx` tetap disimpan sebagai sumber `bake_clips.mjs`, tapi tidak diunduh
  lagi oleh halaman. Setelah mengganti FBX, jalankan `node scripts/bake_clips.mjs` dari `web/`.
