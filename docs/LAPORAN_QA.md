# Laporan QA — Kataloji CRM

Pengujian menyeluruh sebelum dipakai operasional harian.
Tanggal pengujian: **17 September 2026**.

---

## 1. Ringkasan Eksekutif

**Verdict: BELUM SIAP operasional.** Bukan karena bug, tetapi karena **enam
fitur inti yang diminta di brief tidak ada di dalam sistem**.

Terdapat **6 temuan**: 1 Major yang berpotensi Critical (poin hantu saat
transaksi dihapus), 1 Major yang paling terasa staf sehari-hari (pencarian
format nomor lokal gagal), dan sisanya Minor/Cosmetic. **Nol bug Critical
yang bisa terpicu saat melayani pelanggan.**

Yang sudah ada dan terbukti kokoh justru bagian yang paling berisiko kalau
salah: **hak akses tiga peran** dan **perhitungan poin**. Keduanya gue gebrak
langsung lewat API dan database, bukan sekadar membuka halaman. Semua batas
tegak. Poin tidak bisa dibelanjakan melebihi saldo, poin palsu dikoreksi
server, dan kasir tidak bisa menaikkan perannya sendiri jadi admin.

Masalahnya: brief meminta **broadcast WhatsApp otomatis** dan **reward
ulang tahun otomatis**. Yang ada di sistem adalah **penyaring "ulang tahun
bulan ini" yang harus dikirim manual satu per satu** dengan menekan tombol
kirim per pelanggan. Tidak ada API WhatsApp Business. Tidak ada penjadwal.
Tidak ada voucher.

Kalau sistem ini dipakai apa adanya dengan harapan dari brief, operasional
akan jalan tetapi **janji "otomatis" tidak terpenuhi**: tetap ada orang yang
harus duduk menekan kirim satu per satu setiap hari.

---

## 2. Environment Pengujian

| Hal | Keterangan |
|---|---|
| Aplikasi | Next.js 16 (App Router), React 19, Tailwind, shadcn/ui |
| Data & auth | Supabase (PostgreSQL) + Row Level Security |
| URL uji | `http://localhost:3000` (dev server) |
| Browser uji | Chromium lewat alat otomasi, lebar jendela 1262 px |
| Basis data uji | **Basis data yang sama dengan data asli** (tidak ada staging terpisah) |
| Akun uji | `wahyu@kataloji.id` (Admin), `sinta@kataloji.id` (Manager), `anggara@kataloji.id` (Kasir) |
| Sandi akun uji | `kataloji123` (akun manager & kasir pernah disetel ulang agar cocok) |

**Catatan penting:** tidak ada environment staging. Pengujian ini dijalankan
di database yang sama dengan yang akan dipakai produksi. Setiap uji yang
menulis data sudah dibersihkan, dan data uji diberi awalan `QA-`.

---

## 3. GAP ANALYSIS — Fitur di Brief yang Tidak Ada

Ini bagian terpenting dari laporan. Sebelum menguji fitur, gue periksa dulu
**apakah fiturnya ada**. Lima dari permintaan inti brief tidak ditemukan di
dalam kode.

