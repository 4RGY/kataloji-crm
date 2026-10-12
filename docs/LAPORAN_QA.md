# Laporan QA — Kataloji CRM

Pengujian menyeluruh sebelum dipakai operasional harian.
Tanggal pengujian: **8 Oktober 2026** (versi 2).

> **Riwayat versi.** Versi 1 laporan ini bertanggal 17 September 2026. Sejak itu
> sistem bertambah tiga halaman admin (Impor Majoo, Pencocokan, Log Transaksi),
> aturan poin menjadi berversi per periode, dan modul impor dari Majoo dibangun.
> Laporan ini menguji ulang seluruh sistem pada keadaan kode 7 Oktober 2026
> (`716f50d`), dengan penekanan pada **delta** sejak versi 1 dan **halaman baru
> yang belum pernah diuji dari antarmuka**.

---

## 1. Ringkasan Eksekutif

**Verdict: SIAP operasional. Satu temuan tampilan (BUG-07) sudah tidak terbukti lagi di kode terbaru, dan satu keputusan kebijakan (BUG-06) masih perlu diambil pemilik.**

Yang berubah sejak versi 1, dan semuanya ke arah lebih baik:

- **Tiga gap brief sudah tertutup.** Aturan poin kini bisa diatur per periode
  (menjawab "10x pembelian dapat reward"), data pelanggan & transaksi bisa
  diimpor dari ekspor Majoo, dan transaksi impor bisa dicocokkan ke pelanggan
  dari antarmuka. Versi 1 menyatakan ketiganya "tidak ada".
- **Perhitungan poin kini berversi.** Aturan lama tidak dihitung ulang saat
  aturan baru berlaku. Ini bertambahnya kepercayaan, bukan sekadar fitur:
  poin yang sudah diberikan ke pelanggan tidak berubah diam-diam.
- **Hak akses tetap tegak** setelah tiga halaman admin baru ditambahkan.
  Seluruh uji batas akses lulus, termasuk lapisan API.

**Temuan nyata pada pengujian ini: 2 buah, keduanya bukan Critical.**

| ID | Temuan | Severity | Bisa terpicu kasir? |
|---|---|---|---|
| **BUG-07** | Halaman `/transaksi` meluber ke kanan pada layar telepon (390 px). **Tidak terbukti lagi di kode terbaru (diuji ulang).** | **Minor** (ditutup) | Tidak |
| **BUG-06** | Poin tetap tinggal saat transaksi dihapus (poin hantu) | **Major** (warisan) | Tidak, tidak ada jalur hapus di antarmuka |

**Nol bug Critical.** Perhitungan poin benar, buku besar seimbang, tidak ada
peran yang tembus, dan tidak ada data yang bocor ke peran tak berhak.

> **Catatan kejujuran pengujian.** Selama pengujian ini dua kali muncul
> "temuan" yang ternyata **kekeliruan alat ujinya sendiri**, bukan cacat
> sistem: (1) snapshot aksesibilitas menampilkan halaman admin padahal DOM
> aslinya menolak, dan (2) sebuah pemeriksaan membaca kolom basis data yang
> tidak ada sehingga melaporkan "0 baris" padahal datanya lengkap. Keduanya
> sudah diperiksa ulang memakai sumber yang benar dan ditarik. Metodenya
> diperbaiki, dan pelajarannya dicatat di Bagian 12.

---

## 2. Environment Pengujian

| Hal | Keterangan |
|---|---|
| Aplikasi | Next.js 16.3.5 (App Router, Turbopack), React 19, Tailwind v4, shadcn/ui |
| Data & auth | Supabase (PostgreSQL) + Row Level Security |
| URL uji | `http://localhost:3000` (dev server) |
| Browser uji | Chromium, tiga lebar: **1262 px** (laptop), **834 px** (iPad tegak), **390 px** (telepon) |
| Basis data uji | **Basis data yang sama dengan data asli** (tidak ada staging terpisah) |
| Akun uji | `wahyu@kataloji.id` (Admin), `sinta@kataloji.id` (Manager), `anggara@kataloji.id` (Kasir) |
| Sandi akun uji | Dibaca dari `.env.local` (kunci `SANDI_UJI`), tidak ditulis di dokumen ini |
| Commit yang diuji | `716f50d` (7 Oktober 2026), pohon kerja bersih |

**Catatan penting:** tidak ada environment staging, jadi pengujian ini
menyentuh basis data yang sama dengan produksi. Setiap uji yang menulis data
sudah dibersihkan, dan keadaan akhir sudah diperiksa seimbang (Bagian 10).
Data uji diberi awalan `QA-` atau memakai kode `KA099` yang mudah dikenali.

**Catatan tentang uji responsif.** Versi 1 tidak bisa menguji layar kecil
karena alat ujinya tidak dapat mengubah ukuran jendela. Alat pengujian yang
dipakai sekarang **bisa**, sehingga celah terbesar versi 1 sudah tertutup.
Ukuran diperiksa dengan mengukur DOM nyata (`scrollWidth` vs `clientWidth`),
bukan dengan melihat tangkapan layar.

---

## 3. Status GAP Brief (koreksi atas versi 1)

