-- ============================================================
-- PERBAIKAN: ATURAN POIN HILANG SAAT MIGRASI POS NATIVE
-- ============================================================
-- Latar belakang (ditemukan lewat uji DB, bukan dugaan):
--
-- `pos-menu-promo.sql` bagian 7 meng-CREATE OR REPLACE fungsi
-- `hitung_poin_transaksi()` dengan versi yang HANYA:
--     poin = floor((subtotal - diskon) / poin_per_rupiah)
--
-- Versi itu benar soal BASIS (BR-TRX-05 baru: subtotal, tanpa PPN &
-- biaya layanan), tetapi membuang tiga hal yang sudah ada sebelumnya
-- di `aturan-poin.sql`:
--   1. Mode aturan periode (per_kunjungan / per_transaksi / per_nominal)
--      tidak lagi dipanggil. Aturan `per_kunjungan` yang aktif sejak
--      2 Okt 2026 diabaikan, sehingga pelanggan yang belanja Rp 100.000
--      mendapat 5 poin padahal aturannya 1 poin per kunjungan.
--   2. Resolusi `kode_pelanggan_majoo` + `status_pencocokan` untuk impor
--      tidak diisi, sehingga transaksi impor selalu berstatus 'anonim'
--      dan tidak pernah bisa dicocokkan.
--   3. Akibat (2), jalur "poin ditahan sampai pelanggan dikenal"
--      (`cocokkan_transaksi_menunggu` + `poin_pencocokan_transaksi`)
--      tidak pernah terpicu.
--
-- Berkas ini mengembalikan ketiganya, sambil TETAP memakai basis baru
-- (subtotal - diskon) dan tetap membaca angka loyalitas dari `settings`.
--
-- Sifat: idempotent (aman dijalankan berulang).
-- Urutan: jalankan SETELAH schema.sql, rbac.sql, ledger-poin.sql,
--         aturan-poin.sql, dan pos-menu-promo.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trigger hitung poin: aturan periode + resolusi pencocokan,
--    basis = subtotal - diskon
-- ------------------------------------------------------------
create or replace function public.hitung_poin_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tanggal date;
  basis integer;
begin
  tanggal := coalesce(
    new.tanggal_majoo,
    (new.created_at at time zone 'Asia/Jakarta')::date
  );

  -- Resolusi pelanggan & status pencocokan untuk impor. Nilai berasal
  -- dari server (pembaca berkas), bukan dari klien.
  if new.source = 'majoo_import' then
    if new.kode_pelanggan_majoo is not null and new.kode_pelanggan_majoo <> '' then
      if exists (
        select 1 from public.pelanggan p
        where p.kode_majoo = new.kode_pelanggan_majoo
      ) then
        select p.id into new.pelanggan_id
        from public.pelanggan p
        where p.kode_majoo = new.kode_pelanggan_majoo
        limit 1;
        new.status_pencocokan := 'terhubung';
      else
        new.status_pencocokan := 'menunggu_pencocokan';
        new.pelanggan_id := null;
      end if;
    else
      new.status_pencocokan := 'anonim';
      new.pelanggan_id := null;
    end if;
  else
    -- Jalur kasir / POS native: status diturunkan dari relasi pelanggan.
    new.status_pencocokan := case
      when new.pelanggan_id is not null then 'terhubung'
      else 'anonim'
    end;
  end if;

  -- BR-TRX-05: basis = subtotal - diskon (sebelum PPN & biaya layanan).
  -- Fallback ke total untuk baris lama yang subtotal-nya kosong.
  basis := greatest(0,
    coalesce(new.subtotal, new.total, 0) - coalesce(new.diskon, 0)
  );

  if new.pelanggan_id is null then
    new.poin_didapat := 0;
    new.poin_dipakai := greatest(0, coalesce(new.poin_dipakai, 0));
    return new;
  end if;

  -- Poin dihitung server menurut aturan periode tanggal transaksi;
  -- nilai kiriman klien diabaikan sepenuhnya (security-patch-2).
  new.poin_didapat := public.hitung_poin_aturan(
    new.pelanggan_id,
    tanggal,
    new.id,
    new.external_ref,
    new.created_at,
    basis
  );

  new.poin_dipakai := greatest(0, coalesce(new.poin_dipakai, 0));
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. hitung_poin_aturan: fallback tanpa aturan membaca `settings`,
--    bukan angka 20000 yang dipatri di kode
-- ------------------------------------------------------------
create or replace function public.hitung_poin_aturan(
  p_pelanggan_id uuid,
  p_tanggal date,
  p_tid uuid default null,
  p_ref text default null,
  p_created timestamptz default null,
  p_basis integer default 0
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  aturan record;
  basis integer;
  ada_sebelumnya boolean;
  v_poin_per_rupiah integer;
begin
  basis := greatest(0, coalesce(p_basis, 0));
  select * into aturan
    from public.aturan_poin_aktif(coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date));

  -- Tanpa aturan yang berlaku: model dasar tetap dipakai (fallback),
  -- angkanya dari settings supaya admin bisa mengubah tanpa ubah kode.
  if aturan is null then
    select value::integer into v_poin_per_rupiah
      from public.settings where key = 'poin_per_rupiah';
    if v_poin_per_rupiah is null or v_poin_per_rupiah <= 0 then
      v_poin_per_rupiah := 20000;
    end if;
    return floor(basis / v_poin_per_rupiah::numeric)::integer;
  end if;

  -- Walk-in tidak menghasilkan poin di semua mode.
  if p_pelanggan_id is null then
    return 0;
  end if;

  case aturan.mode
  when 'per_nominal' then
    return floor(basis / greatest(1, coalesce(aturan.nominal, 20000)))::integer;

  when 'per_transaksi' then
    return 1;

  when 'per_kunjungan' then
    -- 1 poin per pelanggan per tanggal. Kunjungan pertama pada tanggal
    -- itu dapat poin; transaksi susulan tetap tercatat untuk analitik
    -- tetapi 0 poin.
    --
    -- "Sebelumnya" ditentukan urut pencatatan: dibuat lebih dulu, atau
    -- nomor struk Majoo lebih kecil (tie-break dipakai karena semua
    -- baris satu batch impor berbagi created_at yang sama).
    ada_sebelumnya := exists (
      select 1
      from public.transaksi t2
      where t2.pelanggan_id = p_pelanggan_id
        and coalesce(t2.tanggal_majoo, (t2.created_at at time zone 'Asia/Jakarta')::date)
            = coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date)
        and (p_tid is null or t2.id <> p_tid)
        and (t2.created_at, coalesce(t2.external_ref, ''))
            < (coalesce(p_created, now()), coalesce(p_ref, ''))
    );
    if ada_sebelumnya then
      return 0;
    end if;
    return 1;

  else
    raise exception 'mode aturan poin tidak dikenal: %', aturan.mode;
  end case;
