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

## 3. TEMUAN: pagar halaman, bukan pagar data (dan ini memang disengaja)

> Ringkas: kasir bisa membaca baris transaksi lewat REST walau halaman omzet
> ditolak. Setelah diperiksa, ini **bukan celah**: dashboard kasir sendiri
> menampilkan omzet, jadi policy yang mengizinkan kasir baca transaksi memang
> diperlukan. Rinciannya di bawah.

Halaman melarang kasir membuka laporan penjualan dan analitik (halaman omzet
khusus admin/manager). Tetapi **kasir tetap bisa membaca seluruh transaksi lewat
REST API langsung** dengan tokennya sendiri, karena policy RLS `transaksi baca`
mengizinkan `kasir`, `manager`, dan `admin`.

Bukti (anon key + token kasir, `Prefer: return=representation`):

```
kasir melihat 12 transaksi: 0 miliknya, 12 milik orang lain
omzet yang bisa dijumlahkan kasir: Rp 373.000
```

Artinya: kasir yang membuka DevTools bisa menjumlahkan omzet bulanan, melihat
total per struk, dan melihat transaksi yang dicatat orang lain. Yang ia tidak
bisa: mengubah (PATCH -> 0 baris) atau menghapus.

### Kenapa policy-nya mengizinkan kasir: karena memang disengaja

Ini **bukan** kelalaian, dan halaman kasir memang menampilkan omzet. Diperiksa di
aplikasi hidup sebagai kasir (`anggara@kataloji.id`):

```
OMZET · HARI INI          Rp 25.000
Rata-rata harian          Rp 25.000
Transaksi terbesar        Rp 25.000
Rata-rata per struk       Rp 25.000
TREN OMZET HARIAN         (grafik)
```

Jadi kasir **memang diberi** ringkasan omzet di dashboard-nya. Yang dibatasi
hanya halaman analitik dan laporan penjualan (keduanya untuk keputusan usaha,
wewenang admin/manager).

**Konsekuensinya:** "kasir bisa membaca omzet lewat REST" bukan celah yang bisa
ditutup dengan mencabut izin baca tabel `transaksi`. Selama dashboard kasir
sendiri menampilkan omzet, RLS harus mengizinkan kasir membaca baris transaksi.
Menutupnya berarti membuang fitur yang sudah ada, dan itu keputusan produk, bukan
keputusan teknis.

Kalau memang ingin kasir **tidak** melihat omzet sama sekali, yang perlu diubah
adalah hal yang lebih besar dari RLS:
1. Dashboard kasir dirombak supaya tidak menampilkan omzet (cukup jumlah
   transaksi dan data pelanggan), **lalu**
2. RLS diganti dengan view agregat tanpa kolom omzet untuk kasir, **dan**
3. halaman Transaksi serta Dashboard kasir disesuaikan supaya tidak membaca baris
   transaksi langsung.

Tiga langkah itu satu paket. Mengerjakan langkah 2 saja akan mematahkan aplikasi.

Pagar di UI tetap berguna (menghalangi akses tidak sengaja), tetapi tidak boleh
disebut sebagai pengamanan.

## 4. KOREKSI: view rekap kinerja staf TIDAK bocor (klaim awal salah)

> **Bagian ini menggantikan klaim awal yang keliru.** Draf pertama laporan ini
> menulis bahwa `rekap_pencatat_transaksi` "berdiri sendiri dan terbuka" karena
> `grant select ... to authenticated` tidak dibatasi peran. **Itu salah.** Grant
> `authenticated` di situ bukan pagarnya, dan pagarnya memang ada.

Bukti pengujian ulang (kasir, token sendiri):

```
transaksi terlihat kasir        : 12 baris
rekap_pencatat_transaksi        : 2 baris (agregat per staf)
total transaksi dihitung view   : 12
-> SAMA: view tidak membocorkan baris yang disembunyikan transaksi
```

Penyebabnya terbaca di `supabase/jejak-pencatat-transaksi.sql:200-202`:

```sql
-- security_invoker supaya RLS tabel transaksi tetap berlaku bagi pemanggil.
create or replace view public.rekap_pencatat_transaksi
with (security_invoker = true)
```

`security_invoker = true` membuat view dijalankan **sebagai pemanggil**, bukan
sebagai pemilik. Jadi policy `transaksi baca` tetap berlaku. Jumlah baris di view
(12) persis sama dengan yang terlihat di tabel (12): view tidak menambah apa pun.

Grant `to authenticated` itu **wajib** ada. Tanpa grant, peran `authenticated`
tidak punya izin tabel sama sekali dan RLS tidak pernah dievaluasi; yang muncul
`permission denied`, bukan penyaringan. Jadi pola `grant` + `RLS` di sini sudah
benar, bukan celah.

### Pemeriksaan pola grant yang sama (batal)

Draf pertama menandai `aturan-poin.sql:107` dan `ledger-poin.sql:240` sebagai
"perlu diperiksa". Sudah diperiksa, dan **keduanya juga sudah benar**:

| Tabel | Policy | Boleh dibaca |
|---|---|---|
| `point_ledger` | `ledger baca (staf)` | admin, manager, kasir |
| `aturan_poin` | `aturan_poin baca (staf)` | admin, manager, kasir |

Pemberian akses ke kasir di sini **memang diperlukan**, bukan kelalaian: halaman
Dashboard, Pelanggan, dan Loyalitas (semuanya boleh dibuka kasir) membaca
`point_ledger`; halaman Pengaturan (boleh dibuka kasir, mode baca saja) membaca
`aturan_poin`. Mencabut grant-nya akan mematahkan halaman-halaman itu.

`anon` ditolak 401 di keempat objek (view + 3 tabel). Diperiksa, bukan
diasumsikan.

### Pelajaran

Grant `select ... to authenticated` dengan sendirinya **bukan** tanda celah. Yang
menentukan adalah ada tidaknya RLS (`policy` untuk tabel, `security_invoker` untuk
view). Draf pertama salah menyimpulkan dari grant saja tanpa membaca policy, dan
kesimpulan itu sempat ditulis ke tiga tempat (docs repo, skill, vault) sebelum
diperiksa ulang. Bukti: `scripts/uji-rls-ronde3-verifikasi.py`.

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