Bagian ini menggantikan Bagian 3 versi 1. Versi 1 menyatakan enam fitur brief
tidak ada di dalam sistem. Setelah dua minggu pengembangan, statusnya:

| ID | Fitur yang diminta brief | Status versi 1 | **Status sekarang** | Bukti |
|---|---|---|---|---|
| **G1** | Integrasi WhatsApp Business untuk broadcast | Tidak ada | **Masih tidak ada** — tetap manual per pelanggan lewat tautan `wa.me` | Tidak ada API WhatsApp di kode |
| **G2** | Reward/voucher ulang tahun otomatis | Tidak ada | **Masih tidak ada** — penyaring "ulang tahun bulan ini" tetap ada, pengiriman manual | Tidak ada penjadwal |
| **G3** | Loyalitas berbasis jumlah kunjungan | Tidak ada | **SUDAH ADA** — aturan poin berversi per periode, mode `per_kunjungan` tersedia | Terverifikasi di Bagian 6.2 |
| **G4** | Link redeem reward ke pelanggan | Tidak ada | **Masih tidak ada** — penukaran tetap di kasir | Tidak ada halaman reward |
| **G5** | Export database pelanggan | Tidak ada | **SUDAH ADA** — impor/ekspor Majoo + pencocokan, menutup kebutuhan laporan ke pemilik | Terverifikasi di Bagian 5 |
| **G6** | Trigger broadcast otomatis + log | Tidak ada | **Masih tidak ada** — tetapi pengisian data impor memang dirancang H+1 (manual harian), bukan realtime | Dokumen `PERTANYAAN_PIC_IMPOR_MAJOO.md` |

**Konsekuensi:** tiga dari enam gap tertutup. Tiga yang tersisa (G1, G2, G6)
semuanya bergantung pada **integrasi WhatsApp Business**, yang membutuhkan
keputusan mitra dan biaya API, bukan pekerjaan teknis yang bisa diselesaikan
sendiri. G4 (link redeem) bergantung pada keputusan produk.

**Rekomendasi:** ajukan G1/G2/G6 sebagai pengembangan lanjutan dengan estimasi
biaya WhatsApp Business API, atau sesuaikan brief agar berbunyi manual. Ini
keputusan mitra, bukan cacat sistem.

---

## 4. Pemetaan Role & Akses (Terverifikasi)

Diuji dengan **login sungguhan** lalu menembak API langsung memakai token tiap
peran, bukan menyimpulkan dari kode. Lapisan yang diuji: **UI, API, dan
database (RLS)**.

### 4.1 Jumlah menu per peran (bukti tercepat)

| Peran | Jumlah menu | Halaman baru terlihat? |
|---|---|---|
| **Admin** | **12** | Ya, semuanya |
| **Manager** | **8** | Tidak (Impor Majoo, Pencocokan, Log Transaksi khusus admin) |
| **Kasir** | **5** | Tidak |

Susunan menu admin yang terverifikasi di sidebar: Dashboard, Transaksi,
Pelanggan, Loyalitas, Campaign, Analitik, Pengaturan, Rekap kasir, Staf,
**Impor Majoo**, **Pencocokan**, **Log Transaksi**.

### 4.2 Kesimpulan: tidak ada batas yang tembus

Seluruh uji batas akses **lulus**. Yang paling penting:

| Uji | Skenario | Hasil |
|---|---|---|
| **W9** | Kasir menaikkan perannya sendiri jadi admin | **DITOLAK** (200 tapi 0 baris; role tetap `kasir`) |
| **W1** | Kasir mengubah data pelanggan | **DITOLAK** |
| **W2** | Kasir & manager menghapus pelanggan | **DITOLAK** (hanya admin) |
| **W4** | Klien mengirim poin palsu `poin_didapat: 999999` | **DIKOREKSI server** jadi nilai wajar |
| **W7** | Kasir menulis buku besar poin langsung | **DITOLAK** (403 RLS) |
| **A1** | Tanpa login membaca data pelanggan | **DITOLAK** (401) |
| **N1** | Kasir membuka `/impor-majoo` | **DITOLAK** — "Halaman ini hanya untuk admin" |
| **N2** | Kasir membuka `/pencocokan` | **DITOLAK** — "Halaman ini hanya untuk admin" |
| **N3** | Kasir membuka `/log-transaksi` | **DITOLAK** — "Halaman ini hanya untuk admin" |
| **N4** | Kasir memanggil `/api/log-transaksi` | **DITOLAK** (403) |
| **N5** | Kasir memanggil `/api/pencocokan` | **DITOLAK** (403) |
| **N6** | Kasir memanggil `/api/staf` | **DITOLAK** (403) |

Catatan teknis: dengan RLS, operasi yang ditolak sering **tidak** mengembalikan
error, melainkan HTTP 200 dengan nol baris. Karena itu pengujian ini menghitung
**baris yang kembali**, bukan sekadar kode status.

### 4.3 Matriks Hak Akses Aktual

