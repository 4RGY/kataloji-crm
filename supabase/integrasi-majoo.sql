-- ============================================================
-- Migration: Integrasi Impor Majoo
-- ============================================================
-- Menyiapkan skema supaya data pelanggan & transaksi hasil ekspor
-- Majoo bisa diimpor dengan aman dan idempoten (tidak dobel bila
-- file yang sama diimpor ulang).
--
-- Arah integrasi (keputusan bersama PIC operasional):
--   CRM mengisi data H+1 via impor dari Majoo, BUKAN paralel realtime.
--   Poin tetap dihitung CRM (Majoo tidak lagi jadi sumber poin).
--
-- Perubahan:
--   1. pelanggan.kode_majoo     : kunci dedup pelanggan (Kode Pelanggan)
--   2. pelanggan.jenis_kelamin  : L/P dari Majoo (opsional)
--   3. pelanggan.email          : dari Majoo (opsional)
--   4. pelanggan.alamat         : dari Majoo (opsional)
--   5. transaksi.metode_bayar   : cara bayar dari Majoo (opsional)
--
-- Idempoten: tiap blok memakai IF NOT EXISTS / IF EXISTS sehingga aman
-- dijalankan berulang kali.
-- ============================================================

-- ---------- pelanggan.kode_majoo ----------
alter table public.pelanggan
  add column if not exists kode_majoo text;

-- Unik supaya impor ulang tidak membuat baris dobel. Nilai NULL boleh
-- banyak (pelanggan yang dibuat manual di CRM tidak punya kode Majoo).
create unique index if not exists pelanggan_kode_majoo_unik
  on public.pelanggan (kode_majoo)
  where kode_majoo is not null;

-- ---------- pelanggan.jenis_kelamin ----------
alter table public.pelanggan
  add column if not exists jenis_kelamin text;

-- ---------- pelanggan.email ----------
alter table public.pelanggan
  add column if not exists email text;

-- ---------- pelanggan.alamat ----------
alter table public.pelanggan
  add column if not exists alamat text;

-- ---------- transaksi.metode_bayar ----------
alter table public.transaksi
  add column if not exists metode_bayar text;

-- ---------- transaksi.external_ref (kunci dedup transaksi) ----------
-- Nomor transaksi Majoo (mis. CS/23/260919/0001) jadi kunci agar impor
-- ulang file yang sama TIDAK menggandakan baris. Kolom boleh NULL (transaksi
-- manual CRM yang tanpa nomor struk), sehingga indeks uniknya partial.
create unique index if not exists transaksi_external_ref_unik
  on public.transaksi (external_ref)
  where external_ref is not null;

-- ---------- transaksi.source: izinkan 'majoo_import' ----------
-- Transaksi hasil impor file Majoo ditandai source 'majoo_import' supaya
-- jejak audit jelas membedakannya dari entri manual ('crm_manual') dan
-- sinkron paralel ('majoo_parallel'). Perluasan CHECK lama bersifat aditif
-- (tidak menghapus nilai yang sudah diizinkan).
alter table public.transaksi
  drop constraint if exists transaksi_source_cek;

alter table public.transaksi
  add constraint transaksi_source_cek
  check (
    source = any (array['crm_manual', 'majoo_parallel', 'csv_import', 'majoo_import'])
  );