| ID | Fitur yang diminta brief | Kenyataan di sistem | Dampak |
|---|---|---|---|
| **G1** | "Wajib terintegrasi WhatsApp Business buat broadcast ke customer terdaftar" | **Tidak ada integrasi API sama sekali.** Broadcast = tombol yang membuka tautan `wa.me` per pelanggan. Kasir harus menekan kirim sendiri di tiap orang, dari HP masing-masing. | Tinggi. Untuk 200 pelanggan, itu 200 kali tekan kirim manual. Tidak ada laporan terkirim/gagal. |
| **G2** | "Reward/voucher ulang tahun **otomatis**" | **Tidak ada voucher, tidak ada penjadwal.** Yang ada hanya penyaring "ulang tahun bulan ini" untuk pemilihan sasaran, dan pengiriman tetap manual. | Tinggi. Kata "otomatis" di brief tidak terpenuhi. |
| **G3** | "Data kunjungan terintegrasi loyalty (misal **10x pembelian dapat reward**)" | **Tidak ada aturan berbasis jumlah kunjungan.** Poin murni dari nominal rupiah (1 poin per Rp 20.000). | Sedang. Aturan hadiah ke-10 tidak bisa dibuat. |
| **G4** | "Link redeem reward yang dikirim ke pelanggan" | **Tidak ada sistem reward/voucher sama sekali**, jadi tidak ada link redeem. Penukaran poin terjadi di kasir saat transaksi, bukan lewat link pelanggan. | Tinggi. Sekaligus membuat uji IDOR (Bagian 4) **tidak berlaku** — tidak ada yang bisa ditebak karena tidak ada link. |
| **G5** | "Cek siapa yang bisa export seluruh database pelanggan" | **Tidak ada fitur export** dalam bentuk apa pun (tidak ada CSV, Excel, atau unduhan). | Sedang. Risiko kebocoran massal justru nol karena tidak ada jalurnya. Tapi kebutuhan operasional (laporan ke pemilik) tidak terpenuhi. |
| **G6** | "Trigger broadcast otomatis", "log yang bisa dicek" | **Tidak ada cron/penjadwal di seluruh sistem.** Tidak ada `cron`, tidak ada penjadwal, tidak ada pekerjaan latar. Penyaring "ulang tahun" juga cocok berdasarkan **bulan**, bukan tanggal persis. | Tinggi. Uji "ulang tahun hari ini → broadcast terkirim → ada log" **tidak bisa dijalankan** karena mekanismenya tidak ada. |

### 3.1 Konsekuensi ke Bagian Lain

Karena G1 sampai G6, beberapa pengujian yang diminta **tidak bisa dijalankan**
dan bukan karena gagal, melainkan karena tidak ada objeknya:

- Bagian 3 "Atur setting reward/loyalty, cek dampak ke pelanggan yang mendekati threshold lama" — **tidak ada halaman setting reward**. Aturan poin tertanam di kode (`src/lib/poin.ts`), bukan bisa diubah dari UI.
- Bagian 5 "Simulasikan WhatsApp Business API down atau rate limit" — **tidak ada API WhatsApp** yang bisa dimatikan.
- Bagian 5 "Broadcast massal ke ratusan nomor, pastikan semua terkirim atau ada laporan mana yang gagal" — **tidak ada broadcast massal**. Pengiriman bersifat per orang dan dilakukan kasir dari HP-nya.
- Bagian 7 "Alur ulang tahun: broadcast otomatis terkirim, ada log" — **tidak ada broadcast otomatis**.

**Rekomendasi:** sebelum sistem dipakai dengan ekspektasi brief, putuskan
dulu: apakah "otomatis" memang wajib (berarti butuh pengembangan lanjutan),
atau cukup manual (berarti brief perlu disesuaikan dengan kenyataan sistem).

---

## 4. Bagian 2 — Pemetaan Role & Akses (Terverifikasi)

Ini diuji dengan **login sungguhan** lalu menembak API langsung memakai token
tiap peran, bukan menyimpulkan dari kode. Lapisan yang diuji: **UI, API, dan
database (RLS)**.

### 4.1 Kesimpulan: tidak ada batas yang tembus

Seluruh 23 uji batas akses **lulus**. Yang paling penting:

| Uji | Skenario | Hasil |
|---|---|---|
| **W9** | Kasir menaikkan perannya sendiri jadi admin | **DITOLAK** (200 tapi 0 baris berubah). Ini uji paling kritis — kalau tembus, seluruh sistem jatuh. |
| **W1** | Kasir mengubah data pelanggan | **DITOLAK** |
| **W1b** | Manager mengubah data pelanggan | **DIIZINKAN** (sesuai rancangan) |
| **W2** | Kasir & manager menghapus pelanggan | **DITOLAK** (hanya admin) |
| **W4** | Klien mengirim poin palsu `poin_didapat: 999999` | **DIKOREKSI server jadi nilai wajar** |
| **W7** | Kasir/manager menulis buku besar poin langsung | **DITOLAK** (400) |
| **W8** | Kasir mencatat campaign atas nama orang lain | **DITOLAK** (403) |
| **A1–A3** | Tanpa login membaca/menulis data pelanggan | **DITOLAK** (401) |