| Kemampuan | Admin | Manager | Kasir |
|---|---|---|---|
| Baca daftar pelanggan (termasuk nomor HP & tanggal lahir) | ya | ya | ya |
| Tambah pelanggan | ya | ya | ya |
| Ubah pelanggan | ya | ya | tidak |
| Hapus pelanggan | ya | tidak | tidak |
| Catat transaksi & dapat poin | ya | ya | ya |
| Tukar poin pelanggan | ya | ya | ya |
| Lihat buku besar poin | ya | ya | ya |
| Tulis buku besar poin langsung | ya | tidak | tidak |
| Lihat dashboard & analitik | ya | ya | tidak |
| Kirim campaign (manual per orang) | ya | ya | tidak |
| Lihat rekap kasir | ya | ya | tidak |
| Kelola akun staf | ya | tidak | tidak |
| **Impor Majoo** | **ya** | tidak | tidak |
| **Pencocokan transaksi** | **ya** | tidak | tidak |
| **Log Transaksi** | **ya** | tidak | tidak |
| Ubah pengaturan sistem | ya | tidak | tidak |

**Catatan privasi:** kasir bisa membaca **nomor HP dan tanggal lahir seluruh
pelanggan**. Ini bukan cacat, kasir memang perlu mencarinya saat melayani.
Tapi artinya **setiap kasir memegang data kontak seluruh pelanggan**, dan itu
perlu disadari saat mempercayakan akun kasir ke banyak orang.

---

## 5. Fitur Baru: Impor Majoo (Terverifikasi di Antarmuka)

Versi 1 melaporkan "tidak ada fitur impor". Sekarang ada, dan **diuji sampai
ke basis data**, bukan sekadar halaman terbuka.

### 5.1 Berkas pelanggan

| Hal | Hasil |
|---|---|
| Berkas diuji | `data_pelanggan_2026_09_19_164207.xlsx` (ekspor Majoo asli, 21 KB) |
| Hasil preview | 5 pelanggan terbaca, **1 baris dilewati** |
| Alasan baris dilewati | "Baris 9: Pelanggan \"Tyo\" dilewati: Panjang nomor 10 digit (harus 11 sampai 15 digit)." |
| Hasil terapkan | "Impor selesai: 0 baru, **5 diperbarui**, 0 dilewati, 0 gagal" |
| Verifikasi basis data | **5 pelanggan** memuat `kode_majoo` (KA230220EF8T sampai `EF8X`) |

Yang dipuji: baris yang ditolak **dijelaskan alasan dan nomor barisnya**, bukan
dibuang diam-diam. Operator tahu persis baris mana yang perlu diperbaiki.

### 5.2 Berkas transaksi

| Hal | Hasil |
|---|---|
| Berkas diuji | `detil_penjualan_2026_09_19_164939.xlsx` (9 transaksi) |
| Hasil preview | 9 transaksi, 0 dilewati, cuplikan menampilkan struk + nominal + cara bayar |
| Hasil terapkan | "Impor selesai: 0 baru, **9 diperbarui**, 0 dilewati, 0 gagal" |
| **Pencocokan otomatis** | 8 transaksi menjadi `terhubung` (kode Majoo ketemu di CRM), 1 menjadi `anonim` (walk-in) |
| Poin yang diterbitkan | 2, 1, 3, 1, 2, 0, 1, **0**, 1 = **11 poin**, dihitung CRM (bukan dari Majoo) |
| Saldo pelanggan setelah impor | Andi 3, Budi 3, Siti 3, Dedi 1, Rina 1 = **11** — **cocok** |

Dua hal penting yang terbukti bekerja:
1. **Idempoten.** Impor ulang berkas yang sama menghasilkan "0 baru, 9
   diperbarui", **bukan** 9 baris baru. Tidak ada penggandaan data.
2. **Poin dihitung CRM.** Berkas Majoo tidak membawa kolom poin; CRM menghitung
   sendiri dari total bayar. Ini menjaga CRM sebagai satu-satunya sumber
   kebenaran poin.

### 5.3 Pengamanan yang ditemukan di antarmuka

- Tombol "Terapkan" **selalu lewat dialog konfirmasi** yang menyebut jumlah
  baris dan menegaskan "Baris yang sudah ada akan diperbarui, bukan
  digandakan. Poin tetap dihitung CRM, bukan dari Majoo." Bukan `window.confirm`.
- Berkas non-ekspor ditolak sebelum ditulis; format yang diterima `.xlsx`,
  `.xls`, `.csv`.
- Galat per baris dilaporkan, bukan menghentikan seluruh berkas.

---

## 6. Fitur Baru: Pencocokan & Aturan Poin Berversi

### 6.1 Pencocokan transaksi tanpa pelanggan

Diuji dengan berkas uji berisi **kode `KA099` yang belum ada di CRM**:

| Langkah | Hasil |
|---|---|
| Impor berkas uji | 2 transaksi: KA099 Rp 30.000 (Tunai) + walk-in Rp 20.000 (QRIS) |
| Transaksi KA099 | Masuk daftar **menunggu pencocokan**, poin **ditahan** (0) |
| Transaksi walk-in | Tercatat `anonim`, **tidak** muncul di daftar pencocokan |
| Halaman `/pencocokan` | Menampilkan 1 transaksi pending dengan dropdown pelanggan + tombol "Cocokkan" (**nonaktif** sampai pelanggan dipilih) |
| Aksi cocokkan | Pilih **Budi Santoso**, tekan "Cocokkan", daftar pending **kosong** |
| Verifikasi basis data | Transaksi `CS/23/261002/0011` menjadi `terhubung`, `pelanggan_id` terisi, **poin 1 diterbitkan** |

