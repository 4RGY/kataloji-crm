# Pertanyaan untuk PIC Operasional — Impor Data Majoo → CRM

Ditujukan ke PIC operasional Kataloji. Jawaban di bawah menentukan bisa/tidaknya
CRM mencatat **detail transaksi per pelanggan** (poin #8 rapat).

---

## Masalah yang ditemukan

Kita sudah bisa impor **Data Pelanggan** dari Majoo (file `.xlsx`) → CRM. Sudah jalan
dan idempoten (impor ulang file yang sama tidak menggandakan data).

Tapi untuk **transaksi**, file yang ada sekarang (`detil_penjualan_*.pdf`) adalah
**laporan/printout**, bukan data ekspor. Isinya:

- Ada nomor transaksi (`CS/23/260919/0001` dst), total, metode bayar, dan produk.
- **TIDAK ada kolom nama/kode pelanggan** di tiap baris transaksi.

Akibatnya CRM bisa mencatat transaksinya, tapi **tidak tahu transaksi itu milik
pelanggan siapa** — padahal itulah inti poin #8 ("detail transaksi per pelanggan"
dan dasar perhitungan poin kunjungan/loyalitas).

---

## Yang kami minta dari PIC

Mohon ekspor dari Majoo dengan format **bukan PDF**, yaitu `.xlsx` (Excel) atau `.csv`,
dari menu yang memuat **satu baris = satu transaksi** DAN menyertakan **kode/nama
pelanggan** di tiap baris.

Kalau di Majoo ada beberapa opsi ekspor, tolong dipilih/dipastikan yang memuat
kolom-kolom berikut (nama kolom boleh beda, yang penting isinya ada):

| Data | Wajib? | Keterangan |
|---|---|---|
| Nomor transaksi / no. struk | ✅ | contoh: `CS/23/260919/0001` |
| Nama pelanggan **atau** kode pelanggan | ✅ | ini yang paling penting |
| Tanggal & jam transaksi | ✅ | supaya bisa catat "kunjungan" per hari |
| Total bayar | ✅ | dasar nilai transaksi |
| Rincian produk (nama + jumlah) | disarankan | biar detail per kunjungan lengkap |
| Metode pembayaran | disarankan | tunai / QRIS / kartu |
| Diskon / potongan | opsional | kalau ada |

---

## Pertanyaan singkat (bisa dijawab cepat)

1. Di Majoo, apakah ada menu ekspor **"Detail Penjualan"** atau **"Riwayat
   Transaksi"** dalam format **Excel/CSV** (bukan cetak PDF)?
   - Kalau ada: menu apa namanya, dan apakah tiap barisnya memuat nama/kode pelanggan?
   - Kalau tidak ada: apa alternatifnya? (mis. laporan "pelanggan + transaksi"
     gabungan, atau API Majoo).

2. Apakah transaksi **walk-in tanpa member** (tidak pakai nomor HP/poin) juga perlu
   masuk CRM? Atau cukup yang punya identitas pelanggan saja?

3. Untuk nomor HP pelanggan di Majoo — apakah selalu 11–15 digit berawalan 08/62?
   (Kami menemukan contoh `085123456` yang cuma 10 digit; baris seperti itu kami
   lewati otomatis, bukan dipaksa masuk.)

---

## Catatan teknis (untuk konteks, bukan pertanyaan)

- CRM **tidak** mengambil kolom poin dari Majoo. Poin tetap dihitung CRM sendiri
  (CRM = sumber kebenaran poin).
- Impor berjalan **H+1**, jadi file ekspor bisa dibuat keesokan harinya, tidak perlu
  realtime.
