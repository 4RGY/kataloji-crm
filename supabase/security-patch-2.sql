-- ============================================================
-- PATCH KEAMANAN 2, Kataloji CRM
-- Prasyarat: schema.sql, rbac.sql, ledger-poin.sql, security-patch.sql
-- Aman dijalankan ulang (idempotent).
--
-- MASALAH YANG DIPERBAIKI
--
-- KRITIS: SERVER PERCAYA `poin_didapat` DARI KLIEN.
--
-- Terbukti live: satu permintaan REST dengan sesi staf yang sah,
-- mengirim {"total":1000,"poin_didapat":999999}, dan server mencatatnya
-- apa adanya. Saldo pelanggan melompat ke 1.000.004 poin. Karena
-- 1 poin = Rp 1.000, itu setara memalsukan Rp 1 miliar nilai loyalitas
-- yang bisa ditukar jadi potongan tagihan.
--
-- Akar masalahnya: rumus poin (BR-TRX-05) hanya hidup di
-- `src/lib/poin.ts`, yaitu kode yang jalan di BROWSER. Memvalidasi di
-- browser bukan pengamanan; klien bisa mengirim nilai apa pun langsung
-- ke /rest/v1/transaksi.
--
-- PERBAIKAN: hitung poin di DATABASE.
--   poin_didapat = floor((total - diskon) / 20000)
-- Nilai kiriman klien diabaikan sepenuhnya.
--
-- CATATAN DESAIN (penting, sempat salah):
-- Pekerjaan ini dipecah jadi DUA trigger, bukan satu.
--   BEFORE INSERT -> hanya menghitung/mengoreksi kolom (boleh ubah NEW)
--   AFTER  INSERT -> menulis ledger + menyinkronkan cache
-- Tidak bisa digabung. Di BEFORE INSERT baris transaksi belum ada,
-- sehingga menulis ke point_ledger dengan transaksi_id = NEW.id
-- langsung melanggar foreign key:
--   "insert or update on table point_ledger violates foreign key
--    constraint point_ledger_transaksi_id_fkey"
-- Trigger AFTER baru boleh dipakai kalau angkanya sudah final, karena
-- AFTER tidak bisa lagi mengubah NEW.
--
-- Mengapa 20000 dan 1000 ditulis di sini, bukan dibaca dari tabel
-- pengaturan: tabel pengaturan loyalitas belum ada (rencana Sprint 3).
-- Saat tabel itu dibuat, ganti dua angka ini dengan subquery ke sana.
-- ============================================================

-- ---------- 1. BEFORE INSERT: hitung poin di server ----------
create or replace function public.hitung_poin_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  basis integer;
begin
  if new.pelanggan_id is null then
    -- Tanpa pelanggan tidak ada poin yang perlu dicatat.
    new.poin_didapat := 0;
    new.poin_dipakai := 0;
    return new;
  end if;

  -- BR-TRX-05: basis = total setelah diskon promo, SEBELUM potongan poin.
  basis := greatest(0, coalesce(new.total, 0) - coalesce(new.diskon, 0));
  new.poin_didapat := floor(basis / 20000.0)::integer;

  -- poin_dipakai tetap pilihan kasir, tapi tidak boleh negatif.
  -- Kecukupan saldo diperiksa tukar_poin() saat ledger ditulis.
  if coalesce(new.poin_dipakai, 0) < 0 then
    new.poin_dipakai := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaksi_hitung_poin on public.transaksi;
create trigger trg_transaksi_hitung_poin
  before insert on public.transaksi
  for each row execute function public.hitung_poin_transaksi();

-- ---------- 2. AFTER INSERT: tulis ledger + sinkronkan cache ----------
create or replace function public.apply_transaksi_poin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pelanggan_id is null then
    return new;
  end if;

  -- Tukar poin LEBIH DULU, baru catat poin baru. Urutan ini penting
  -- supaya poin yang baru didapat tidak ikut terpakai di transaksi ini.
  if coalesce(new.poin_dipakai, 0) > 0 then
    perform public.tukar_poin(new.pelanggan_id, new.poin_dipakai, new.id);
  end if;

  if coalesce(new.poin_didapat, 0) > 0 then
    insert into public.point_ledger
      (pelanggan_id, transaksi_id, tipe, poin_masuk, sisa, kedaluwarsa_pada, keterangan)
    values
      (new.pelanggan_id, new.id, 'earn', new.poin_didapat, new.poin_didapat,
       (new.created_at + interval '12 months')::date, 'Poin dari transaksi');
  end if;

  update public.pelanggan
     set poin = public.saldo_poin(new.pelanggan_id)
   where id = new.pelanggan_id;

  return new;
end;
$$;

drop trigger if exists trg_transaksi_poin on public.transaksi;
create trigger trg_transaksi_poin
  after insert on public.transaksi
  for each row execute function public.apply_transaksi_poin();

-- ---------- 3. Batasi eksekusi fungsi internal dari klien ----------
-- Trigger jalan sebagai pemilik tabel; klien tidak perlu memanggil
-- fungsi ini langsung.
revoke execute on function public.hitung_poin_transaksi() from public, anon, authenticated;
revoke execute on function public.apply_transaksi_poin() from public, anon, authenticated;

-- ---------- 4. Jaring pengaman nilai kolom ----------
-- Nilai dari klien sudah ditimpa trigger, jadi batasan ini hanya
-- penjaga kalau nanti ada jalur tulis lain (impor CSV, perbaikan manual).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transaksi_poin_didapat_wajar') then
    alter table public.transaksi
      add constraint transaksi_poin_didapat_wajar
      check (poin_didapat >= 0 and poin_didapat <= 100000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transaksi_poin_dipakai_wajar') then
    alter table public.transaksi
      add constraint transaksi_poin_dipakai_wajar
      check (poin_dipakai >= 0 and poin_dipakai <= 100000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transaksi_total_wajar') then
    alter table public.transaksi
      add constraint transaksi_total_wajar
      check (total >= 0 and total <= 1000000000);
  end if;
end $$;

notify pgrst, 'reload schema';