Ini membuktikan **poin ditahan sampai pelanggan cocok** — pelanggan tidak
kehilangan poin hanya karena kodenya belum ada di CRM saat impor.

### 6.2 Aturan poin berversi per periode

Ini inti jawaban atas G3 ("10x pembelian dapat reward"). Terverifikasi di basis data:

| Hal | Bukti |
|---|---|
| Aturan yang berlaku sekarang | `mode: per_kunjungan`, mulai `2026-10-02`, tanpa tanggal selesai |
| Transaksi 2 Oktober (KA099) | Dapat **1 poin** — sesuai `per_kunjungan`, **bukan** 30.000 dibagi 20.000 |
| Transaksi 19 Sep (8 transaksi lama) | Tetap memakai aturan lama per-nominal (2, 1, 3, 1, 2, 0, 1, 1) |
| **Poin lama dihitung ulang?** | **TIDAK** — poin yang sudah terbit tidak berubah saat aturan baru berlaku |

Yang dipuji: inilah perilaku yang benar untuk sistem loyalitas. Pelanggan
mempercayai saldo poinnya; mengubah aturan tidak boleh membatalkan poin yang
sudah dijanjikan. Sistem melakukan ini dengan benar.

### 6.3 Pembukuan poin

Diperiksa pada keadaan akhir setelah semua uji impor dan pencocokan:

| Sumber | Jumlah |
|---|---|
| Saldo seluruh pelanggan | **12** |
| Jumlah `poin_didapat` seluruh transaksi | **12** |
| Jumlah `poin_masuk` seluruh buku besar | **12** |
| **Seimbang?** | **YA** |

Izin tulis buku besar: hanya **admin** yang bisa menulis langsung (kasir 403).
Entri buku besar selalu tertaut ke `transaksi_id`, sehingga perubahan saldo
selalu bisa ditelusuri ke transaksi asalnya.

---

## 7. Fitur Baru: Log Transaksi

Halaman `/log-transaksi` (khusus admin) diuji dengan 11 transaksi nyata:

| Hal | Hasil |
|---|---|
| Ringkasan | "11 transaksi", "Omzet Rp 348.000", "Poin terbit 12" |
| Omzet vs hitung manual | 45+28+62+22+48+12+35+28+18+30+20 = **Rp 348.000** — **cocok** |
| Kolom tabel | Waktu, No. struk, Total, Poin, Pelanggan, Sumber, Cocok, Detail |
| Dua tanggal ditampilkan | "08 Okt 2026" (waktu tercatat) **dan** "Majoo 02 Okt 2026" (tanggal asli) |
| Filter sumber | Semua, CRM manual, Impor Majoo, Paralel Majoo, CSV |
| Filter pencocokan | Semua, Terhubung, Menunggu, Anonim |
| Filter rentang tanggal + Reset | Ada dan berfungsi |
| **Uji filter "Anonim"** | 2 transaksi, Omzet **Rp 48.000**, Poin terbit **0** — tepat (walk-in tidak dapat poin) |

### 7.1 Detail transaksi & jejak poin

Membuka detail `CS/23/261002/0011` menampilkan:

| Bagian | Isi |
|---|---|
| Total dibayar | Rp 30.000 |
| Poin | +1 |
| Waktu tercatat | 08 Okt 2026, 02:24 |
| Majoo | 02 Okt 2026 |
| Identitas | Budi Santoso, Kode Majoo KA099, Tunai, Impor Majoo |
| Rincian item | Kopi Susu Gula Aren x1 |
| **Jejak poin** | "Poin dari pencocokan transaksi CS/23/261002/0011, +1" |

Ini menjawab prinsip audit: **jejak tidak bisa diubah siapa pun, dan asal
setiap poin bisa ditelusuri**. Poin dari pencocokan tidak muncul begitu saja,
ia menyebut transaksi mana yang melahirkannya.

---

## 8. Bagian 6 versi 1 — Desain & UX (diulang)

| Hal | Hasil |
|---|---|
| Pesan error berbahasa Indonesia? | **Ya.** Contoh: `poin tidak cukup: diminta 30, tersedia 25`, `Nomor WhatsApp harus nomor Indonesia (awali 08 atau 62)` |
| Konfirmasi tindakan merusak? | **Ya**, dialog sendiri, bukan `window.confirm`. Termasuk pada impor |
| Tombol cukup besar untuk layar sentuh? | **Ya.** Diukur pada 834 px: **nol** elemen di bawah 44 px |
| Alur input minim klik? | Cukup baik (tombol nominal cepat +10rb sampai +100rb, tombol +000) |
| Dashboard jelas untuk non-teknis? | Ya, angka ringkas per periode dengan kalimat penjelas saat kosong |
| **Responsif iPad (834 px)?** | **BERSIH** — nol luapan, sidebar menyempit jadi ikon |
| **Responsif telepon (390 px)?** | **Tidak ada luapan lagi** di `/transaksi` (diuji ulang 12 Okt, lihat BUG-07) |

