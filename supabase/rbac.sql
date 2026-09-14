-- ============================================================
-- RBAC + RLS — Kataloji CRM (Step 2)
-- Paste di SQL Editor > Run. Idempotent (aman dijalankan ulang).
-- Prasyarat: schema.sql sudah dijalankan (butuh public.set_updated_at).
--
-- ATURAN POSTGRES yang harus dipatuhi:
--   SELECT  policy -> hanya USING
--   INSERT  policy -> hanya WITH CHECK
--   UPDATE  policy -> USING + WITH CHECK
--   DELETE  policy -> hanya USING
--   (WITH CHECK di SELECT/DELETE = error 42601)
-- ============================================================

-- ---------- Profile: satu baris per user auth, menyimpan role staf ----------
create table if not exists public.profile (
  id         uuid primary key references auth.users(id) on delete cascade,
  nama       text not null,
  role       text not null default 'kasir'
             check (role in ('admin','manager','kasir')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profile_updated_at on public.profile;
create trigger trg_profile_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- ---------- Helper: role staf yang sedang login ----------
-- SECURITY DEFINER wajib di sini: fungsi ini dipakai di policy tabel
-- profile, dan dia membaca tabel profile. Tanpa definer -> RLS rekursi
-- ("infinite recursion detected in policy for relation profile").
create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profile where id = auth.uid()
$$;

-- ---------- Auto-create profile saat user auth baru dibuat ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, nama, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    'kasir'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS: profile ----------
alter table public.profile enable row level security;

drop policy if exists "profile sendiri" on public.profile;
create policy "profile sendiri"
  on public.profile for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "admin kelola profile" on public.profile;
create policy "admin kelola profile"
  on public.profile for all
  to authenticated
  using (public.staff_role() = 'admin')
  with check (public.staff_role() = 'admin');

-- ---------- RLS: pelanggan ----------
-- Kasir : baca + tambah  (biar ngebut di meja kasir)
-- Manager+: baca + tambah + ubah
-- Admin : semua termasuk hapus
alter table public.pelanggan enable row level security;

drop policy if exists "pelanggan untuk user login" on public.pelanggan;
drop policy if exists "pelanggan baca" on public.pelanggan;
drop policy if exists "pelanggan tambah" on public.pelanggan;
drop policy if exists "pelanggan ubah" on public.pelanggan;
drop policy if exists "pelanggan hapus" on public.pelanggan;

create policy "pelanggan baca"
  on public.pelanggan for select
  to authenticated
  using (public.staff_role() in ('admin','manager','kasir'));

create policy "pelanggan tambah"
  on public.pelanggan for insert
  to authenticated
  with check (public.staff_role() in ('admin','manager','kasir'));

create policy "pelanggan ubah"
  on public.pelanggan for update
  to authenticated
  using (public.staff_role() in ('admin','manager'))
  with check (public.staff_role() in ('admin','manager'));

create policy "pelanggan hapus"
  on public.pelanggan for delete
  to authenticated
  using (public.staff_role() = 'admin');

-- ---------- RLS: transaksi ----------
alter table public.transaksi enable row level security;

drop policy if exists "transaksi untuk user login" on public.transaksi;
drop policy if exists "transaksi baca" on public.transaksi;
drop policy if exists "transaksi tambah" on public.transaksi;
drop policy if exists "transaksi ubah" on public.transaksi;
drop policy if exists "transaksi hapus" on public.transaksi;

create policy "transaksi baca"
  on public.transaksi for select
  to authenticated
  using (public.staff_role() in ('admin','manager','kasir'));

create policy "transaksi tambah"
  on public.transaksi for insert
  to authenticated
  with check (public.staff_role() in ('admin','manager','kasir'));

create policy "transaksi ubah"
  on public.transaksi for update
  to authenticated
  using (public.staff_role() in ('admin','manager'))
  with check (public.staff_role() in ('admin','manager'));

create policy "transaksi hapus"
  on public.transaksi for delete
  to authenticated
  using (public.staff_role() = 'admin');

-- ============================================================
-- GRANT (eksplisit, biar tidak bergantung default-privilege Supabase)
-- anon sengaja TIDAK diberi akses -> RLS jadi lapisan kedua.
-- ============================================================
grant usage on schema public to authenticated, service_role;
grant all on public.pelanggan to authenticated, service_role;
grant all on public.transaksi to authenticated, service_role;
grant all on public.profile  to authenticated, service_role;
grant execute on function public.staff_role() to authenticated, service_role;

revoke all on public.pelanggan from anon;
revoke all on public.transaksi from anon;
revoke all on public.profile  from anon;

-- ============================================================
-- SEED: jadikan user yang sudah ada sebagai admin
-- Ganti email kalau perlu. Idempoten.
--
-- PENTING: pakai "on conflict do update", bukan "not exists".
-- User yang mendaftar setelah rbac.sql terpasang sudah punya
-- profile otomatis dari trigger (role 'kasir'); pola "not exists"
-- akan melewatkan mereka dan role admin gagal terpasang.
-- ============================================================
insert into public.profile (id, nama, role)
select u.id, u.email, 'admin'
from auth.users u
where u.email = 'wahyu@kataloji.id'
on conflict (id) do update set role = 'admin';