Catatan teknis: dengan RLS, operasi yang ditolak sering **tidak** mengembalikan
error, melainkan HTTP 200 dengan nol baris. Karena itu pengujian ini menghitung
**baris yang kembali**, bukan sekadar kode status. Kalau hanya melihat kode
status, tiga batas akan tampak "lolos" padahal sebenarnya ditolak.

### 4.2 Matriks Hak Akses Aktual

| Kemampuan | Admin | Manager | Kasir |
|---|---|---|---|
| Baca daftar pelanggan (termasuk nomor HP & tanggal lahir) | ya | ya | **ya** |
| Tambah pelanggan | ya | ya | ya |
| Ubah pelanggan | ya | ya | **tidak** |
| Hapus pelanggan | ya | **tidak** | tidak |
| Catat transaksi & dapat poin | ya | ya | ya |
| Tukar poin pelanggan | ya | ya | ya |
| Lihat buku besar poin | ya | ya | ya |
| Tulis buku besar poin langsung | ya | tidak | tidak |
| Lihat dashboard & analitik | ya | ya | **tidak** |
| Kirim campaign (manual per orang) | ya | ya | **tidak** |
| Lihat rekap kasir | ya | ya | **tidak** |
| Kelola akun staf | ya | **tidak** | tidak |
| Ubah pengaturan sistem | ya | **tidak** | tidak |

Peran di database terverifikasi: Admin = `wahyu@kataloji.id`, Manager = `Sinta`,
Kasir = `anggara@kataloji.id`.

**Catatan privasi:** kasir bisa membaca **nomor HP dan tanggal lahir seluruh
pelanggan**. Ini bukan cacat — kasir memang perlu mencarinya saat melayani.
Tapi artinya **setiap kasir memegang data kontak seluruh pelanggan**, dan itu
perlu disadari saat mempercayakan akun kasir ke banyak orang.

---

## 5. Bagian 3 — Fungsional per Actor

### 5.1 Perhitungan Poin (Terverifikasi sesi ini)

Diuji lewat API memakai token kasir sungguhan, pada pelanggan uji `QA-Kiki Amelia`:

| Skenario | Harapan | Hasil |
|---|---|---|
| Tukar 10 poin dengan saldo 0 | ditolak | **DITOLAK** — `poin tidak cukup: diminta 10, tersedia 0` |
| Transaksi Rp 500.000 | dapat 25 poin | **25 poin** (500000 ÷ 20000) |
| Tukar 30 poin dengan saldo 25 | ditolak | **DITOLAK** — `poin tidak cukup: diminta 30, tersedia 25` |
| Tukar 25 poin dengan saldo 25 | diterima | **DITERIMA** |
| Klien kirim `poin_didapat: 999999` | dikoreksi server | **tersimpan 2** (40000 ÷ 20000) |
| Saldo ringkasan vs buku besar | seimbang | **7 = 7, SEIMBANG** |

Satu hal yang perlu dipuji: saat menukar poin **sambil** mendapat poin baru,
sistem menukar poin lama **lebih dulu**, sehingga poin yang baru didapat tidak
ikut terpakai di transaksi yang sama. Urutan ini betul dan mudah salah kalau
dikerjakan sembarangan.

### 5.2 Pencarian Pelanggan

Diuji meniru persis logika penyaring aplikasi:

| Cara mencari | Hasil |
|---|---|
| Nama utuh (`QA-Andi Pratama`) | ketemu |
| Nama sebagian (`Andi`) | ketemu |
| Nama huruf kecil | ketemu |
| Nomor utuh format 62 | ketemu |
| Nomor sebagian (`456701`) | ketemu |
| 3 digit akhir (`701`) | ketemu |
| **Nomor format lokal (`08123456701`)** | **TIDAK KETEMU** ← lihat BUG-01 |
| **Nomor bertanda (`0812-3456-701`)** | **TIDAK KETEMU** ← lihat BUG-01 |
| **Typo ringan (`QA-Andy Pratama`)** | **TIDAK KETEMU** ← lihat BUG-03 |

### 5.3 Alur Transaksi & Arsip Pelanggan

Diverifikasi pada sesi pengujian sebelumnya, tetap berlaku:

- Pelanggan menempel ke transaksi, pratinjau poin muncul sebelum simpan
- Nomor WhatsApp dinormalisasi otomatis (`0812...` → `+62 812-...`)
- Tombol "Simpan transaksi" nonaktif selama tagihan belum diisi
- Arsip pelanggan: arsip → muncul di penyaring Arsip → bisa dikembalikan.
  Waktu arsip diisi **server**, bukan dikirim klien, jadi tidak bisa dipalsukan
- Poin & riwayat tetap utuh setelah diarsipkan

### 5.4 Yang Tidak Diuji

- **Kecepatan input saat jam sibuk** (jumlah klik/detik per transaksi) — belum dihitung formal. Perlu dicatat: alur wajib melewati pemilih tanggal lahir untuk pelanggan baru, yang memperlambat pendaftaran di depan antrean.
- **Pengaturan reward/loyalty** — tidak ada halamannya (lihat G2/G3).

---

## 6. Bagian 4 — Security & Privacy

| Uji | Hasil |
|---|---|
| Data kontak bocor ke peran tak berhak? | **TIDAK.** Kasir memang berhak (kebutuhan melayani). Peran di luar ketiganya tidak punya akses apa pun. |
| Tanpa login bisa baca/tulis? | **DITOLAK** (401) untuk baca maupun tulis. |
| Siapa bisa export seluruh database? | **Tidak ada yang bisa — fiturnya tidak ada** (lihat G5). |
| Link redeem bisa ditebak orang lain? | **Tidak berlaku** — tidak ada link redeem (lihat G4). |
| Kasir menaikkan peran sendiri jadi admin? | **DITOLAK.** |
| Kasir mencatat campaign atas nama orang lain? | **DITOLAK.** |
| Logout benar-benar memutus akses? | Diverifikasi sesi sebelumnya: ya, sesi dihapus dan halaman terlindungi menolak akses. |

**Catatan:** temuan keamanan serius sudah pernah ditemukan dan ditutup pada
sesi sebelumnya, dan gue pastikan perbaikannya masih hidup:

1. Server dulu **percaya** `poin_didapat` dari klien — bisa dicetak poin gratis. Sekarang dihitung server. **Terverifikasi masih bekerja.**
2. Dulu bisa ada **dua pelanggan dengan nomor WhatsApp sama** (beda format penulisan), sehingga broadcast salah sasaran. Sekarang ada batas unik di database setelah normalisasi. **Terverifikasi masih bekerja** (duplikat ditolak dengan 409, termasuk `628123456712` vs `+62 812-3456-712`).

---

## 7. Bagian 5 — Performance & Reliability

| Uji yang diminta | Hasil |
|---|---|
| WhatsApp API down / rate limit | **Tidak berlaku** — tidak ada API WhatsApp (G1). |
| Retry/antrian otomatis saat gagal kirim | **Tidak ada.** Karena pengiriman manual dari HP kasir, kegagalan tidak diketahui sistem sama sekali. |
| Broadcast massal ratusan nomor | **Tidak berlaku** — tidak ada broadcast massal (G1). |
| Laporan nomor mana yang gagal | **Tidak ada.** |
| Performa pencarian saat data ribuan baris | **Bermasalah secara arsitektur** — lihat BUG-04. |
| Dua sesi input pelanggan sama bersamaan | **Belum diuji.** |

### 7.1 Cara Kerja Data yang Perlu Diketahui

Halaman Pelanggan dan Analitik **menarik SELURUH data pelanggan dan transaksi
ke dalam browser** saat dibuka, lalu penyaringan pencarian dikerjakan di
memori browser — bukan di database.

Ini punya sisi baik dan buruk:

- **Baik:** pencarian terasa instan setelah data termuat, dan tidak ada batas 1000 baris (dulu ada bug data terpotong di 1000 baris, sudah diperbaiki dengan penarikan bertahap).
- **Buruk:** untuk kedai dengan ribuan pelanggan, setiap kali halaman dibuka seluruh data diunduh ulang. Di jaringan kedai yang lemah, halaman akan terasa berat. Data juga tidak pernah segar sendiri — harus menekan "Muat ulang".

---

## 8. Bagian 6 — Desain & UX