### 8.1 Keterbatasan pengujian responsif

Kali ini tiga lebar **benar-benar diukur**, bukan hanya 1262 px seperti versi 1.
Yang **belum** diuji: perangkat fisik (iPad/Android sungguhan), orientasi
lanskap telepon, dan tampilan sentuh nyata (uji ini memakai klik tetikus
pada jendela yang diperkecil). Untuk kedai yang memakai iPad di meja kasir,
**satu kali pembukaan di iPad sungguhan tetap disarankan** sebelum hari pertama.

---

## 9. Daftar Bug

Format: ID, Actor, Fitur, Langkah Reproduksi, Expected, Actual, Severity, Device.

### BUG-01 — DITARIK: bukan bug (warisan versi 1)

Versi 1 sempat menyatakan pencarian gagal saat nomor diketik format lokal
`08...`. Itu **keliru dan tetap ditarik**. Kode aslinya menormalisasi kata
kunci sebelum mencocokkan, jadi `08123456701` menemukan pelanggan bernomor
`628123456701`.

---

### BUG-02 — DITUTUP: batas panjang nomor WhatsApp sudah seragam

| Kolom | Isi |
|---|---|
| **Status** | **Selesai diverifikasi.** Aturan panjang nomor sekarang konsisten: aplikasi menolak di antarmuka, dan basis data punya batas yang sama |

Diuji ulang memakai jalur non-antarmuka: nomor 10 digit (`628123456799`)
diterima sebagai baris pertama, lalu **`+62 812-3456-799` ditolak dengan 409**
karena terdeteksi sebagai duplikat setelah normalisasi. Artinya batas unik
sekaligus batas panjang sudah bekerja di lapisan basis data, bukan hanya di
antarmuka.

---

### BUG-03 — DITUNDA: pencarian tidak mengenali salah ketik ringan

| Kolom | Isi |
|---|---|
| **Actor** | Kasir, Manager, Admin |
| **Fitur** | Cari pelanggan |
| **Langkah** | Ketik `QA-Andy Pratama` padahal nama tersimpan `QA-Andi Pratama`. Bandingkan dengan mengetik `Andi`. |
| **Expected** | Idealnya tetap ditemukan, karena brief meminta pencarian tahan typo ringan. |
| **Actual** | 0 hasil. Pencocokan memakai "mengandung" persis, tidak ada toleransi salah ketik. |
| **Severity** | **Minor** — fitur sekunder; kasir masih bisa memakai 3 digit akhir nomor atau potongan nama yang benar. |
| **Device/Browser** | Chromium, 1262 px. |

**Status: ditunda, sengaja.** Ini permintaan tambahan brief, bukan cacat.
Butuh pengembangan (pencocokan samar), bukan perbaikan kecil.

---

### BUG-04 — DITUNDA: seluruh data pelanggan diunduh ke browser

| Kolom | Isi |
|---|---|
| **Actor** | Semua peran |
| **Fitur** | Halaman Pelanggan, Dashboard, Analitik |
| **Langkah** | Buka halaman Pelanggan saat data pelanggan sudah banyak (ribuan baris), lalu amati pemuatan awal. |
| **Expected** | Halaman memuat data seperlunya; pencarian dikerjakan di server. |
| **Actual** | Seluruh baris pelanggan **dan** seluruh transaksi ditarik ke browser, lalu pencarian disaring di memori. Halaman juga tidak menyegar sendiri, perlu menekan "Muat ulang". |
| **Severity** | **Minor** untuk volume kedai sekarang (belasan sampai ratusan pelanggan aman). **Berubah jadi Major** begitu pelanggan menembus ribuan. |
| **Device/Browser** | Terverifikasi dari struktur kode, bukan dari beban nyata. |

**Status: ditunda.** Ini **bukan** regresi; cara ini justru dipilih untuk
memperbaiki bug lama di mana data terpotong diam-diam di 1000 baris.

---

### BUG-05 — DITUTUP: nama Admin dan Kasir sudah tampil sebagai nama orang

| Kolom | Isi |
|---|---|
| **Status** | **Selesai diverifikasi.** Sidebar sekarang menampilkan "Wahyu" dan "Anggara", bukan `wahyu@kataloji.id`. Akun baru tidak terpengaruh karena form Tambah Staf mengirim nama. |

---

### BUG-06 — MASIH ADA: menghapus transaksi meninggalkan poinnya (poin hantu)

| Kolom | Isi |
|---|---|
| **Actor** | Admin (lewat API atau dasbor, bukan lewat antarmuka) |
| **Fitur** | Perhitungan poin / buku besar |
| **Langkah** | 1. Catat transaksi untuk pelanggan sehingga ia mendapat poin. 2. Hapus transaksi itu. 3. Periksa buku besar dan saldo pelanggan tersebut. |
| **Expected** | Poin yang berasal dari transaksi terhapus ikut dibatalkan, atau minimal muncul peringatan bahwa buku besar tidak lagi cocok dengan transaksi. |
| **Actual** | **Poinnya tetap tinggal.** `point_ledger.transaksi_id` diatur `on delete set null`, sehingga entri poin tidak ikut terhapus, hanya tautannya jadi kosong. Saldo pelanggan tetap memuat poin itu dan **poin tersebut bisa ditukar**. |
| **Severity** | **Major** (menurut huruf aturan brief ini masuk Critical, karena bunyinya "salah hitung poin", tapi **tidak ada jalan di antarmuka untuk menghapus transaksi**, jadi tidak bisa terpicu staf saat melayani) |
| **Device/Browser** | Tidak berlaku (uji API langsung). |

