-- ============================================================
-- Migration: Aturan Poin Per Periode + Pencocokan Impor Majoo
-- Kataloji CRM
-- Prasyarat: schema.sql, rbac.sql, ledger-poin.sql,
--            security-patch-2.sql, integrasi-majoo.sql
-- Aman dijalankan ulang (idempotent).
--
-- Keputusan bisnis (diskusi tim + PIC):
--   * Impor Majoo H+1, data pelanggan & detail transaksi diekspor
--     XLSX/CSV lalu masuk CRM.
--   * Pencocokan transaksi ke pelanggan memakai Kode Pelanggan Majoo
--     (kunci utama). Nama hanya pendukung, bukan kunci.
--   * Transaksi tanpa pengenal, atau pengenalnya belum ada di CRM,
--     tidak ditolak: status 'menunggu_pencocokan'. Poin ditahan
--     sampai pelanggan tertaut (otomatis saat datanya masuk, atau
--     manual lewat halaman Pencocokan).
--   * Aturan poin berversi per periode: per_nominal / per_kunjungan /
--     per_transaksi. Periode tidak boleh tumpang tindih. Poin lama
--     TIDAK dihitung ulang; tiap transaksi memakai aturan yang berlaku
--     pada tanggal transaksinya.
--
-- Catatan arsitektur: security-patch-2.sql menulis di kepalanya bahwa
-- saat tabel pengaturan loyalitas dibuat, angka 20000 yang di-hardcode
-- di hitung_poin_transaksi() harus diganti. Berkas ini adalah tabel
-- itu, jadi trigger hitung poin dioverride di sini.
-- ============================================================

-- ---------- 1. Kolom transaksi untuk pencocokan ----------

alter table public.transaksi
  add column if not exists kode_pelanggan_majoo text;

alter table public.transaksi
  add column if not exists nama_pelanggan_majoo text;

-- Status pencocokan hasil impor Majoo:
--   terhubung            : sudah tertaut ke pelanggan CRM
--   menunggu_pencocokan  : punya pengenal Majoo, pelanggan belum dikenal
--   anonim               : tanpa identitas (walk-in / manual tanpa pelanggan)
alter table public.transaksi
  add column if not exists status_pencocokan text not null default 'anonim';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transaksi_status_pencocokan_cek') then
    alter table public.transaksi
      add constraint transaksi_status_pencocokan_cek
      check (status_pencocokan in ('terhubung','menunggu_pencocokan','anonim'));
  end if;
end $$;

-- Tanggal transaksi di Majoo. Impor dilakukan H+1, jadi created_at adalah
-- waktu impor, bukan waktu transaksi. Filter dashboard/analitik dan
-- pemilihan aturan poin memakai kolom ini, bukan created_at.
alter table public.transaksi
  add column if not exists tanggal_majoo date;

create index if not exists idx_transaksi_status_pencocokan
  on public.transaksi (status_pencocokan, created_at desc);

create index if not exists idx_transaksi_tanggal_majoo
  on public.transaksi (tanggal_majoo);

create index if not exists idx_transaksi_kode_majoo
  on public.transaksi (kode_pelanggan_majoo)
  where kode_pelanggan_majoo is not null;

-- Backfill jujur untuk baris lama: ada pelanggan = terhubung,
-- tidak ada = anonim. Data lama yang memang direkam tanpa identitas
-- TIDAK ditandai 'menunggu' (itu akan jadi tebakan).
update public.transaksi
   set status_pencocokan = 'terhubung'
 where pelanggan_id is not null
   and status_pencocokan = 'anonim';

-- ---------- 2. Tabel aturan poin (berversi per periode) ----------

create table if not exists public.aturan_poin (
  id          uuid primary key default gen_random_uuid(),
  mode        text not null check (mode in ('per_nominal','per_kunjungan','per_transaksi')),
  -- Hanya dipakai saat mode = 'per_nominal': 1 poin per N rupiah.
  nominal     integer check (nominal is null or nominal > 0),
  mulai       date not null,
  selesai     date,               -- null = masih berlaku (open-ended)
  dibuat_oleh uuid references public.profile(id) on delete set null,
  dibuat_pada timestamptz not null default now(),
  keterangan  text
);

create index if not exists idx_aturan_poin_mulai on public.aturan_poin (mulai, selesai);

alter table public.aturan_poin enable row level security;

drop policy if exists "aturan_poin baca (staf)" on public.aturan_poin;
create policy "aturan_poin baca (staf)"
  on public.aturan_poin for select
  to authenticated
  using (public.staff_role() in ('admin','manager','kasir'));

drop policy if exists "aturan_poin tulis (admin)" on public.aturan_poin;
create policy "aturan_poin tulis (admin)"
  on public.aturan_poin for all
  to authenticated
  using (public.staff_role() = 'admin')
  with check (public.staff_role() = 'admin');

