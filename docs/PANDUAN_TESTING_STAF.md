# Panduan Testing Tiga Akun Staf

Dokumen ini dipakai untuk memastikan hak akses tiap peran bekerja sesuai
rancangan sebelum aplikasi diserahkan ke client. Ditulis sebagai langkah yang
bisa diikuti sambil menekan tombol, lengkap dengan hasil yang diharapkan.

Hasil pengujian terakhir: **16 September 2026**, seluruh butir LULUS.

---

## 0. Persiapan

### 0.1 Nyalakan aplikasi

```bash
cd kataloji-crm
npm run dev
```

Tunggu sampai muncul `Ready in ...`. Buka `http://localhost:3000`.

### 0.2 Akun yang dipakai

Ketiga akun memakai sandi yang sama: `kataloji123`

| Peran | Email | Nama tampil |
|---|---|---|
| Admin | `wahyu@kataloji.id` | Wahyu |
| Manager | `sinta@kataloji.id` | Sinta |
| Kasir | `anggara@kataloji.id` | Anggara |

### 0.3 Catatan keadaan data

Basis data saat ini **kosong** (data uji sudah dibersihkan, akun staf
dipertahankan). Karena itu pengujian alur transaksi akan **membuat data baru**.

Kalau nanti butuh data lama untuk demo, cadangannya ada di:

```
D:\Semester 7\KP_Kerja Praktek\cadangan-data\
```

### 0.4 Tabel ringkas hak akses

Ini patokan utama pengujian. Jumlah menu di sidebar adalah bukti tercepat.

| Menu | Admin | Manager | Kasir |
|---|:---:|:---:|:---:|
| Dashboard | ya | ya | ya |
| Transaksi | ya | ya | ya |
| Pelanggan | ya | ya | ya |
| Loyalitas | ya | ya | ya |
| Pengaturan | ya | ya | ya |
| Rekap kasir | ya | ya | **tidak** |
| Campaign | ya | ya | **tidak** |
| Analitik | ya | ya | **tidak** |
| Staf | ya | **tidak** | **tidak** |
| **Jumlah menu** | **9** | **8** | **5** |

---

## 1. Pengujian Kasir

Masuk dengan `anggara@kataloji.id`.

### 1.1 Sidebar menyusut sesuai peran

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Masuk sebagai kasir | Berhasil masuk, diarahkan ke Dashboard |
| 2 | Perhatikan sidebar | Ada **5 menu**: Dashboard, Transaksi, Pelanggan, Loyalitas, Pengaturan |
| 3 | Cari kelompok **Pemasaran** | **Tidak ada sama sekali**, termasuk judulnya |
| 4 | Cari menu **Staf** | Tidak ada |
| 5 | Cari menu **Rekap kasir** | Tidak ada |
| 6 | Lihat nama di kiri bawah | Tertulis **Anggara**, peran **Kasir** |

> Kelompok Pemasaran sengaja disembunyikan seluruhnya, bukan disisakan sebagai
> judul kosong. Judul tanpa isi justru memberi tahu ada sesuatu yang tidak
> boleh dibuka, dan itu mengganggu tanpa manfaat.

### 1.2 Mencoba menembus halaman terlarang

Ini pengujian terpenting. Menu yang disembunyikan **bukan** pengamanan.
Pengamanannya adalah pemeriksaan peran di dalam halaman itu sendiri.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 7 | Ketik langsung di address bar: `/staf` | Muncul halaman **Akses ditolak** |
| 8 | Baca pesan penolakan | Menyebut peran pembaca dan alasannya |
| 9 | Klik tombol di halaman penolakan | Diarahkan ke halaman yang boleh dibuka |
| 10 | Coba juga `/campaign` | Ditolak, tidak menampilkan data apa pun |
| 11 | Coba juga `/analitik` | Ditolak |
| 12 | Coba juga `/rekap-kasir` | Ditolak |

> **Yang diuji di sini:** peran diperiksa **sebelum** data diambil. Kalau
> halaman menolak setelah data terunduh, data itu sempat berada di perangkat
> yang tidak berhak.