end;
$$;

-- ------------------------------------------------------------
-- 3. Pencocokan: basis subtotal + masa berlaku dari settings
-- ------------------------------------------------------------
create or replace function public.poin_pencocokan_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tanggal date;
  poin integer;
  v_bulan integer;
begin
  -- Hanya saat tautan pelanggan BARU terbentuk.
  if new.pelanggan_id is null
     or new.pelanggan_id is not distinct from old.pelanggan_id then
    return new;
  end if;

  tanggal := coalesce(
    new.tanggal_majoo,
    (new.created_at at time zone 'Asia/Jakarta')::date
  );

  poin := public.hitung_poin_aturan(
    new.pelanggan_id,
    tanggal,
    new.id,
    new.external_ref,
    new.created_at,
    greatest(0, coalesce(new.subtotal, new.total, 0) - coalesce(new.diskon, 0))
  );

  update public.transaksi
     set poin_didapat = poin,
         status_pencocokan = 'terhubung'
   where id = new.id;

  if poin > 0 then
    select value::integer into v_bulan
      from public.settings where key = 'masa_kadaluwarsa_poin_bulan';
    if v_bulan is null or v_bulan <= 0 then
      v_bulan := 12;
    end if;

    insert into public.point_ledger
      (pelanggan_id, transaksi_id, tipe, poin_masuk, sisa, kedaluwarsa_pada, keterangan)
    values
      (new.pelanggan_id, new.id, 'earn', poin, poin,
       (coalesce(tanggal, (now() at time zone 'Asia/Jakarta')::date) + (v_bulan || ' months')::interval)::date,
       'Poin dari pencocokan transaksi ' || coalesce(new.external_ref, new.id::text));
  end if;

  update public.pelanggan
     set poin = public.saldo_poin(new.pelanggan_id)
   where id = new.pelanggan_id;

  return new;
end;
$$;

-- create or replace mereset ACL: tutup lagi untuk anon & klien biasa.
revoke execute on function public.hitung_poin_transaksi() from public, anon, authenticated;
revoke execute on function public.hitung_poin_aturan(uuid, date, uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.poin_pencocokan_transaksi() from public, anon, authenticated;
