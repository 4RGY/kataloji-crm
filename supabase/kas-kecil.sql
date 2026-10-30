-- ============================================================
-- MIGRASI: KAS KECIL / PETTY CASH & CATATAN ITEM TRANSAKSI
-- ============================================================

-- 1. Tambah kolom catatan di transaksi_item jika belum ada
alter table public.transaksi_item
  add column if not exists catatan text;

-- 2. Tabel kas_kecil untuk pencatatan pengeluaran operasional kasir
create table if not exists public.kas_kecil (
  id                  uuid primary key default gen_random_uuid(),
  nominal             integer not null check (nominal > 0),
  kategori            text not null, -- 'Bahan Baku', 'Operasional', 'Kebersihan', 'Lainnya'
  keterangan          text not null,
  dicatat_oleh        uuid references auth.users(id) on delete set null,
  dicatat_oleh_nama   text,
  created_at          timestamptz not null default now()
);

-- Index created_at untuk query rekap harian/shift
create index if not exists idx_kas_kecil_created_at
  on public.kas_kecil (created_at desc);

-- RLS
alter table public.kas_kecil enable row level security;

-- Policy select: authenticated staff
drop policy if exists kas_kecil_select on public.kas_kecil;
create policy kas_kecil_select on public.kas_kecil
  for select to authenticated using (true);

-- Policy insert: authenticated staff
drop policy if exists kas_kecil_insert on public.kas_kecil;
create policy kas_kecil_insert on public.kas_kecil
  for insert to authenticated with check (true);

-- Policy delete: hanya admin/manager
drop policy if exists kas_kecil_delete on public.kas_kecil;
create policy kas_kecil_delete on public.kas_kecil
  for delete to authenticated using (public.staff_role() in ('admin', 'manager'));

-- Grant
grant select, insert, delete on public.kas_kecil to authenticated;
