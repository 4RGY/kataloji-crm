-- =============================================================================
-- KOREKSI: POIN SALAH HITUNG SELAMA FUNGSI POIN RUSAK (PASCA MIGRASI POS NATIVE)
-- =============================================================================
-- Konteks:
--   supabase/pos-menu-promo.sql menimpa hitung_poin_transaksi() dengan rumus
--   per-rupiah hardcode 20.000, sehingga aturan_poin (per_kunjungan sejak
--   2026-10-02) diabaikan. Transaksi yang masuk selama jendela rusak menerima
--   poin lebih besar dari aturan. Fungsi sudah dipulihkan oleh
--   supabase/perbaikan-poin-pos-native.sql; skrip ini mengoreksi poin yang
--   SUDAH terlanjur diberikan.
--
-- Model saldo (penting):
--   public.saldo_poin() = sum(point_ledger.sisa) untuk tipe earn/adjust.
--   Jadi koreksi TIDAK boleh cuma menulis poin_keluar; kolom sisa pada baris
--   earn yang salah harus benar-benar diturunkan, kalau tidak saldo tetap.
--
-- Batasan yang disengaja:
--   1. Hanya transaksi bertanggal >= tanggal mulai aturan_poin paling awal
--      (2026-10-02). Transaksi sebelum itu sah memakai fallback per_rupiah
--      yang berlaku saat itu, jadi dibiarkan (grandfathered).
--   2. Tidak ada DELETE. Jejak lama tidak dihapus, hanya ditambah baris
--      'adjust' berisi selisih + keterangan asal-usulnya.
--   3. Idempoten: transaksi yang sudah punya baris 'adjust' dilewati.
--   4. Cache pelanggan.poin disinkronkan dari saldo_poin(), bukan ditambah manual.
-- =============================================================================

begin;

create temp table _koreksi_poin on commit drop as
with batas as (
  select min(mulai) as tgl_mulai from public.aturan_poin
),
kandidat as (
  select t.id,
         t.pelanggan_id,
         t.poin_didapat as poin_lama,
         coalesce(t.tanggal_majoo, (t.created_at at time zone 'Asia/Jakarta')::date) as tgl,
         t.created_at,
         coalesce(t.external_ref, '') as ref,
         coalesce(t.subtotal - coalesce(t.diskon, 0), t.total) as basis
  from public.transaksi t
  cross join batas b
  where t.pelanggan_id is not null
    and b.tgl_mulai is not null
    and coalesce(t.tanggal_majoo, (t.created_at at time zone 'Asia/Jakarta')::date) >= b.tgl_mulai
    and not exists (
      select 1 from public.point_ledger l
      where l.transaksi_id = t.id and l.tipe = 'adjust'
    )
)
select k.*,
       public.hitung_poin_aturan(k.pelanggan_id, k.tgl, k.id, k.ref, k.created_at, k.basis) as poin_baru
from kandidat k;

do $$
declare
  k record;
  sisa_kurang integer;
  ambil integer;
  baris record;
begin
  for k in
    select * from _koreksi_poin where poin_baru <> poin_lama order by created_at
  loop
    if k.poin_baru < k.poin_lama then
      -- Tarik kelebihan dari baris earn transaksi itu sendiri lebih dulu,
      -- lalu (bila kurang) dari baris earn lain terbaru milik pelanggan.
      sisa_kurang := k.poin_lama - k.poin_baru;

      for baris in
        select id, sisa from public.point_ledger
        where pelanggan_id = k.pelanggan_id
          and tipe = 'earn'
          and sisa > 0
        order by (transaksi_id = k.id) desc, created_at desc
      loop
        exit when sisa_kurang <= 0;
        ambil := least(baris.sisa, sisa_kurang);
        update public.point_ledger set sisa = sisa - ambil where id = baris.id;
        sisa_kurang := sisa_kurang - ambil;
      end loop;

      if sisa_kurang > 0 then
        raise exception 'koreksi poin gagal: pelanggan % kurang % poin untuk ditarik',
          k.pelanggan_id, sisa_kurang;
      end if;

      insert into public.point_ledger
        (pelanggan_id, transaksi_id, tipe, poin_keluar, sisa, keterangan)
      values
        (k.pelanggan_id, k.id, 'adjust', k.poin_lama - k.poin_baru, 0,
         format('Koreksi poin %s: tercatat %s, seharusnya %s menurut aturan %s. '
                'Penyebab: hitung_poin_transaksi ditimpa rumus per-rupiah oleh '
                'migrasi POS native (lihat perbaikan-poin-pos-native.sql).',
                coalesce(nullif(k.ref, ''), k.id::text), k.poin_lama, k.poin_baru,
                (select mode from public.aturan_poin_aktif(k.tgl))));
    else
      insert into public.point_ledger
        (pelanggan_id, transaksi_id, tipe, poin_masuk, sisa, kedaluwarsa_pada, keterangan)
      values
        (k.pelanggan_id, k.id, 'adjust', k.poin_baru - k.poin_lama, k.poin_baru - k.poin_lama,
         (current_date + interval '12 months')::date,
         format('Koreksi poin %s: tercatat %s, seharusnya %s menurut aturan %s.',
                coalesce(nullif(k.ref, ''), k.id::text), k.poin_lama, k.poin_baru,
                (select mode from public.aturan_poin_aktif(k.tgl))));
    end if;
  end loop;
end $$;

-- Catatan transaksi disesuaikan supaya laporan "poin diberikan" tidak
-- melanjutkan angka yang salah. Nilai lamanya tetap tersimpan pada keterangan
-- baris 'adjust' di atas.
update public.transaksi t
set poin_didapat = k.poin_baru
from _koreksi_poin k
where t.id = k.id and k.poin_baru <> k.poin_lama;

-- Sinkronkan cache saldo dari ledger.
update public.pelanggan p
set poin = public.saldo_poin(p.id)
where p.id in (select pelanggan_id from _koreksi_poin where poin_baru <> poin_lama);

commit;