**Reproduksi nyata pada pengujian ini.** Untuk membersihkan transaksi uji,
sebuah transaksi dihapus dari basis data. Hasilnya terukur:

```
Setelah hapus transaksi uji : saldo=13  poin_transaksi=12  poin_ledger=12
Setelah koreksi manual      : saldo=12  poin_transaksi=12  poin_ledger=12  SEIMBANG
```

Ketika transaksi Rp 40.000 dihapus, entri poinnya **tetap tinggal di saldo
pelanggan** (Rina Kartika) sementara baris buku besar miliknya ikut terhapus
karena bersih-bersih entri yatim. Akibatnya saldo pelanggan memuat 1 poin yang
**tidak punya transaksi asal** dan tidak punya baris buku besar.

**Bukti bahwa pemeriksaan "seimbang" tidak mendeteksi ini:** saldo ringkasan
dibandingkan dengan buku besar, tetapi keduanya sama-sama memuat poin hantu,
sehingga angkanya bisa cocok sementara transaksinya sudah tidak ada.

**Catatan penting:** ini tampaknya **pilihan desain, bukan kelalaian**. Dengan
`on delete set null`, riwayat poin sengaja tidak dihapus diam-diam supaya jejak
audit tetap utuh. Proyek juga sudah punya skrip pembersih khusus untuk entri
tanpa `transaksi_id` (`supabase/bersihkan-data-uji.sql`).

**Yang perlu diputuskan lebih dulu:**
1. **Batalkan poin otomatis** saat transaksi dihapus? Risikonya: bila poin
   sudah terlanjur ditukar, saldo bisa jadi minus.
2. **Pertahankan jejak audit, tapi beri peringatan di layar** saat ada buku
   besar tanpa transaksi asal? Ini menjaga prinsip audit dan tetap jujur.

Rekomendasi: pilihan 2, ditambah **larangan hapus transaksi yang poinnya sudah
terpakai**. Tapi ini keputusan kebijakan, bukan keputusan teknis.

---

### BUG-07 — DITUTUP: tidak terbukti lagi di kode terbaru (uji ulang 12 Okt 2026)

> **Catatan uji ulang.** Pada 12 Okt 2026, `/transaksi` diukur dengan iframe
> lebar 390 px dan 834 px: lebar konten 390 px dan 834 px, tidak ada luapan.
> Temuan di bawah ini berlaku untuk kode 7 Okt. Dipertahankan sebagai riwayat.

### BUG-07 (riwayat, kode 7 Okt): halaman `/transaksi` meluber ke kanan pada layar telepon

| Kolom | Isi |
|---|---|
| **Actor** | Kasir (dan semua peran) |
| **Fitur** | Halaman Transaksi |
| **Langkah** | Buka `/transaksi` pada lebar layar **390 px** (telepon). Amati halaman bisa digeser ke kanan. |
| **Expected** | Halaman muat pas di lebar layar, tanpa gulir mendatar. |
| **Actual** | Halaman meluber **38 px** ke kanan. Terukur: lebar dokumen **429 px** pada viewport 390 px (`scrollWidth` 429 lawan `clientWidth` 390). Sebanyak **28 elemen** punya tepi kanan di 428 px, termasuk judul "Transaksi", label "PELANGGAN", label "Total tagihan", kotak input total, dan tombol cepat "+50rb". Tombol "Simpan transaksi" yang lengket di bawah ikut meluber. |
| **Severity** | **Minor** — semua yang meluber **masih bisa dijangkau** dengan menggeser sedikit, tidak ada yang tidak bisa ditekan. Hanya terjadi di telepon; **iPad 834 px bersih, nol luapan**. Kedai memakai iPad di meja kasir, jadi dampak operasional kecil. |
| **Device/Browser** | Chromium, viewport 390 px |

**Dugaan penyebab.** Wadah `div.grid.gap-6.px-6` di `src/app/(dashboard)/transaksi/page.tsx`
baris 385 punya lebar isi **295 px** (viewport 390 dikurangi padding 48 px dan
sidebar 64 px), tetapi kolom kirinya terukur **324 px** — **29 px lebih lebar
dari yang tersedia**, sehingga grid meluber (`scrollWidth` 348 lawan
`clientWidth` 295). Karena tidak ada sisipan yang menahan, luapan itu
menerobos keluar halaman. Halaman lain dengan pola grid serupa
(`/pengaturan`, `/campaign`) **tidak** kena, jadi masalahnya bukan pola
umum melainkan lebar kolom di halaman ini.