### 1.3 Alur kerja harian kasir

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 13 | Buka **Pelanggan** | Daftar kosong, ada ajakan menambah pelanggan |
| 14 | Klik **Tambah pelanggan** | Panel terbuka dari kanan |
| 15 | Isi: nama `Uji Kasir`, WhatsApp `081234567890`, tanpa tanggal lahir | Tersimpan, pelanggan muncul di daftar |
| 16 | Buka **Transaksi** | Kolom pencarian pelanggan aktif |
| 17 | Cari `Uji Kasir`, pilih pelanggannya | Nama pelanggan menempel di transaksi |
| 18 | Isi total belanja `100000` | Menampilkan perolehan **5 poin** (Rp 20.000 per poin) |
| 19 | Simpan transaksi | Berhasil, poin pelanggan naik, nomor struk muncul |
| 20 | Ulangi dengan total `50000` | Perolehan **2 poin** (pembulatan ke bawah) |
| 21 | Buka **Loyalitas** | Pelanggan tampil dengan total 7 poin |

### 1.4 Boleh mengarsipkan pelanggan?

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 22 | Buka detail `Uji Kasir` | Panel detail terbuka |
| 23 | Cari tombol **Arsipkan** | **Tidak ada** untuk kasir |

---

## 2. Pengujian Manager

Masuk dengan `sinta@kataloji.id` (keluar dulu dari akun kasir).

### 2.1 Sidebar

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Masuk sebagai manager | Berhasil masuk |
| 2 | Hitung menu di sidebar | Ada **8 menu** |
| 3 | Periksa | **Rekap kasir, Campaign, Analitik MUNCUL** |
| 4 | Periksa lagi | **Staf TIDAK ada** |
| 5 | Nama di kiri bawah | **Sinta**, peran **Manager** |

### 2.2 Batas peran manager

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 6 | Ketik langsung: `/staf` | Muncul halaman **Akses ditolak** |
| 7 | Baca pesan | Menjelaskan bahwa mengelola akun staf hanya untuk admin |
| 8 | Ketik langsung: `/campaign` | **Boleh masuk**, halaman tampil normal |
| 9 | Ketik langsung: `/analitik` | Boleh masuk |
| 10 | Ketik langsung: `/rekap-kasir` | Boleh masuk, menampilkan data semua kasir |

> Menu **Rekap kasir** adalah contoh kasus yang pernah salah: dulu manajer
> tidak melihat menunya, padahal halamannya mengizinkan dia masuk. Fitur yang
> boleh dibuka tapi tidak ada menunya membuat fitur itu seperti tidak ada.

### 2.3 Manager boleh mengubah transaksi

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 11 | Buka **Transaksi** | Melihat transaksi yang dibuat kasir tadi |
| 12 | Periksa kolom pencatat | Tertulis **Anggara** (yang mencatat, bukan yang melihat) |
| 13 | Filter berdasarkan tanggal | Hasil sesuai rentang yang dipilih |

---

## 3. Pengujian Admin

Masuk dengan `wahyu@kataloji.id`.

### 3.1 Sidebar penuh

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Masuk sebagai admin | Berhasil masuk |
| 2 | Hitung menu | **9 menu**, semua kelompok tampil |
| 3 | Nama di kiri bawah | **Wahyu**, peran **Admin** |

### 3.2 Mengelola akun staf

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 4 | Buka **Staf** | Tiga akun tampil: Wahyu (Admin), Sinta (Manager), Anggara (Kasir) |
| 5 | Klik **Tambah akun** | Panel terbuka |
| 6 | Isi nama `Uji Staf`, email `ujistaf@kataloji.id`, sandi `uji12345`, peran Kasir | Tersimpan, akun baru muncul |
| 7 | Coba tambah lagi dengan email sama | Ditolak: email sudah dipakai |
| 8 | Coba tambah dengan sandi `123` | Ditolak: minimal 8 karakter, harus ada huruf dan angka |
| 9 | Klik **Ubah** pada akun `Uji Staf` | Panel terbuka, ubah peran jadi Manager |
| 10 | Simpan | Peran berubah jadi Manager |

### 3.3 Pengaman anti-terkunci

Pengujian ini mencegah satu-satunya admin terhapus, yang akan membuat sistem
tidak bisa dikelola lagi oleh siapa pun.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 11 | Klik **Hapus** pada akun Wahyu (diri sendiri) | Tombol **nonaktif** (tidak bisa ditekan) |
| 12 | Arahkan kursor ke tombol itu | Muncul keterangan tidak bisa menghapus akun yang sedang dipakai |
| 13 | Klik **Hapus** pada Sinta | Muncul **dialog konfirmasi** (bukan kotak bawaan peramban) |
| 14 | Periksa tombol di dialog | Tombol **Batal** yang terfokus lebih dulu, bukan tombol Hapus |
| 15 | Tekan **Escape** | Dialog tertutup, **tidak ada akun terhapus** |
| 16 | Buka dialog lagi, klik **Hapus akun** | Akun terhapus, ada pemberitahuan |
| 17 | Coba ubah peran admin terakhir jadi kasir | Ditolak: harus ada minimal satu admin |

