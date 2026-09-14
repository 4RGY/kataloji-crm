-- ============================================================
-- hapus-akun-uji.sql
-- Menghapus akun yang dibuat hanya untuk pengujian keamanan.
--
-- MASALAH YANG DIPERBAIKI
-- Saat membuktikan celah pendaftaran terbuka, beberapa akun uji ikut
-- terbuat di Supabase Auth. Akun "penyusup-16381@contoh.com" punya peran
-- 'kasir', sehingga SELAMA email konfirmasi dimatikan akun itu bisa
-- dipakai login dan membaca seluruh data pelanggan. Akun uji seperti ini
-- harus dibersihkan sebelum aplikasi diserahkan.
--
-- CARA PAKAI
-- Jalankan di Supabase Dashboard -> SQL Editor. Idempoten, jadi aman
-- dijalankan berulang kali: kalau akunnya sudah tidak ada, tidak ada yang
-- berubah.
--
-- PENTING: hapus baris `profile` dulu baru `auth.users`, mengikuti urutan
-- kunci asing. Setelah `auth.users` terhapus, baris `profile` akan ikut
-- terhapus oleh aturan cascade, tetapi menghapusnya lebih dulu membuat
-- niat kode ini jelas dan tidak bergantung pada cascade.
-- ============================================================

do $$
declare
  pola_uji text[] := array[
    'penyusup-%@contoh.com',
    'uji-%@contoh.com',
    'test-%@contoh.com',
    'qa-%@contoh.com'
  ];
  akun_target uuid[];
  jumlah integer;
  rincian text;
begin
  -- ---------- 1. Kumpulkan akun yang cocok pola uji ----------
  select coalesce(array_agg(u.id), '{}')
    into akun_target
  from auth.users u
  where exists (
    select 1 from unnest(pola_uji) as p
    where u.email like p
  );

  jumlah := coalesce(array_length(akun_target, 1), 0);

  if jumlah = 0 then
    raise notice 'Tidak ada akun uji yang perlu dihapus.';
    return;
  end if;

  -- ---------- 2. Catat dulu apa yang akan dihapus ----------
  -- Sengaja dilaporkan sebelum dihapus supaya jejaknya terlihat di SQL
  -- Editor. Kalau ada akun asli yang tidak sengaja cocok pola, admin bisa
  -- membatalkan lebih dulu.
  select string_agg(u.email || ' [' || coalesce(p.role, 'tanpa profil') || ']', ', ')
    into rincian
  from auth.users u
  left join public.profile p on p.id = u.id
  where u.id = any(akun_target);

  raise notice 'Akan menghapus % akun uji: %', jumlah, rincian;

  -- ---------- 3. Hapus baris profile dulu ----------
  delete from public.profile where id = any(akun_target);

  -- ---------- 4. Hapus identitas, lalu akun auth ----------
  -- Tabel auth.identities memakai kunci asing ke auth.users, jadi harus
  -- dibersihkan lebih dulu. Beberapa proyek Supabase juga punya tabel
  -- auth.sessions dan auth.refresh_tokens; keduanya ikut cascade.
  delete from auth.identities where user_id = any(akun_target);
  delete from auth.users where id = any(akun_target);

  raise notice 'Selesai. % akun uji dihapus.', jumlah;
end $$;

-- ---------- 5. Laporan akhir ----------
-- Menampilkan sisa staf yang benar-benar dipakai. Setelah berkas ini
-- dijalankan, daftar ini seharusnya hanya berisi akun asli.
select
  coalesce(p.nama, u.email) as nama,
  coalesce(p.role, 'TANPA PROFIL') as peran,
  u.email,
  u.email_confirmed_at is not null as email_terkonfirmasi
from auth.users u
left join public.profile p on p.id = u.id
order by p.role nulls last, u.email;
