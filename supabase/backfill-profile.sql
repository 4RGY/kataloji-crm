-- ============================================================
-- backfill-profile.sql
-- Mengisi baris `profile` untuk user yang belum punya.
--
-- MASALAH YANG DIPERBAIKI
-- Trigger `handle_new_user` baru dibuat setelah beberapa akun sudah
-- terdaftar. Akun lama itu tidak punya baris di `profile`, sehingga
-- `staff_role()` mengembalikan NULL. Akibatnya SEMUA policy RLS bernilai
-- false: user berhasil login dan halaman terbuka, tetapi dashboard tampil
-- kosong TANPA pesan error apa pun. Ini membingungkan karena terlihat
-- seperti data hilang, padahal datanya ada dan hanya tidak boleh dibaca.
--
-- Perbaikan ada dua lapis:
--   1. berkas ini mengisi baris yang bolong (sekaligus, untuk user lama)
--   2. `rbac.sql` sudah memasang trigger untuk user baru
--
-- Idempoten: aman dijalankan berulang kali.
-- ============================================================

-- ---------- 1. Isi baris profile yang bolong ----------
-- Peran diberikan 'kasir' karena itu hak akses paling rendah. Kenaikan
-- peran jadi admin dilakukan lewat menu Staf di aplikasi, bukan di sini.
insert into public.profile (id, nama, role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'nama', ''), u.email, 'Staf'),
  'kasir'
from auth.users u
left join public.profile p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ---------- 2. Pastikan trigger untuk user baru terpasang ----------
-- Kalau `rbac.sql` belum pernah dijalankan di database ini, dua perintah
-- berikut memasangnya supaya tidak ada lagi akun tanpa profile.
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

-- ---------- 3. Laporkan hasil ----------
-- Supaya di SQL Editor terlihat apakah masih ada akun yang bolong.
do $$
declare
  jumlah_profile integer;
  jumlah_bolong  integer;
  rincian        text;
begin
  select count(*) into jumlah_profile from public.profile;

  select count(*) into jumlah_bolong
  from auth.users u
  left join public.profile p on p.id = u.id
  where p.id is null;

  select coalesce(string_agg(nama || ' (' || role || ')', ', ' order by role), '(kosong)')
    into rincian
  from public.profile;

  raise notice 'profile berisi % baris: %', jumlah_profile, rincian;

  if jumlah_bolong > 0 then
    raise warning 'MASIH ADA % akun tanpa profile. Jalankan berkas ini sekali lagi.', jumlah_bolong;
  else
    raise notice 'Semua akun sudah punya profile. Tidak ada yang bolong.';
  end if;
end $$;