> Dialog konfirmasi mengarahkan fokus ke **Batal** dengan sengaja. Tombol
> merah tidak menjadi tombol pertama yang terfokus, supaya menekan Enter
> secara refleks tidak langsung menghapus akun.

### 3.4 Aturan poin dan pemeriksaan pembukuan

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 18 | Buka **Pengaturan** | Menampilkan aturan poin yang sedang berlaku |
| 19 | Baca aturan | Rp 20.000 per poin, 1 poin = Rp 1.000, minimal tukar 5 poin |
| 20 | Periksa bagian pembukuan | Tertulis **tidak ada selisih** |
| 21 | Bandingkan dengan data | Jumlah poin masuk dikurangi keluar sama dengan saldo pelanggan |

> Kalau ada selisih, artinya saldo poin berubah tanpa baris yang
> menjelaskannya. Pemeriksaan ini ada supaya hal seperti itu terlihat oleh
> pemilik, bukan hanya oleh yang membaca basis data.

### 3.5 Fitur arsip pelanggan

Fitur ini baru dipasang. Cara kerjanya menggantikan penghapusan pelanggan.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 22 | Buka **Pelanggan**, pilih `Uji Kasir` | Panel detail terbuka |
| 23 | Klik **Arsipkan** | Muncul dialog konfirmasi, ada isian alasan |
| 24 | Isi alasan `nomor sudah tidak aktif` | |
| 25 | Konfirmasi | Pelanggan **hilang** dari daftar biasa |
| 26 | Ubah penyaring ke **Arsip** | Pelanggan muncul kembali |
| 27 | Periksa poinnya | Poin **tetap utuh**, tidak hilang |
| 28 | Klik **Kembalikan** | Pelanggan kembali ke daftar aktif |

> Kenapa tidak dihapus saja: dulu admin bisa menghapus baris pelanggan, dan
> seluruh riwayat poinnya ikut lenyap karena `on delete cascade` tanpa satu
> pun catatan. Artinya klaim "jejak poin tidak bisa diubah siapa pun" tidak
> berlaku sepenuhnya. Mengarsipkan menutup pintu belakang itu.

### 3.6 Lonceng notifikasi

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 29 | Klik ikon lonceng di sidebar | Panel terbuka |
| 30 | Baca isinya | Daftar poin yang akan hangus, pelanggan pasif, dan ulang tahun |
| 31 | Klik salah satu notifikasi | Diarahkan ke pelanggan yang dimaksud |
| 32 | Muat ulang halaman | Notifikasi yang sudah dibuka tetap ditandai sudah dibaca |

> Panel boleh kosong. Itu bukan kerusakan: notifikasi hanya muncul kalau ada
> yang benar-benar melewati ambang, misalnya poin yang hangus dalam 30 hari.

---

## 4. Pengujian Lintas Peran

### 4.1 Sesi dan keluar

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Klik nama di kiri bawah lalu **Keluar** | Kembali ke halaman masuk |
| 2 | Setelah keluar, buka `/dashboard` langsung | Dialihkan ke halaman masuk |
| 3 | Coba `/transaksi` langsung | Dialihkan ke halaman masuk |
| 4 | Masuk lagi sebagai admin | Berhasil, sesi pulih normal |

### 4.2 Identitas tidak tertukar

Ini pernah menjadi bug: nama dan peran di sidebar dulu ditulis tetap
"Wahyu / Admin", sehingga kasir pun tampil sebagai Admin.

| # | Masuk sebagai | Nama di sidebar harus | Peran harus |
|---|---|---|---|
| 5 | `anggara@kataloji.id` | Anggara | Kasir |
| 6 | `sinta@kataloji.id` | Sinta | Manager |
| 7 | `wahyu@kataloji.id` | Wahyu | Admin |

### 4.3 Jejak pencatat tidak berubah

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 8 | Buat transaksi sebagai kasir | Pencatat tercatat sebagai Anggara |
| 9 | Masuk sebagai admin, buka transaksi itu | Pencatat **tetap Anggara**, tidak berubah jadi Wahyu |
| 10 | Hapus akun Anggara (kalau perlu diuji) | Nama pencatat pada transaksi lama **tetap tersimpan** |