grant select on public.aturan_poin to authenticated, service_role;
-- Panel aturan poin menulis lewat klien (role authenticated). Tanpa grant
-- tulis, Postgres menolak INSERT/UPDATE/DELETE sebelum RLS sempat dicek,
-- jadi kebijakan admin di atas tidak akan pernah bisa dijalankan.
-- Siapa yang benar-benar boleh menulis tetap dibatasi RLS (hanya admin);
-- grant di sini hanya membuka pintunya, RLS yang menjaga.
grant insert, update, delete on public.aturan_poin to authenticated, service_role;
revoke all on public.aturan_poin from anon;

-- ---------- 3. Fungsi aturan + hitung poin ----------

-- Aturan yang berlaku pada sebuah tanggal: aturan satu-satunya yang
-- periodelnya memuat tanggal itu (peride tidak tumpang tindih, dijaga
-- trigger di bagian 6). Tidak ada yang cocok -> NULL = fallback
-- model lama (per 20.000 rupiah), supaya poin lama tidak berubah.
--
-- BUG-07 (Okt 2026): versi sebelumnya memakai `select *` dan gagal
-- dengan "type of parameter 8 (record) does not match that when
-- preparing the plan (aturan_poin)" tepat setelah sebuah aturan dihapus.
-- Akarnya: fungsi composite-return yang dikompilasi saat hasil 1 baris
-- di-plan ulang saat hasil 0 baris; tipe baris hasil re-plan tidak cocok
-- dengan composite type aturan_poin. Angka 8 = kolom ke-8 (keterangan).
-- Perbaikan: daftar kolom EKSPLISIT, bukan select *. Kolom baru di
-- tabel WAJIB ditambah ke daftar ini di perubahan yang sama, kalau
-- tidak composite type dan hasil query tidak sinkron lagi.
drop function if exists public.aturan_poin_aktif(date);
create function public.aturan_poin_aktif(p_tanggal date)
returns public.aturan_poin
language sql
volatile
security definer
set search_path = public
as $$
  select a.id, a.mode, a.nominal, a.mulai, a.selesai,
         a.dibuat_oleh, a.dibuat_pada, a.keterangan
  from public.aturan_poin a
  where a.mulai <= p_tanggal
    and (a.selesai is null or a.selesai >= p_tanggal)
  order by a.mulai desc
  limit 1;
$$;

-- Hitung poin sebuah transaksi menurut aturan periode yang berlaku.
--  p_pelanggan_id : null = walk-in (semua mode mengembalikan 0)
--  p_tanggal      : tanggal transaksi (basis pemilihan aturan)
--  p_tid          : id transaksi ini (untuk per_kunjungan, boleh null)
--  p_ref          : external_ref transaksi ini (tie-break urutan, boleh null)
--  p_created      : created_at transaksi ini (tie-break urutan)
--  p_basis        : total setelah diskon, sebelum potongan poin (BR-TRX-05)
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
begin
  basis := greatest(0, coalesce(p_basis, 0));
  select * into aturan
    from public.aturan_poin_aktif(coalesce(p_tanggal, (now() at time zone 'Asia/Jakarta')::date));

  -- Tanpa aturan yang berlaku: model lama tetap dipakai (fallback).
  if aturan is null then
    return floor(basis / 20000.0)::integer;
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
    -- itu dapat poin; transaksi susulan (repeat order) tetap dicatat
    -- untuk analitik, tetapi 0 poin.
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

-- ---------- 4. Override trigger hitung poin (server-side, anti-manipulasi) ----------
-- Fungsi lama (security-patch-2.sql) hardcode 20000. Sekarang delegasi
-- ke hitung_poin_aturan() + resolusi pencocokan pelanggan untuk impor.
create or replace function public.hitung_poin_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tanggal date;
begin
  tanggal := coalesce(
    new.tanggal_majoo,
    (new.created_at at time zone 'Asia/Jakarta')::date
  );

  if new.source = 'majoo_import' then
    -- Resolusi pencocokan untuk impor Majoo. Nilai ini dari server
    -- (reader file), bukan dari klien.
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
    -- Jalur manual (kasir/majoo paralel): status diturunkan dari relasi
    -- pelanggan, jangan biarkan default 'anonim' menipu laporan.
    new.status_pencocokan := case
      when new.pelanggan_id is not null then 'terhubung'
      else 'anonim'
    end;
  end if;

  -- Poin dihitung di server menurut aturan periode; nilai klien diabaikan
  -- sepenuhnya (prinsip security-patch-2).
  if new.pelanggan_id is null then
    new.poin_didapat := 0;
    new.poin_dipakai := greatest(0, coalesce(new.poin_dipakai, 0));
    return new;
  end if;

  new.poin_didapat := public.hitung_poin_aturan(
    new.pelanggan_id,
    tanggal,
    new.id,
    new.external_ref,
    new.created_at,
    greatest(0, coalesce(new.total, 0) - coalesce(new.diskon, 0))
  );

  new.poin_dipakai := greatest(0, coalesce(new.poin_dipakai, 0));
  return new;