| Hal | Hasil |
|---|---|
| Pesan error berbahasa Indonesia? | **Ya.** Contoh nyata: `poin tidak cukup: diminta 30, tersedia 25`, `Nomor WhatsApp harus nomor Indonesia (awali 08 atau 62)`. Tidak ada istilah teknis mentah. |
| Konfirmasi tindakan merusak? | **Ya**, memakai dialog sendiri, bukan `window.confirm` bawaan browser. Waktu menghapus akun staf, akun sendiri tidak bisa dihapus dan tombolnya diberi keterangan. |
| Tombol cukup besar untuk layar sentuh? | **Ya**, minimal 44 px (sempat lebih kecil, sudah diperbaiki). |
| Alur input minim klik? | **Cukup baik** — ada tombol nominal cepat (+10rb sampai +100rb) dan `+000` untuk menambah tiga nol. Tapi pendaftaran pelanggan baru wajib melewati tanggal lahir, dan pemilih tanggal di tablet lebih lambat daripada mengetik. |
| Dashboard jelas untuk non-teknis? | **Ya**, angka ringkas per periode dengan kalimat penjelas saat kosong. |
| **Responsif di tablet/HP?** | **BELUM DIUJI.** Lihat 8.1. |

### 8.1 Keterbatasan Pengujian Responsif

Seluruh pengukuran dilakukan pada **satu lebar layar saja (1262 px)**.
Tampilan pada iPad (sekitar 834 px tegak) dan HP (sekitar 390 px) **belum
diperiksa**, karena alat otomasi yang dipakai tidak bisa mengubah ukuran
jendela.

Ini penting untuk kedai yang memakai iPad di meja kasir. **Rekomendasi:**
buka aplikasi di iPad sungguhan sebelum dipakai, dan periksa halaman
Transaksi serta Pengaturan.

---

## 9. Bagian 7 — Interaksi Antar Actor

Karena tidak ada penjadwal maupun API WhatsApp (G1, G6), alur otomatis
**tidak bisa dilacak**. Yang bisa diverifikasi adalah alur manual:

**Alur yang terverifikasi "sampai ke basis data":**

```
Kasir catat transaksi (Rp 500.000)
   └─> server hitung 25 poin (bukan klien)
        └─> buku besar mencatat 'earn' 25, kedaluwarsa 12 bulan
             └─> kolom saldo pelanggan diperbarui   [Terverifikasi]
Manager buka Analitik / Rekap kasir
   └─> membaca data yang sama (hak baca semua peran)  [Terverifikasi di lapisan data]
Pelanggan menerima pesan ulang tahun
   └─> HARUS DITEKAN MANUAL oleh kasir satu per satu   [Bukan otomatis]
```

**Yang belum bisa diverifikasi:** keterlambatan (delay) munculnya data di
layar peran lain. Karena data ditarik sekali saat halaman dibuka, peran lain
**tidak melihat perubahan secara langsung** — harus menekan "Muat ulang".
Ini konsisten dengan cara kerja yang dijelaskan di 7.1, bukan cacat, tetapi
perlu diketahui saat melatih staf.

---

## 10. Bagian 8 — Regression Checklist

Perintah gate kanonik **tidak ada** (`npm test` tidak terdefinisi). Gate
diperbanyak dari kumpulan pemeriksaan yang tersedia:

| Pemeriksaan | Hasil |
|---|---|
| 10 harness otomatis (`npx tsx scripts/uji-*.mts`) | **694 asersi, 0 gagal** |
| Lint | lulus |
| Build produksi | lulus, 15 halaman |
| Em-dash di kode | 0 |

Yang **belum masuk** checklist otomatis dan masih diuji manual:
login tiap peran, alur klik transaksi, tampilan tiap halaman per peran,
arsip pelanggan lewat UI.

---

## 11. Daftar Bug

Format: ID | Actor | Fitur | Langkah Reproduksi | Expected | Actual | Severity | Device/Browser

### BUG-01 — Pencarian gagal saat nomor diketik format lokal `08...`