> Nama pencatat disalin ke baris transaksi saat dicatat, dan dilindungi
> trigger agar tidak bisa diubah. Kalau akunnya dihapus, riwayat siapa yang
> mencatat tetap bisa dipertanggungjawabkan.

---

## 5. Pengujian Tampilan Sentuh

Aplikasi dipakai di iPad, jadi ukuran tombol perlu diperiksa.

| # | Langkah | Hasil yang diharapkan |
|---|---|---|
| 1 | Buka di jendela selebar kira-kira 1262px | Tata letak dua kolom pada halaman Transaksi |
| 2 | Periksa menu sidebar | Nyaman ditekan jari, tidak berdempet |
| 3 | Periksa semua tombol | Tidak ada yang setinggi di bawah 44px |
| 4 | Halaman **Staf**, lihat tombol Ubah dan Hapus | Berjarak, tidak berdempet |
| 5 | Gulir semua halaman | Tidak ada yang melebar ke samping |

Ukuran 44px adalah ambang pada panduan sentuh Apple dan WCAG 2.5.8.

---

## 6. Format Laporan Bila Menemukan Masalah

Tulis dengan enam bagian ini supaya masalahnya bisa langsung ditelusuri:

```
Peran       : kasir
Halaman     : /transaksi
Langkah     : isi total 100000 lalu simpan
Diharapkan  : poin bertambah 5
Terjadi     : muncul pesan gagal menyimpan
Waktu       : 16 Sep 2026, 14:20
```

Tangkapan layar sangat membantu. Kalau ada pesan galat di layar, salin
kalimatnya apa adanya.

---

## 7. Daftar Periksa Ringkas

Cetak atau salin bagian ini saat pengujian.

### Kasir
- [ ] Sidebar tepat 5 menu
- [ ] Kelompok Pemasaran tidak ada sama sekali
- [ ] `/staf` ditolak
- [ ] `/campaign` ditolak
- [ ] `/analitik` ditolak
- [ ] `/rekap-kasir` ditolak
- [ ] Bisa menambah pelanggan
- [ ] Bisa mencatat transaksi
- [ ] Poin bertambah sesuai total belanja
- [ ] Tombol Arsipkan tidak muncul

### Manager
- [ ] Sidebar tepat 8 menu
- [ ] Menu Staf tidak ada
- [ ] `/staf` ditolak
- [ ] Campaign, Analitik, Rekap kasir bisa dibuka
- [ ] Bisa melihat transaksi semua kasir
- [ ] Nama pencatat tampil benar

### Admin
- [ ] Sidebar tepat 9 menu
- [ ] Bisa menambah akun staf
- [ ] Email ganda ditolak
- [ ] Sandi lemah ditolak
- [ ] Bisa mengubah peran staf
- [ ] Tidak bisa menghapus akun sendiri
- [ ] Tidak bisa menghapus admin terakhir
- [ ] Dialog konfirmasi muncul dengan fokus di Batal
- [ ] Escape menutup dialog tanpa menghapus
- [ ] Pengaturan menampilkan aturan poin
- [ ] Pemeriksaan pembukuan tidak ada selisih
- [ ] Arsipkan pelanggan bekerja
- [ ] Penyaring Arsip menampilkan pelanggan terarsip
- [ ] Kembalikan pelanggan bekerja
- [ ] Lonceng notifikasi terbuka

### Lintas peran
- [ ] Keluar mengembalikan ke halaman masuk
- [ ] Halaman terkunci mengalihkan ke halaman masuk
- [ ] Nama dan peran sidebar sesuai akun
- [ ] Jejak pencatat tidak berubah
- [ ] Seluruh tombol nyaman ditekan
- [ ] Tidak ada halaman melebar ke samping

---

## 8. Yang Sudah Terbukti Otomatis

Selain pengujian manual di atas, perilaku berikut dijaga oleh 694 asersi
otomatis di `scripts/`. Jalankan dengan:

```bash
npx tsx scripts/uji-staf.mts
```

Pemeriksaan otomatis mencakup aturan menu per peran, validasi data staf,
perhitungan poin, aturan saldo buku besar, dan pemeriksaan pembukuan. Bagian
yang tidak bisa diotomatiskan adalah yang menyangkut tampilan dan alur
menekan tombol, dan itulah yang dipandu dokumen ini.
