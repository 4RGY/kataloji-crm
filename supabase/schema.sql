-- ============================================================
-- Schema CRM Kataloji
-- Cara pakai: Supabase Dashboard > SQL Editor > New query
-- paste seluruh file ini > Run
-- Aman dijalankan ulang (idempotent)
-- ============================================================

-- ---------- Tabel pelanggan ----------
create table if not exists public.pelanggan (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null,
  whatsapp   text not null,
  tgl_lahir  date,
  poin       integer not null default 0 check (poin >= 0),
  catatan    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pelanggan_nama on public.pelanggan (nama);

-- ---------- Tabel transaksi ----------
-- total menyimpan rupiah bulat (tanpa sen)
create table if not exists public.transaksi (
  id           uuid primary key default gen_random_uuid(),
  pelanggan_id uuid references public.pelanggan(id) on delete set null,
  total        integer not null check (total >= 0),
  poin_dipakai integer not null default 0 check (poin_dipakai >= 0),
  poin_didapat integer not null default 0 check (poin_didapat >= 0),
  items        jsonb not null default '[]',
  external_ref text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_transaksi_created_at on public.transaksi (created_at desc);
create index if not exists idx_transaksi_pelanggan on public.transaksi (pelanggan_id);

-- ---------- updated_at otomatis ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pelanggan_updated_at on public.pelanggan;
create trigger trg_pelanggan_updated_at
  before update on public.pelanggan
  for each row execute function public.set_updated_at();

-- ---------- Poin otomatis per transaksi ----------
-- SENGAJA TIDAK ADA DI SINI.
--
-- Dulu trigger poin didefinisikan di file ini sebagai
-- `apply_transaksi_poin()` yang hanya menambah kolom pelanggan.poin.
-- Sejak aturan FIFO 12 bulan dipakai, satu kolom tidak lagi cukup:
-- kita perlu tahu poin mana terbit kapan.
--
-- Definisi trigger sekarang tinggal di `supabase/ledger-poin.sql`,
-- memakai tabel point_ledger. Kalau trigger versi lama dihidupkan
-- lagi di sini, re-run schema.sql akan menimpanya dan ledger
-- berhenti diisi tanpa error (saldo diam-diam salah).
--
-- URUTAN MIGRASI: schema.sql -> rbac.sql -> ledger-poin.sql
-- Jangan re-run schema.sql setelah ledger-poin.sql.

-- ---------- Row Level Security ----------
alter table public.pelanggan enable row level security;
alter table public.transaksi enable row level security;

drop policy if exists "pelanggan untuk user login" on public.pelanggan;
create policy "pelanggan untuk user login" on public.pelanggan
  for all to authenticated
  using (true) with check (true);

drop policy if exists "transaksi untuk user login" on public.transaksi;
create policy "transaksi untuk user login" on public.transaksi
  for all to authenticated
  using (true) with check (true);
