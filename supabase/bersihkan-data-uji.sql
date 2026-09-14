-- ============================================================
-- PEMBERSIHAN DATA UJI, Kataloji CRM
-- Jalankan SEKALI di SQL Editor setelah semua patch terpasang.
--
-- LATAR BELAKANG
-- Saat menguji keamanan, celah "server percaya poin_didapat dari
-- klien" berhasil dieksploitasi dan meninggalkan data palsu:
--   - 1 transaksi total 1.000 dengan poin_didapat 999999
--   - 1 baris ledger earn 999999
--   - 1 baris ledger redeem 1 (penukaran tanpa hak, dari celah anon
--     di security-patch.sql)
-- Akibatnya saldo pelanggan "Anggara" terbaca 1.000.004 poin.
--
-- Baris ledger TIDAK bisa dihapus lewat API klien, dan itu memang
-- disengaja: `point_ledger` adalah buku besar audit, jadi hanya punya
-- policy SELECT (staf) dan INSERT (admin). Tidak ada policy DELETE,
-- supaya catatan poin tidak bisa dihapus dari browser. Pembersihan
-- data sampah karena itu harus lewat SQL Editor seperti ini.
--
-- Aman dijalankan berulang: syaratnya spesifik ke nilai palsu.
-- ============================================================

-- ---------- 1. Hapus transaksi palsu ----------
-- Ditandai dari nilainya: total 1.000 dengan poin jauh di luar akal.
delete from public.transaksi
where total = 1000
  and poin_didapat > 100;

-- ---------- 2. Hapus baris ledger palsu ----------
-- (a) earn dengan poin mustahil
delete from public.point_ledger
where tipe = 'earn'
  and poin_masuk > 100000;

-- (b) redeem yang tercatat tanpa transaksi dan tanpa jejak tukar sah.
--     Penukaran sah selalu punya keterangan 'Penukaran poin di kasir'
--     DAN terhubung ke transaksi. Yang tanpa transaksi_id dan nilainya
--     kecil (sisa eksploitasi) dihapus.
delete from public.point_ledger
where tipe = 'redeem'
  and transaksi_id is null
  and poin_keluar <= 5;

-- ---------- 3. Rapikan sisa pada batch earn yang sudah tak terpakai ----------
-- Batch yang sisanya sudah 0 karena dipakai penukaran palsu dikembalikan
-- ke nilai masuknya, lalu penukaran sah dihitung ulang dari nol.
-- Karena itu langkah ini hanya menyamakan cache dengan isi ledger.
update public.pelanggan p
   set poin = public.saldo_poin(p.id);

-- ---------- 4. Tampilkan hasil ----------
select
  p.nama,
  p.poin as "poin_tersimpan",
  public.saldo_poin(p.id) as "saldo_dari_ledger",
  (select count(*) from public.transaksi t where t.pelanggan_id = p.id) as "jumlah_transaksi",
  (select coalesce(sum(l.poin_masuk), 0) from public.point_ledger l
    where l.pelanggan_id = p.id and l.tipe = 'earn') as "total_poin_didapat",
  (select coalesce(sum(l.poin_keluar), 0) from public.point_ledger l
    where l.pelanggan_id = p.id) as "total_poin_keluar"
from public.pelanggan p
order by p.nama;

notify pgrst, 'reload schema';