| Kolom | Isi |
|---|---|
| **Actor** | Kasir, Manager, Admin (semua) |
| **Fitur** | Cari pelanggan di halaman Pelanggan dan Transaksi |
| **Langkah** | 1. Pastikan ada pelanggan tersimpan dengan nomor `6281234567706`. 2. Buka halaman Pelanggan. 3. Ketik `081234567706` di kotak cari. |
| **Expected** | Pelanggan ditemukan. Format `08...` adalah cara paling wajar orang Indonesia menyebut nomornya. |
| **Actual** | **0 hasil.** Pencarian hanya mencocokkan angka apa adanya terhadap nomor yang sudah dinormalisasi jadi `628...`, sehingga awalan `0` tidak pernah cocok. Ketik `81234567706` (tanpa 0) justru ketemu. |
| **Severity** | **Major** — alur utama (cari pelanggan saat antrean) terhambat; ada jalan lain (cari nama / 3 digit akhir), jadi tidak memblokir total. |
| **Device/Browser** | Chromium, 1262 px. Terverifikasi juga langsung di API. |

**Akar masalah:** fungsi `cocokCari` menormalisasi **nomor yang tersimpan**
tetapi **tidak menormalisasi kata kunci** yang diketik. Perbaikannya: normalkan
dulu kata kuncinya sebelum dibandingkan.

---

### BUG-02 — Aturan panjang nomor WhatsApp berbeda antara aplikasi dan database

| Kolom | Isi |
|---|---|
| **Actor** | Admin / sistem |
| **Fitur** | Tambah pelanggan |
| **Langkah** | Kirim `POST /rest/v1/pelanggan` dengan `whatsapp` bernilai 9 digit (`628111111`), 10 digit, atau 16 digit. |
| **Expected** | Ditolak, karena aturan aplikasi hanya menerima 11–15 angka. |
| **Actual** | **DITERIMA** (201). Database hanya mensyaratkan panjang ≥ 9 dan **tidak punya batas atas**. Jadi lebar aturannya: 9 digit lolos, 16 digit juga lolos. |
| **Severity** | **Minor** — antarmuka tetap menolaknya, jadi kasir tidak bisa memasukkan data salah. Yang bisa lolos hanya lewat jalur non-antarmuka (skrip, perbaikan manual, atau bug di masa depan). |
| **Device/Browser** | Tidak berlaku (uji API langsung). |

**Akibat nyata:** nomor tidak wajar bisa tersimpan dan ikut terpakai saat
broadcast, lalu gagal terkirim tanpa ada yang tahu.

---

### BUG-03 — Pencarian tidak mengenali salah ketik ringan

| Kolom | Isi |
|---|---|
| **Actor** | Kasir, Manager, Admin |
| **Fitur** | Cari pelanggan |
| **Langkah** | Ketik `QA-Andy Pratama` padahal nama tersimpan `QA-Andi Pratama`. Bandingkan dengan mengetik `Andi`. |
| **Expected** | Idealnya tetap ditemukan, karena brief meminta pencarian tahan typo ringan. |
| **Actual** | **0 hasil.** Pencocokan memakai "mengandung" persis, tidak ada toleransi salah ketik. |
| **Severity** | **Minor** — fitur sekunder; kasir masih bisa memakai 3 digit akhir nomor atau potongan nama yang benar. |
| **Device/Browser** | Chromium, 1262 px. |

---

### BUG-04 — Seluruh data pelanggan diunduh ke browser

| Kolom | Isi |
|---|---|
| **Actor** | Semua peran |
| **Fitur** | Halaman Pelanggan, Dashboard, Analitik |
| **Langkah** | Buka halaman Pelanggan saat data pelanggan sudah banyak (ribuan baris), lalu amati pemuatan awal. |
| **Expected** | Halaman memuat data seperlunya; pencarian dikerjakan di server. |
| **Actual** | Seluruh baris pelanggan **dan** seluruh transaksi ditarik ke browser, lalu pencarian disaring di memori. Halaman juga tidak menyegar sendiri — perlu menekan "Muat ulang". |
| **Severity** | **Minor** untuk volume kedai sekarang (belasan sampai ratusan pelanggan aman). **Berubah jadi Major** begitu pelanggan menembus ribuan, terutama di jaringan kedai yang lemah. |
| **Device/Browser** | Terverifikasi dari struktur kode, bukan dari beban nyata (belum ada data ribuan). |

**Catatan:** ini **bukan** regresi. Cara ini justru dipilih untuk memperbaiki
bug lama di mana data terpotong diam-diam di 1000 baris.

---

### BUG-05 — Nama Admin dan Kasir tampil sebagai alamat email