end;
$$;

-- Trigger trg_transaksi_hitung_poin sudah ada sejak security-patch-2
-- (before insert, per row); cukup tubuh fungsinya yang diganti.

-- ---------- 5. Poin ditahan sampai pencocokan: update tautan pelanggan ----------
-- Saat transaksi 'menunggu_pencocokan' akhirnya tertaut ke pelanggan
-- (halaman Pencocokan, atau impor ulang data pelanggan yang baru),
-- poin dihitung menurut aturan periode tanggal transaksinya, ditulis
-- ke ledger, dan cache pelanggan disinkronkan. Sebelum ini, poin 0.
create or replace function public.poin_pencocokan_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tanggal date;
  poin integer;
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
    greatest(0, coalesce(new.total, 0) - coalesce(new.diskon, 0))
  );

  update public.transaksi
     set poin_didapat = poin,
         status_pencocokan = 'terhubung'
   where id = new.id;

  if poin > 0 then
    insert into public.point_ledger
      (pelanggan_id, transaksi_id, tipe, poin_masuk, sisa, kedaluwarsa_pada, keterangan)
    values
      (new.pelanggan_id, new.id, 'earn', poin, poin,
       (coalesce(tanggal, (now() at time zone 'Asia/Jakarta')::date) + interval '12 months')::date,
       'Poin dari pencocokan transaksi ' || coalesce(new.external_ref, new.id::text));
  end if;

  update public.pelanggan
     set poin = public.saldo_poin(new.pelanggan_id)
   where id = new.pelanggan_id;

  return new;
end;
$$;

drop trigger if exists trg_transaksi_pencocokan on public.transaksi;
create trigger trg_transaksi_pencocokan
  after update of pelanggan_id on public.transaksi
  for each row execute function public.poin_pencocokan_transaksi();

-- 5b. Cocokkan tanpa peduli urutan impor.
-- Kalau transaksi masuk DULU (menunggu_pencocokan) dan data pelanggan
-- masuk kemudian, transaksi otomatis tertaut begitu pelanggannya dikenal.
-- Ini membuat urutan Pelanggan -> Transaksi tidak wajib; dua-duanya aman.
-- Pencatatan poin tetap lewat trg_transaksi_pencocokan di atas.
create or replace function public.cocokkan_transaksi_menunggu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if new.kode_majoo is null or new.kode_majoo = '' then
    return new;
  end if;

  for t in
    select id
    from public.transaksi
    where kode_pelanggan_majoo = new.kode_majoo
      and status_pencocokan = 'menunggu_pencocokan'
  loop
    update public.transaksi
       set pelanggan_id = new.id
     where id = t.id;
    -- SET pelanggan_id memicu trg_transaksi_pencocokan, yang menghitung
    -- dan menerbitkan poinnya dengan aturan periode yang berlaku.
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_pelanggan_cocokkan_menunggu on public.pelanggan;
create trigger trg_pelanggan_cocokkan_menunggu
  after insert or update of kode_majoo on public.pelanggan
  for each row execute function public.cocokkan_transaksi_menunggu();

-- ---------- 6. Penjaga: periode aturan tidak boleh tumpang tindih ----------
create or replace function public.jaga_aturan_poin_tumpang()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.aturan_poin a
    where a.id is distinct from new.id
      and a.mulai <= coalesce(new.selesai, '9999-12-31'::date)
      and coalesce(a.selesai, '9999-12-31'::date) >= new.mulai
  ) then
    raise exception
      'Periode aturan poin bertumpang tindih dengan aturan yang sudah ada.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aturan_poin_tumpang on public.aturan_poin;
create trigger trg_aturan_poin_tumpang
  before insert or update on public.aturan_poin
  for each row execute function public.jaga_aturan_poin_tumpang();

-- ---------- 7. Kunci fungsi internal ----------
-- UI membaca aturan lewat tabel (SELECT di atas), bukan lewat fungsi
-- ini, jadi semua fungsi hitung dikunci dari peran umum.
revoke execute on function public.hitung_poin_aturan(uuid,date,uuid,text,timestamptz,integer) from public, anon, authenticated;
revoke execute on function public.aturan_poin_aktif(date) from public, anon, authenticated;
revoke execute on function public.poin_pencocokan_transaksi() from public, anon, authenticated;
revoke execute on function public.jaga_aturan_poin_tumpang() from public, anon, authenticated;

notify pgrst, 'reload schema';