**Belum diperiksa:** mengapa tepatnya kolom berhenti di 324 px. Indikasi awal
mengarah pada aturan lebar minimum dari salah satu anak kolom. Penelusuran
lanjutan perlu menyisir anak-anak kolom kiri di bawah 390 px.

**Usulan perbaikan (belum dikerjakan, menunggu keputusan):**
- Ubah padding `px-6` menjadi `px-4` pada lebar kecil (`px-4 sm:px-6`), yang
  langsung memberi 16 px ekstra, atau
- tambahkan `min-w-0` dan `overflow-hidden` pada kolom kiri, atau
- beri `max-w-full` pada elemen yang memaksa lebar.

**Catatan:** prinsip "build hijau bukan berarti tampilan benar" terbukti di
sini. Build, lint, dan seluruh harness tetap lulus sempurna; cacat ini hanya
muncul saat halaman **diukur pada lebar layar kecil**.

---

## 10. Keadaan Basis Data Setelah Pengujian

Diperiksa di akhir seluruh pengujian agar tidak meninggalkan sisa:

| Tabel | Jumlah baris | Keterangan |
|---|---|---|
| `pelanggan` | **5** | Semuanya ber-`kode_majoo` (hasil impor Majoo), tidak ada sisa `QA-` |
| `transaksi` | **11** | 9 dari impor Majoo 19 Sep + 1 impor 2 Okt + 1 hasil pencocokan; 2 anonim |
| `point_ledger` | **8** | Semua tertaut ke `transaksi_id`, tidak ada entri yatim |
| `aturan_poin` | **1** | `per_kunjungan`, mulai 2 Okt 2026 |

**Pemeriksaan keseimbangan:** saldo 12 = poin transaksi 12 = poin buku besar 12
menjadi **SEIMBANG**.

**Data uji yang dibersihkan pada pengujian ini:**
- Transaksi uji poin palsu (Rp 40.000, tanpa nomor struk) — dihapus
- Pelanggan uji duplikat WA (`QA-DUP-A`, `QA-DUP-B`) — dihapus
- Buku besar yatim sisa uji — dihapus
- Berkas pelanggan uji ber-`kode_majoo` **dipertahankan** karena sudah menjadi
  pelanggan contoh yang sah untuk demonstrasi

**Data yang diubah dan tidak dikembalikan:** saldo Rina Kartika dikoreksi
turun 1 poin untuk membatalkan poin hantu dari transaksi uji yang dihapus
(BUG-06). Perubahan ini disengaja dan sudah dicatat di sini.

---

## 11. Regression Checklist

Perintah gate kanonik **tidak ada** (`npm test` tidak terdefinisi di
`package.json`). Gate dirakit dari kumpulan pemeriksaan yang tersedia:

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| **14 harness otomatis** | `npx tsx [--env-file=.env.local] scripts/uji-*.mts` | **14 dari 14 LULUS** |
| Lint | `npx eslint .` | **lulus**, exit 0, nol peringatan |
| Build produksi | `npm run build` | **lulus**, 21 rute, 0 error |
| Em-dash di kode | pemeriksaan karakter `—` | **0 di `src/`**; 2 di skrip bantu CLI (`scripts/`), bukan teks antarmuka |
| Responsif | pengukuran DOM pada 834 px dan 390 px | 834 px bersih; 390 px menemukan BUG-07 |

**Catatan tentang 2 harness yang tampak gagal.** `uji-aturan-poin-db.mts` dan
`uji-tulis-impor.mts` gagal saat dijalankan tanpa flag, dengan pesan
"`SUPABASE_SERVICE_ROLE_KEY` belum diisi". Kuncinya **ada** di `.env.local`;
kedua harness itu memang butuh `--env-file=.env.local` (tertulis di kepala
berkasnya sendiri). Dengan flag itu, **keduanya lulus**. Kalau tidak
menjalankan gate dengan benar, dua harness ini akan tampak seperti regresi
padahal bukan. **Cara menjalankan gate yang benar dicatat di Panduan Testing.**

Yang **belum masuk** checklist otomatis dan masih diuji manual:
alur klik transaksi, tampilan tiap halaman per peran, arsip pelanggan lewat UI,
dan seluruh pengujian responsif.

---

## 12. Pelajaran Metode Pengujian (dari kekeliruan versi ini)

Bagian ini ada karena kejujuran hasil pengujian bergantung pada metode yang
benar. Tiga kekeliruan terjadi pada pengujian ini, semuanya milik **alat
ujinya**, bukan sistemnya:

**Kekeliruan 1: snapshot aksesibilitas lawan DOM nyata.**
Snapshot aksesibilitas melaporkan halaman admin tampil lengkap padahal
pemanggilan langsung ke DOM-nya menunjukkan "Halaman ini hanya untuk admin"
tanpa satu baris data pun. Pelajarannya: **halaman yang menerapkan hak akses
di sisi klien harus diverifikasi dengan membaca DOM hasil render, bukan
snapshot aksesibilitas mentah**, karena snapshot bisa menampilkan kerangka
halaman sebelum pengalihan selesai.