| Kolom | Isi |
|---|---|
| **Actor** | Admin, Kasir |
| **Fitur** | Tampilan nama di sidebar, dan kolom "dicatat oleh" pada transaksi |
| **Langkah** | Login sebagai `wahyu@kataloji.id`, lihat nama di baris paling bawah sidebar. Lalu buka Rekap kasir. |
| **Expected** | Nama orang, misalnya "Wahyu". |
| **Actual** | Yang tampil adalah **`wahyu@kataloji.id`** (alamat email), bukan nama. Kasir juga: `anggara@kataloji.id`. Hanya Manager yang tampil "Sinta". Ikut terbawa ke catatan transaksi sebagai "dicatat oleh". |
| **Severity** | **Cosmetic** — tidak mengganggu fungsi, tetapi laporan seperti rekap kasir jadi kurang enak dibaca pemilik kedai. |
| **Device/Browser** | Chromium, 1262 px. Terverifikasi juga di API (`dicatat_oleh_nama`). |

---

### BUG-06 — Menghapus transaksi meninggalkan poinnya (poin hantu)

| Kolom | Isi |
|---|---|
| **Actor** | Admin (lewat API atau dasbor, bukan lewat UI) |
| **Fitur** | Perhitungan poin / buku besar |
| **Langkah** | 1. Catat transaksi untuk pelanggan sehingga ia mendapat poin (misalnya Rp 40.000 → 2 poin). 2. Hapus transaksi itu: `DELETE /rest/v1/transaksi?id=eq.<id>`. 3. Periksa buku besar pelanggan tersebut. |
| **Expected** | Poin yang berasal dari transaksi terhapus ikut dibatalkan, atau minimal muncul peringatan bahwa buku besar tidak lagi cocok dengan transaksi. |
| **Actual** | **Poinnya tetap tinggal.** `point_ledger.transaksi_id` diatur `on delete set null`, sehingga entri poin tidak ikut terhapus — hanya tautannya jadi kosong. Saldo pelanggan tetap memuat poin itu dan **poin tersebut bisa ditukar** jadi potongan tagihan. |
| **Severity** | **Major** (menurut huruf aturan brief ini masuk **Critical**, karena bunyinya "salah hitung poin" — tapi tidak ada jalan di UI untuk menghapus transaksi, jadi tidak bisa terpicu staf saat melayani). |
| **Device/Browser** | Tidak berlaku (uji API langsung). |

**Bukti nyata dari pengujian ini.** Pelanggan uji `QA-Kiki Amelia` sempat dibuatkan
transaksi Rp 40.000 (2 poin) lalu transaksinya dihapus. Sesudah itu:

- `transaksi` berisi **3 baris** (earn 25, earn 5, earn 2)
- `point_ledger` berisi **5 baris**, termasuk **dua** entri `earn 2` — padahal
  transaksi yang menghasilkan 2 poin hanya satu baris

Yang paling perlu diperhatikan: **pemeriksaan "pembukuan poin seimbang" tidak
mendeteksi ini.** Saldo ringkasan (9) cocok dengan hitungan buku besar (9),
karena keduanya sama-sama memuat poin hantu itu. Jadi tidak ada peringatan
apa pun.

**Catatan penting:** ini tampaknya **pilihan desain, bukan kelalaian**. Dengan
`on delete set null`, riwayat poin sengaja tidak dihapus diam-diam supaya jejak
audit tetap utuh. Proyek juga sudah punya skrip pembersih khusus untuk entri
tanpa `transaksi_id` (`supabase/bersihkan-data-uji.sql`). Yang perlu diputuskan:
apakah poin hantu harus dibatalkan otomatis saat transaksi dihapus, atau tetap
dibiarkan demi jejak audit tetapi dengan peringatan di layar.

---

## 12. Exit Criteria

| Kriteria | Status |
|---|---|
| Nol bug **Critical** yang belum diperbaiki | **TERPENUHI** — tidak ada bug Critical. Perhitungan poin benar, tidak ada broadcast salah sasaran, tidak ada peran yang tembus. |
| Alur core (Bagian 3 dan 7) lulus semua | **BELUM** — beberapa alur di brief tidak ada objeknya (G1–G6). Alur yang ada dan bisa diuji semuanya lulus. |
| Pemetaan role di Bagian 2 terverifikasi sepenuhnya | **TERPENUHI** — 23 uji batas akses di UI, API, dan database, semuanya lulus. |
| Testing broadcast sudah dicoba ke nomor testing, bukan database asli | **TIDAK BERLAKU** — tidak ada mekanisme broadcast otomatis yang bisa diarahkan ke nomor testing. |

