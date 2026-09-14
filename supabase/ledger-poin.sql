-- ============================================================
-- Ledger Poin + Mode Kasir, Kataloji CRM (Step 6)
-- Prasyarat: schema.sql dan rbac.sql sudah dijalankan.
-- Aman dijalankan ulang (idempotent).
--
-- MENGAPA LEDGER, BUKAN SATU KOLOM SALDO
-- Aturan loyalitas Kataloji: poin hangus setelah 12 bulan (FIFO).
-- Kalau saldo cuma satu angka di pelanggan.poin, tidak ada cara tahu
-- poin mana yang terbit kapan, jadi tidak mungkin menghanguskan yang
-- tertua lebih dulu. Karena itu tiap peristiwa poin dicatat satu baris.
-- Saldo pelanggan = jumlah kolom `sisa` dari baris earn yang belum
-- kedaluwarsa. Kolom pelanggan.poin tetap ada sebagai cache saldo.
--
-- Aturan bisnis yang dijaga di sini (docs/BUSINESS_RULES.md):
-- - BR-TRX-05: basis poin = total SEBELUM potongan poin.
--   Rumus: poin = floor((total - diskon) / 20.000)
-- - BR-LOY: 1 poin = Rp 1.000, min tukar 5 poin, maks 100% tagihan
-- - BR-LOY: poin hangus 12 bulan, urutan FIFO
-- ============================================================

-- ---------- Kolom tambahan di transaksi ----------
-- diskon      : potongan promo biasa. MENGURANGI basis poin.
-- poin_dipakai: penukaran poin. TIDAK mengurangi basis poin.
-- source      : asal catatan. majoo_parallel = dicatat kasir
--               karena POS majoo jalan paralel (bukan integrasi API).
alter table public.transaksi
  add column if not exists diskon integer not null default 0;

alter table public.transaksi
  add column if not exists source text not null default 'crm_manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transaksi_diskon_cek'
  ) then
    alter table public.transaksi
      add constraint transaksi_diskon_cek check (diskon >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'transaksi_source_cek'
  ) then
    alter table public.transaksi
      add constraint transaksi_source_cek
      check (source in ('crm_manual','majoo_parallel','csv_import'));
  end if;
end $$;

-- ---------- Tabel ledger poin ----------
create table if not exists public.point_ledger (
  id               uuid primary key default gen_random_uuid(),
  pelanggan_id     uuid not null references public.pelanggan(id) on delete cascade,
  transaksi_id     uuid references public.transaksi(id) on delete set null,
  tipe             text not null check (tipe in ('earn','redeem','expire','adjust')),
  poin_masuk       integer not null default 0 check (poin_masuk >= 0),
  poin_keluar      integer not null default 0 check (poin_keluar >= 0),
  sisa             integer not null default 0 check (sisa >= 0),
  kedaluwarsa_pada date,
  keterangan       text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_ledger_pelanggan
  on public.point_ledger (pelanggan_id, created_at desc);

create index if not exists idx_ledger_batch_aktif
  on public.point_ledger (pelanggan_id, kedaluwarsa_pada, created_at)
  where tipe = 'earn' and sisa > 0;

-- ---------- Saldo poin dari ledger ----------
-- Batas kedaluwarsa memakai current_date: batch yang sudah lewat
-- tanggal hangus tidak dihitung walau belum disapu scheduler.
create or replace function public.saldo_poin(p_pelanggan_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(sisa), 0)::integer
  from public.point_ledger
  where pelanggan_id = p_pelanggan_id
    and tipe = 'earn'
    and (kedaluwarsa_pada is null or kedaluwarsa_pada > current_date)
$$;

-- ---------- Tukar poin, urutan FIFO ----------
-- Batch yang paling cepat kedaluwarsa dihabiskan lebih dulu,
-- supaya poin pelanggan tidak hangus sia-sia.
create or replace function public.tukar_poin(
  p_pelanggan_id uuid,
  p_poin integer,
  p_transaksi_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  sisa_butuh integer := p_poin;
  tersedia   integer;
  batch      record;
  ambil      integer;
begin
  if p_poin is null or p_poin <= 0 then
    return 0;
  end if;

  tersedia := public.saldo_poin(p_pelanggan_id);
  if p_poin > tersedia then
    raise exception 'poin tidak cukup: diminta %, tersedia %', p_poin, tersedia;
  end if;

  for batch in
    select id, sisa
    from public.point_ledger
    where pelanggan_id = p_pelanggan_id
      and tipe = 'earn'
      and sisa > 0
      and (kedaluwarsa_pada is null or kedaluwarsa_pada > current_date)
    order by kedaluwarsa_pada nulls last, created_at
  loop
    exit when sisa_butuh <= 0;

    ambil := least(batch.sisa, sisa_butuh);
    update public.point_ledger set sisa = sisa - ambil where id = batch.id;
    sisa_butuh := sisa_butuh - ambil;
  end loop;

  if sisa_butuh > 0 then
    raise exception 'penukaran poin gagal dipenuhi, sisa %', sisa_butuh;
  end if;

  insert into public.point_ledger
    (pelanggan_id, transaksi_id, tipe, poin_keluar, keterangan)
  values
    (p_pelanggan_id, p_transaksi_id, 'redeem', p_poin, 'Penukaran poin di kasir');

  return p_poin;
end;
$$;

-- ---------- Trigger: satu transaksi -> redeem lalu earn ----------
-- Urutan penting: redeem dijalankan LEBIH DULU, supaya poin yang
-- baru didapat dari transaksi ini tidak ikut terpakai oleh
-- penukaran di transaksi yang sama.
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

-- ---------- Sapu poin hangus (dipanggil scheduler harian) ----------
create or replace function public.hanguskan_poin(p_tanggal date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  total integer := 0;
begin
  for batch in
    select id, pelanggan_id, sisa
    from public.point_ledger
    where tipe = 'earn'
      and sisa > 0
      and kedaluwarsa_pada is not null
      and kedaluwarsa_pada <= p_tanggal
  loop
    insert into public.point_ledger
      (pelanggan_id, tipe, poin_keluar, keterangan)
    values
      (batch.pelanggan_id, 'expire', batch.sisa, 'Poin hangus setelah 12 bulan');

    update public.point_ledger set sisa = 0 where id = batch.id;

    update public.pelanggan
       set poin = public.saldo_poin(batch.pelanggan_id)
     where id = batch.pelanggan_id;

    total := total + batch.sisa;
  end loop;

  return total;
end;
$$;

-- ---------- RLS + GRANT ----------
alter table public.point_ledger enable row level security;

drop policy if exists "ledger baca (staf)" on public.point_ledger;
create policy "ledger baca (staf)"
  on public.point_ledger for select
  to authenticated
  using (public.staff_role() in ('admin','manager','kasir'));

-- Tulis ke ledger hanya lewat fungsi SECURITY DEFINER di atas
-- (tukar_poin, trigger transaksi, hanguskan_poin), bukan dari klien.
drop policy if exists "ledger koreksi (admin)" on public.point_ledger;
create policy "ledger koreksi (admin)"
  on public.point_ledger for insert
  to authenticated
  with check (public.staff_role() = 'admin');

grant usage on schema public to authenticated, service_role;
grant select on public.point_ledger to authenticated, service_role;

revoke all on public.point_ledger from anon;
