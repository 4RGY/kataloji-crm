# Proposal: QR dinamis dan pembayaran (pengganti Majoo di kafe)

Dokumen ini membahas keputusan, belum kode. Semua klaim tentang kondisi sekarang sudah diperiksa di repo.

## Kondisi sekarang (dari kode)

- CRM **tidak memproses pembayaran sama sekali**. Tidak ada integrasi gateway, EDC, QRIS, atau Midtrans di `src/`.
- `metode_bayar` hanya teks bebas yang dicatat. Asalnya dari impor Majoo ("QRIS", "Tunai", dll.) atau input kasir.
- Transaksi tercatat **setelah** pembayaran terjadi di Majoo atau EDC. CRM hanya mencatatnya.
- Poin dihitung CRM dari total transaksi, bukan dari Majoo.

Kalau Majoo diganti, CRM harus bisa menerima transaksi tanpa Majoo. Itu berarti ada dua hal yang harus diputuskan: **siapa yang memproses pembayaran**, dan **bagaimana transaksi masuk ke CRM**.

## Keputusan (12 Okt 2026)

**Dipilih: QRIS dinamis via penyedia, kasir input pesanan.** Self-order ditunda. Penyedia dan akun merchant belum ditentukan, jadi pekerjaan kode belum dimulai.

## Pertanyaan yang harus dijawab dulu

1. **Pembayaran diproses di mana?**
   - (a) Tetap di EDC bank, CRM hanya mencatat nominal dan metode.
   - (b) QRIS dinamis lewat penyedia (Midtrans, Xendit, atau lainnya), CRM menerima notifikasi bayar.
   - (c) Kombinasi: QRIS lewat penyedia, tunai dan kartu lewat kasir.
2. **Apakah pelanggan memesan sendiri lewat QR (self-order), atau kasir yang input pesanan?**
   - Self-order butuh halaman menu publik, keranjang, dan alur bayar. Ini ruang lingkup besar.
   - Kasir input saja: QR hanya untuk pembayaran atau menu, jauh lebih kecil.
3. **Siapa yang menerima uang?** Ini menyangkut rekening dan merchant, bukan kode. Perlu konfirmasi mitra.

## Pilihan (kelebihan dan kekurangan)

| No | Opsi | Kelebihan | Kekurangan |
|---|---|---|---|
| 1 | **QR statis per meja** (cetak sekali) | Paling murah dan cepat. Tidak butuh gateway. | Tidak tahu nominal, pelanggan harus input manual. Tidak ada konfirmasi otomatis. |
| 2 | **QRIS dinamis via penyedia** (Midtrans/Xendit) | Nominal otomatis, konfirmasi bayar real-time. Standar pasar. | Butuh akun merchant dan biaya per transaksi. Butuh webhook dan penanganan gagal bayar. |
| 3 | **Self-order QR** (menu + bayar) | Pelanggan pesan dan bayar sendiri, kasir tidak sibuk. | Terbesar: menu publik, keranjang, stok, dan alur bayar. Waktu lama. |

## Rekomendasi (⭐)

**⭐ Opsi 2, tahap bertahap:**
1. Mulai dari QRIS dinamis (opsi 2) untuk pembayaran saja. Kasir tetap input pesanan. Ini mengganti peran Majoo dalam hal bayar, dan paling berdampak dengan biaya pengembangan yang masih wajar.
2. Self-order (opsi 3) ditunda ke tahap berikutnya, setelah tahap 1 stabil.

Alasannya: opsi 2 sudah cukup untuk menggantikan Majoo dari sisi pembayaran, sedangkan opsi 3 adalah proyek tersendiri.

## Yang perlu saya tahu dari lu

- Penyedia QRIS mana yang akan dipakai, dan apakah sudah punya akun merchant?
- Apakah EDC tetap dipakai untuk kartu? Kalau ya, CRM hanya mencatat, tidak memproses kartu.
- Apakah ini untuk Kataloji Coffee langsung (produksi), dan siapa yang bertanggung jawab atas akun pembayaran?

## Catatan keamanan

- Kunci gateway tidak boleh masuk repo. Disimpan di `.env.local` atau secret manager.
- Notifikasi bayar (webhook) harus diverifikasi tanda tangannya, supaya tidak bisa dipalsukan.
- Prinsip audit berlaku: transaksi yang sudah dibayar tidak diubah diam-diam.
