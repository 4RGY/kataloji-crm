# Panduan Deploy Kataloji CRM

Dokumen ini ditulis supaya deploy bisa diulang orang lain, bukan cuma yang
pertama kali mengerjakan. Isinya langkah, perintah persisnya, dan jebakan yang
sudah pernah menggigit di proyek lain.

## Ringkas alur

```
git push  ->  Vercel build  ->  set environment variables  ->  Supabase redirect URL  ->  uji 3 peran
```

Dua hal yang paling sering menggagalkan deploy, dan dua-duanya **bukan soal
kode**:

1. Environment variable belum diisi di Vercel, padahal sudah ada di `.env.local`
   laptop. Build sukses, tapi halaman login diam saja.
2. Redirect URL Supabase belum ditambah untuk domain produksi. Login berhasil
   di lokal, gagal di produksi, tanpa pesan yang jelas.

## Prasyarat

- Node.js >= 20.9 (sudah dipatok di `engines` `package.json`)
- Akun Vercel dengan izin ke repo GitHub `4RGY/kataloji-crm`
- Akses ke dashboard Supabase proyek `yaoemgptjfanzbxxxadi` (region
  ap-southeast-1, Singapore)
- Tiga nilai dari Supabase Dashboard > Project Settings > API:
  Project URL, anon key, service_role key

## 1. Push ke GitHub

Remote repo ini memakai branch default **`master`**, bukan `main`. Periksa dulu,
jangan menganggap:

```bash
git remote show origin | grep 'HEAD branch'
```

Kalau kerjaan ada di branch fitur, pindahkan dulu ke `master`:

```bash
git checkout master
git merge --ff-only fitur/loader-logo-e2e
git push origin master
```

`--ff-only` sengaja dipakai supaya kalau ternyata ada divergensi, perintahnya
gagal berisik, bukan diam-diam membuat merge commit yang tidak diinginkan.

## 2. Isi environment variables di Vercel

Tiga variabel, semuanya untuk Environment Production, Preview, dan Development:

| Nama | Sumber | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | Aman tampil di peramban |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | Aman tampil di peramban |
| `SUPABASE_SERVICE_ROLE_KEY` | idem, bagian service_role | **RAHASIA**, jangan pernah diberi awalan `NEXT_PUBLIC_` |

`SUPABASE_SERVICE_ROLE_KEY` menembus seluruh aturan RLS. Kunci ini dibutuhkan
fitur kelola akun staf. Tanpa kunci ini aplikasi tetap jalan, hanya menu Staf
yang menampilkan pesan fitur belum aktif.

Cara mengisi lewat CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

Jangan isi lewat stdin yang dipipe ke `vercel env add`; perintah itu tetap
mencoba membuka prompt interaktif dan bisa menggantung. Pakai REST API kalau
perlu mengisinya otomatis.

`.env.local` sudah masuk `.gitignore` sejak awal, jadi kunci tidak pernah ikut
ke git. Jangan menghapus baris `.env*` di `.gitignore`.

## 3. Tambahkan Redirect URL di Supabase

Supabase Dashboard > Authentication > URL Configuration:

- **Site URL**: alamat produksi, mis. `https://kataloji-crm.vercel.app`
- **Redirect URLs**: tambahkan alamat produksi **dan** `http://localhost:3000`
  supaya pengembangan lokal tetap bisa login

Langkah ini yang paling sering terlupa. Tanpa ini, login di produksi gagal dan
penyebabnya tidak kelihatan dari sisi aplikasi.

## 4. Deploy

Lewat CLI:

```bash
vercel          # preview, aman untuk dicoba dulu
vercel --prod   # naikkan ke produksi
```

Deploy preview dulu, uji di sana, baru naikkan ke produksi. Tidak ada alasan
menguji langsung di produksi.

## 5. Verifikasi setelah deploy

Uji di alamat preview sebelum promosi ke produksi:

- [ ] Halaman login tampil dengan benar
- [ ] Login admin berhasil, menu tampil 13
- [ ] Login manager berhasil, menu tampil 9
- [ ] Login kasir berhasil, menu tampil 5
- [ ] Rute terlarang ditolak dengan pesan beralasan (mis. kasir buka `/staf`)
- [ ] Dashboard menampilkan angka omzet, bukan nol karena gagal memuat
- [ ] Unduh PDF laporan penjualan berhasil, isinya ada angka
- [ ] Tidak ada galat di konsol peramban

Kalau menu Staf menampilkan "fitur belum aktif", berarti
`SUPABASE_SERVICE_ROLE_KEY` belum terbaca di lingkungan itu.

## 6. Jebakan yang perlu diingat

### Apex dan www bukan alamat yang sama

Pelajaran ini datang dari proyek SudutMata, dan berlaku umum. Vercel biasanya
mengarahkan apex ke www dengan status **308**.

- `GET` mengikuti 308, jadi halaman biasa terlihat baik-baik saja.
- **`POST` tidak selalu mengikuti 308.** Kalau suatu saat ada webhook, dan
  webhook didaftarkan ke alamat apex, notifikasi bisa tidak pernah sampai tanpa
  pesan galat di mana pun.

Sekarang belum ada webhook di aplikasi ini, tetapi begitu ada (mis. notifikasi
pembayaran), **pakai satu bentuk alamat saja** dan tulis di satu tempat di kode,
jangan disebar sebagai literal.

### Jangan uji di data pelanggan asli

Database proyek ini berisi **data pelanggan asli Kataloji**. RLS sudah menahan,
tetapi sebelum demo atau uji coba:

- Tulis uji hanya ke data bertanda `QA`, jangan ke data asli
- Uji izin cukup pakai `PATCH` (nol baris berarti ditolak), jangan pernah
  `INSERT` ke tabel produksi

Kalau perlu demo tanpa menyentuh data asli, buat proyek Supabase terpisah dan
arahkan environment variable ke sana.

### Jangan tampilkan kunci di riwayat perintah

Perintah `vercel env add` yang menempelkan kunci langsung di baris perintah akan
meninggalkan jejak di riwayat shell. Isi lewat dashboard atau lewat variabel
lingkungan.

## 7. Rollback

Vercel menyimpan setiap deployment. Kalau versi baru bermasalah:

```bash
vercel rollback
```

atau pilih deployment terakhir yang sehat di dashboard Vercel lalu Promote to
Production. Efeknya seketika dan tidak menyentuh git.

Kalau masalahnya di database, **jangan** menjalankan rollback SQL tanpa
memeriksa dampaknya ke data asli lebih dulu. Berkas di `supabase/` sengaja tidak
memakai penomoran migrasi otomatis, jadi penerapannya masih manual dan disengaja
begitu.
