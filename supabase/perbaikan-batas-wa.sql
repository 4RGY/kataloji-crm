-- ============================================================
-- Perbaikan BUG-02: samakan batas panjang nomor WhatsApp
-- antara database dan aplikasi
-- ============================================================
--
-- MASALAH
-- Aplikasi (src/lib/pelanggan-tampilan.ts, validasiPelanggan) menerima nomor
-- hanya bila setelah dirapikan panjangnya 11 sampai 15 angka dan berawalan 62.
-- Database (security-patch-3.sql) hanya mensyaratkan panjang >= 9, tanpa batas
-- atas. Akibatnya nomor 9 digit, 10 digit, atau 16 digit ditolak di layar
-- tetapi DITERIMA kalau ditulis lewat jalur lain (skrip, dasbor, atau perbaikan
-- manual). Nomor seperti itu akan gagal terkirim saat broadcast dan tidak ada
-- yang tahu.
--
-- Sudah dibuktikan lewat pengujian: pengiriman nomor 9 digit, 10 digit, dan
-- 16 digit ke POST /rest/v1/pelanggan semuanya diterima (201), sementara
-- aturan aplikasi menolaknya.
--
-- CARA PAKAI
-- Jalankan seluruh berkas ini di Supabase SQL Editor.
-- Aman dijalankan berulang kali.
--
-- PENTING: jalankan LANGKAH 0 lebih dulu. Kalau ada baris yang muncul,
-- perbaiki nomor itu sebelum menjalankan LANGKAH 2, karena constraint baru
-- akan menolaknya.
-- ============================================================


-- ---------- LANGKAH 0. PERIKSA DULU: baris yang tidak memenuhi aturan baru ----------
-- Harus mengembalikan NOL baris sebelum lanjut ke LANGKAH 2.
select
  id,
  nama,
  whatsapp as nomor_tersimpan,
  public.normalisasi_whatsapp(whatsapp) as nomor_setelah_dirapikan,
  length(public.normalisasi_whatsapp(whatsapp)) as jumlah_angka,
  case
    when length(public.normalisasi_whatsapp(whatsapp)) < 11 then 'terlalu pendek'
    when length(public.normalisasi_whatsapp(whatsapp)) > 15 then 'terlalu panjang'
    when left(public.normalisasi_whatsapp(whatsapp), 2) <> '62' then 'bukan nomor Indonesia'
  end as alasan
from public.pelanggan
where length(public.normalisasi_whatsapp(whatsapp)) < 11
   or length(public.normalisasi_whatsapp(whatsapp)) > 15
   or left(public.normalisasi_whatsapp(whatsapp), 2) <> '62'
order by nama;


-- ---------- LANGKAH 1. Buang constraint lama yang terlalu longgar ----------
alter table public.pelanggan
  drop constraint if exists pelanggan_whatsapp_isi;


-- ---------- LANGKAH 2. Pasang constraint yang sesuai aturan aplikasi ----------
-- 11-15 angka setelah dirapikan, dan wajib berawalan 62 (nomor Indonesia).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pelanggan_whatsapp_isi'
  ) then
    alter table public.pelanggan
      add constraint pelanggan_whatsapp_isi
      check (
        length(public.normalisasi_whatsapp(whatsapp)) between 11 and 15
        and left(public.normalisasi_whatsapp(whatsapp), 2) = '62'
      );
  end if;
end $$;


-- ---------- LANGKAH 3. Buktikan constraint-nya bekerja ----------
-- Ketiga perintah ini HARUS gagal. Kalau ada yang berhasil, constraint belum
-- terpasang dan langkah 2 perlu diulang.
--
--   insert into public.pelanggan (nama, whatsapp, tgl_lahir)
--     values ('UJI-PENDEK', '62812345', '1990-01-01');        -- 8 angka
--
--   insert into public.pelanggan (nama, whatsapp, tgl_lahir)
--     values ('UJI-PANJANG', '6281234567890123', '1990-01-01'); -- 16 angka
--
--   insert into public.pelanggan (nama, whatsapp, tgl_lahir)
--     values ('UJI-BUKAN-ID', '1234567890123', '1990-01-01');  -- bukan 62


-- ---------- CATATAN ----------
-- 1. Baris dengan penanda '-DUP' (sisa dari perapian duplikat di
--    security-patch-3.sql) juga akan diperiksa. `normalisasi_whatsapp` membuang
--    karakter selain angka, sehingga '-DUP2' hilang dan angkanya dinilai apa
--    adanya. Pastikan baris seperti itu tidak ikut tertolak; kalau ada, rapikan
--    nomornya lebih dulu.
-- 2. Batas 11-15 angka mengikuti `validasiPelanggan`. Kalau aturan aplikasi
--    berubah, berkas ini harus diubah bersamaan, karena dua tempat ini wajib
--    sepakat.