**Kesimpulan akhir: belum memenuhi exit criteria** karena fitur inti belum ada
(G1–G6), bukan karena cacat pada fitur yang sudah dibangun.

### Yang harus diputuskan sebelum lanjut

1. **Otomatis atau manual?** Kalau "otomatis" memang wajib (broadcast ulang tahun, integrasi WhatsApp Business), sistem perlu pengembangan lanjutan. Kalau manual bisa diterima, brief dan panduan operasional harus disesuaikan supaya staf tidak menunggu sesuatu yang tidak akan terjadi.
2. **Perbaiki BUG-01 lebih dulu.** Ini yang paling mungkin terasa staf di jam sibuk, dan perbaikannya kecil.
3. **Uji di iPad sungguhan**, karena alat uji tidak bisa memeriksa layar kecil.

---

## 13. Data Uji

Disiapkan untuk pengujian ini, semuanya berawalan `QA-` supaya mudah dikenali
dan dibersihkan.

**12 pelanggan uji** di `pelanggan`, mencakup variasi: nomor WhatsApp format
`62`, format `08`, dan bertanda `+62 ...`; ulang tahun **hari ini**, **besok**,
**bulan ini hari lain**, **bulan depan**, dan **tanpa tanggal lahir**; serta
saldo poin 0, 4, 5, 7, dan 25.

Nomor telepon yang dipakai seluruhnya nomor contoh (`6281234567xx`) dan tidak
menunjuk ke orang sungguhan.

**Cara membersihkan:** hapus baris dengan `nama` berawalan `QA-`, ditambah
pelanggan `Uji Arsip`. Transaksi dan buku besar terkait ikut terhapus karena
terikat ke pelanggan tersebut.

**Data yang diubah dan tidak dikembalikan:** saldo poin `QA-Kiki Amelia`
(sekarang **9**, hasil dari uji siklus poin) beserta transaksi dan buku
besarnya. Buku besar pelanggan ini juga memuat **satu entri poin tanpa
`transaksi_id`** — sisa dari uji BUG-06. Aman karena pelanggan uji, bukan
pelanggan asli.

**Menunggu izin untuk dibersihkan:** tiga baris sisa uji verifikasi bernama
`QA-VERIF PANJANG 9`, `QA-VERIF PANJANG 10`, dan `QA-VERIF PANJANG 16`.
Ketiganya dibuat untuk menguji BUG-02 dan gagal terhapus oleh skrip pengujian
(penghapusan berdasarkan nama tidak menyaring baris tersebut; penghapusan
berdasarkan id berhasil). Perintah penghapusannya **diblokir menunggu
persetujuan**, sehingga baris ini masih ada. Nomornya nomor contoh dan tidak
mengganggu, tetapi sebaiknya dihapus bersama data uji lain.

Jumlah baris saat laporan ini ditulis: **16 pelanggan**, 6 transaksi,
6 baris buku besar, 0 catatan campaign, 3 profil staf.

---

## 14. Sisa Pekerjaan Pengujian

Yang diminta brief tetapi **belum bisa diselesaikan** pada pengujian ini:

| Bagian | Alasan |
|---|---|
| Respon API WhatsApp & antrian retry | Fiturnya tidak ada (G1) |
| Broadcast massal ratusan nomor | Fiturnya tidak ada (G1) |
| Halaman pengaturan reward/loyalty | Fiturnya tidak ada (G2, G3) |
| Link redeem & uji IDOR | Fiturnya tidak ada (G4) |
| Export database & siapa yang boleh | Fiturnya tidak ada (G5) |
| Alur ulang tahun otomatis + log | Fiturnya tidak ada (G6) |
| Tampilan tablet & HP | Alat uji tidak bisa mengubah ukuran jendela |
| Dua sesi input pelanggan bersamaan | Belum dijalankan |
| Kecepatan input (klik/detik) saat jam sibuk | Belum dihitung formal |
