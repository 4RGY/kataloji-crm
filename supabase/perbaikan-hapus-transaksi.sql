-- ============================================================
-- PERBAIKAN BUG-06: POIN HANTU SAAT HAPUS TRANSAKSI
--
-- Saat transaksi dihapus, point_ledger.transaksi_id di-SET NULL
-- oleh FK, tapi baris earn/redeem tetap ada. Poin yang sudah
-- diberikan tidak dikembalikan -> "poin hantu".
--
-- Fix: trigger BEFORE DELETE di tabel transaksi yang:
--   1. Pulihkan sisa di batch FIFO yang dimakan oleh redeem
--   2. Hapus baris earn + redeem yang merujuk transaksi ini
--   3. Refresh pelanggan.poin = saldo_poin(id)
--
-- Kenapa BEFORE, bukan AFTER? Karena FK point_ledger.transaksi_id
-- punya ON DELETE SET NULL. Setelah delete, transaksi_id sudah null
-- dan baris ledger tidak bisa ditemukan lagi lewat transaksi_id.
--
-- Idempoten: drop trigger dulu sebelum create ulang.
-- ============================================================

create or replace function public.pulihkan_poin_hapus_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pelanggan uuid;
  redeem_baris record;
  batch record;
  butuh integer;
  ambil integer;
begin
  -- Ambil pelanggan dari transaksi yang akan dihapus.
  v_pelanggan := old.pelanggan_id;

  -- Kalau transaksi tanpa pelanggan, tidak ada poin untuk dipulihkan.
  if v_pelanggan is null then
    return old;
  end if;

  -- 1. Pulihkan sisa di batch FIFO yang dimakan oleh redeem transaksi ini.
  --    Setiap baris redeem mencatat poin_keluar. Kita cari batch earn/adjust
  --    yang punya sisa < poin_masuk (sudah dimakan sebagian) urut FIFO,
  --    dan pulihkan sebanyak yang dimakan oleh redeem ini.
  for redeem_baris in
    select id, poin_keluar
    from public.point_ledger
    where transaksi_id = old.id
      and tipe = 'redeem'
      and poin_keluar > 0
    order by created_at
  loop
    butuh := redeem_baris.poin_keluar;

    -- Pulihkan batch yang sebelumnya dimakan, urut kedaluwarsa (FIFO).
    for batch in
      select id, sisa, poin_masuk
      from public.point_ledger
      where pelanggan_id = v_pelanggan
        and tipe in ('earn', 'adjust')
        and sisa < poin_masuk
        and (kedaluwarsa_pada is null or kedaluwarsa_pada > current_date)
      order by kedaluwarsa_pada nulls last, created_at
    loop
      exit when butuh <= 0;

      -- Pulihkan sebanyak yang dimakan, tapi tidak lebih dari poin_masuk awal.
      ambil := least(batch.poin_masuk - batch.sisa, butuh);
      update public.point_ledger
         set sisa = sisa + ambil
       where id = batch.id;
      butuh := butuh - ambil;
    end loop;
  end loop;

  -- 2. Hapus baris earn + redeem yang merujuk transaksi ini.
  delete from public.point_ledger
   where transaksi_id = old.id
     and tipe in ('earn', 'redeem');

  -- 3. Refresh cache pelanggan.poin.
  update public.pelanggan
     set poin = public.saldo_poin(v_pelanggan)
   where id = v_pelanggan;

  return old;
end;
$$;

drop trigger if exists trg_transaksi_hapus_poin on public.transaksi;
create trigger trg_transaksi_hapus_poin
  before delete on public.transaksi
  for each row execute function public.pulihkan_poin_hapus_transaksi();