**Kekeliruan 2: membaca kolom basis data yang salah nama.**
Sebuah pemeriksaan menyimpulkan "0 baris pelanggan" dan "null transaksi"
padahal datanya lengkap. Penyebabnya: tabel `pelanggan` **tidak punya** kolom
`status`, dan `transaksi` **tidak punya** kolom `tanggal` maupun `sumber`. Nama
sebenarnya adalah `status_pencocokan`, `tanggal_majoo`, dan `source`.
Pemeriksaan yang menyebut kolom tidak ada akan gagal senyap dan terbaca
seperti "tidak ada data". Pelajarannya: **pakai `select("*")` atau periksa
nama kolom lebih dulu** sebelum menyimpulkan sesuatu dari jumlah baris, dan
**cross-check dengan panggilan mentah** (`content-range` PostgREST) bila angka
terlihat mencurigakan.

**Kekeliruan 3: menyimpulkan dari satu iframe.**
Mengukur responsif dengan memuat halaman ke dalam `iframe` memberi hasil
"bersih" yang menyesatkan, karena sidebar `position: fixed` tidak ikut
melebar sehingga lebar isi terlihat cukup. Pelajarannya: **responsif harus
diukur pada navigasi nyata dengan viewport sungguhan.**

**Aturan yang lahir dari ketiga hal di atas:**
1. Kalau alat uji melaporkan cacat, **periksa alatnya dulu** sebelum melaporkan
   ke sistem. Tiruan yang salah lebih sering daripada sistem yang salah.
2. **Uji fungsi aslinya, bukan tiruannya.**
3. **Ukur DOM, jangan lihat tangkapan layar**, untuk hal-hal yang bisa diukur
   (lebar, tinggi, keseimbangan, jumlah baris).
4. **Bila dua sumber berbeda pendapat, cari sumber ketiga yang paling mentah.**

---

## 13. Exit Criteria

| Kriteria | Status |
|---|---|
| Nol bug **Critical** yang belum diperbaiki | **TERPENUHI** — tidak ada bug Critical. Perhitungan poin benar, buku besar seimbang, tidak ada peran yang tembus. |
| Alur core lulus semua | **SEBAGIAN** — semua alur yang ada di sistem lulus, tetapi G1/G2/G6 masih tidak ada objeknya untuk diuji. |
| Pemetaan role terverifikasi sepenuhnya | **TERPENUHI** — 14 uji batas akses di UI, API, dan database, semuanya lulus, termasuk tiga halaman admin baru. |
| Fitur baru (impor dan pencocokan) terverifikasi sampai basis data | **TERPENUHI** — diuji lewat antarmuka lalu diverifikasi di tabel `pelanggan`, `transaksi`, dan `point_ledger`. |
| Responsif diukur di layar kecil | **TERPENUHI dengan temuan** — iPad bersih, telepon menemukan BUG-07. |
| Testing broadcast ke nomor testing | **TIDAK BERLAKU** — tidak ada mekanisme broadcast otomatis yang bisa diarahkan ke nomor testing. |

**Kesimpulan akhir: siap dipakai operasional untuk fitur yang sudah ada**,
dengan BUG-07 sebagai satu perbaikan tampilan yang disarankan sebelum dipakai
di telepon, dan BUG-06 sebagai keputusan kebijakan yang perlu diambil sebelum
fitur hapus transaksi pernah dibuka ke antarmuka.

### Yang harus diputuskan sebelum serah terima

1. ~~**BUG-07**~~ — sudah tidak terbukti lagi di kode terbaru (diukur di 390 px dan 834 px, tidak ada luapan). Tidak perlu tindakan.
2. **BUG-06** — putuskan: batalkan poin otomatis, atau pertahankan jejak audit
   dengan peringatan. Rekomendasi: pertahankan plus larang hapus transaksi yang
   poinnya sudah terpakai.
3. **G1/G2/G6** — integrasi WhatsApp Business: ajukan estimasi biaya, atau
   sesuaikan brief menjadi manual. Ini keputusan mitra.
4. **Uji di perangkat sungguhan** — satu kali buka di iPad di meja kasir
   sebelum hari pertama, karena alat uji ini hanya memperkecil jendela, bukan
   benar-benar menyentuh layar.

---

## 14. Cara Menjalankan Ulang Pengujian Ini

```bash
cd kataloji-crm

# 1. Nyalakan aplikasi
npm run dev          # buka http://localhost:3000

# 2. Gate otomatis (PENTING: dua harness butuh --env-file)
npx eslint .
npm run build
for f in scripts/uji-*.mts; do npx tsx --env-file=.env.local "$f"; done

# 3. Periksa responsif (perlu alat pengujian yang bisa mengubah viewport)
#    Buka /transaksi, ukur: document.documentElement.scrollWidth
#    Harus <= 390 pada viewport 390. Saat ini 429 (BUG-07).

# 4. Akun uji: wahyu@kataloji.id / sinta@kataloji.id / anggara@kataloji.id
#    Sandi semuanya: ada di .env.local (kunci SANDI_UJI), tidak ditulis di sini
```

**Peringatan:** langkah 2 dan 3 menyentuh basis data produksi. Periksa
keseimbangan setelahnya (saldo = poin transaksi = poin buku besar) dan
bersihkan data uji dengan awalan `QA-`.