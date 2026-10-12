# Laporan Sapuan Menu 3 Peran

Tanggal uji: 12 Oktober 2026
Cara: aplikasi hidup di `http://localhost:3000`, tiap rute dimuat di iframe
same-origin dengan penangkap galat dipasang **sebelum** navigasi (supaya galat
saat skrip pertama dimuat ikut tertangkap). Bukan pembacaan kode.

## 1. Ringkasan

| Ukuran | Kasir | Manager | Admin |
|---|---|---|---|
| Menu di sidebar | **5** | **9** | **13** |
| Rute bisa dibuka | 5 | 9 | 13 |
| Rute ditolak (pagarnya jalan) | 8 | 4 | 0 |
| Galat konsol | 0 | 0 | 0 |
| Meluber horizontal (1440px) | 0 | 0 | 0 |

Catatan: jumlah menu Manager **9**, bukan 8 seperti tertulis di catatan rujukan
lama. Menu yang tampil untuk Manager: Dashboard, Transaksi, Pelanggan,
Loyalitas, Laporan penjualan, Campaign, Analitik, Pengaturan, Rekap kasir.
Empat yang tidak tampil: Pencocokan, Log Transaksi, Staf, Impor Majoo.

## 2. Pagar halaman terlarang (diuji dengan mengetik URL langsung)

| Rute | Kasir | Manager | Pesan yang muncul |
|---|---|---|---|
| `/laporan-penjualan` | ditolak | boleh | "Halaman ini hanya untuk admin dan manajer." |
| `/pencocokan` | ditolak | ditolak | "Mencocokkan transaksi impor Majoo ke pelanggan CRM hanya bisa dilakukan admin." |
| `/log-transaksi` | ditolak | ditolak | "Log transaksi lengkap hanya bisa dilihat admin." |
| `/staf` | ditolak | ditolak | "Akun Anda masuk sebagai Manager/Kasir. Pengelolaan akun staf hanya bisa dilakukan oleh admin." |
| `/impor-majoo` | ditolak | ditolak | "Impor data Majoo ke CRM hanya bisa dilakukan oleh admin." |
| `/campaign` | ditolak | boleh | "Halaman ini bukan untuk peran Kasir." |
| `/analitik` | ditolak | boleh | "Analitik dipakai untuk mengambil keputusan usaha, dan itu wewenang admin atau manajer." |
| `/rekap-kasir` | ditolak | boleh | "Rekap kinerja antar staf hanya bisa dilihat admin dan manajer." |

Semua 12 penolakan memakai kalimat yang menjelaskan **sebabnya** dan **apa yang
harus dilakukan**, bukan "403" mentah. Pagar tampilan bekerja penuh.

## 3. TEMUAN: pagar tampilan bukan pagar data

Halaman melarang kasir melihat omzet. Tetapi **kasir tetap bisa membaca seluruh
transaksi lewat REST API langsung** dengan tokennya sendiri, karena policy RLS
`transaksi baca` mengizinkan `kasir`, `manager`, dan `admin`.

Bukti (anon key + token kasir, `Prefer: return=representation`):

```
kasir melihat 12 transaksi: 0 miliknya, 12 milik orang lain
omzet yang bisa dijumlahkan kasir: Rp 373.000
```

Artinya: kasir yang membuka DevTools bisa menjumlahkan omzet bulanan, melihat
total per struk, dan melihat transaksi yang dicatat orang lain. Yang ia tidak
bisa: mengubah (PATCH -> 0 baris) atau menghapus.

Pagar di UI tetap berguna (menghalangi akses tidak sengaja), tetapi tidak boleh
disebut sebagai pengamanan.

## 4. TEMUAN: view rekap kinerja staf bisa dibaca kasir

`rekap_pencatat_transaksi` adalah view berisi omzet per staf. Yang terlihat
sebagai kasir:

```json
[
  {"nama": "Wahyu",       "jumlah_transaksi": 1,  "total_omzet": 25000},
  {"nama": "Impor Majoo", "jumlah_transaksi": 11, "total_omzet": 348000}
]
```

Halaman `/rekap-kasir` menolak kasir, tetapi view-nya berdiri sendiri dan
terbuka. Penyebab: `supabase/jejak-pencatat-transaksi.sql:213`

```sql
grant select on public.rekap_pencatat_transaksi to authenticated, service_role;
```

`authenticated` mencakup kasir. View tidak memakai RLS sehingga grant itu
adalah satu-satunya pagarnya, dan pagarnya tidak ada.

Pola grant yang sama ada di `aturan-poin.sql:107` dan `ledger-poin.sql:240`.
Keduanya perlu diperiksa dengan pertanyaan yang sama: isinya boleh dilihat
semua peran atau tidak.

## 5. Yang sudah aman (diuji, bukan diasumsikan)

| Uji | Hasil |
|---|---|
| Tanpa login, 5 tabel | ditolak 401 |
| Kasir ubah transaksi orang lain | 0 baris (ditolak RLS) |
| Kasir naikkan peran sendiri jadi admin | 0 baris (ditolak) |
| Manager naikkan peran sendiri jadi admin | 0 baris (ditolak) |
| Profil staf yang terlihat | kasir 1 (dirinya), manager 1 (dirinya), admin semua |

## 6. Catatan proses (penting untuk sesi berikutnya)

Skrip uji izin ronde pertama benar-benar menjalankan `INSERT` ke `transaksi` dan
meninggalkan **satu baris sampah** (`total: 1`) di data produksi. Baris itu
sudah dihapus dan jumlah transaksi kembali 12 / Rp 373.000.

Untuk uji izin berikutnya: cukup `PATCH` (0 baris = ditolak, membuktikan hal
yang sama). Jangan `INSERT` ke tabel produksi. Skrip sudah diperbaiki.

## 7. Alat

- `scripts/uji-rls-baca-peran.py` : peta baca per peran (ronde 1)
- `scripts/uji-rls-ronde2.py` : nama tabel benar, batas "milik sendiri vs orang
  lain", uji tulis, uji naik peran
