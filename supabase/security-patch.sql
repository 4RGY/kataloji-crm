-- ============================================================
-- PATCH KEAMANAN, Kataloji CRM
-- Prasyarat: schema.sql, rbac.sql, ledger-poin.sql sudah dijalankan.
-- Aman dijalankan ulang (idempotent).
--
-- MASALAH YANG DIPERBAIKI
--
-- 1. KRITIS: role `anon` (pengunjung tanpa login) bisa memanggil
--    fungsi `tukar_poin()` dan `hanguskan_poin()` lewat endpoint
--    /rest/v1/rpc/. Terbukti live: satu curl tanpa kredensial
--    berhasil membakar poin pelanggan, dan satu curl lagi bisa
--    menghanguskan poin SELURUH pelanggan.
--    Sebabnya: PostgreSQL memberi hak EXECUTE ke pseudo-role PUBLIC
--    secara default untuk setiap fungsi baru, dan `anon` adalah
--    anggota PUBLIC. RLS tidak menolong di sini karena fungsi ini
--    SECURITY DEFINER, jadi dia jalan dengan hak pemiliknya.
--
-- 2. BUG: `tukar_poin()` mengubah ledger tapi TIDAK memperbarui
--    kolom cache `pelanggan.poin`. Akibatnya UI menampilkan saldo
--    lama sementara saldo asli sudah berkurang (desync senyap).
--    Trigger transaksi sudah menyinkronkan; pemanggilan fungsi
--    langsung belum.
-- ============================================================

-- ---------- 1. Cabut hak eksekusi fungsi dari anon / PUBLIC ----------
-- REVOKE dari `public` itu penting: semua role adalah anggota PUBLIC,
-- jadi tanpa ini `anon` tetap bisa memanggil walau tidak di-grant.
revoke execute on function public.tukar_poin(uuid, integer, uuid) from public, anon;
revoke execute on function public.hanguskan_poin(date)           from public, anon;
revoke execute on function public.saldo_poin(uuid)               from public, anon;
revoke execute on function public.staff_role()                   from public, anon;
revoke execute on function public.handle_new_user()              from public, anon, authenticated;
revoke execute on function public.apply_transaksi_poin()         from public, anon, authenticated;
revoke execute on function public.set_updated_at()               from public, anon, authenticated;

-- Kasir memakai saldo_poin() untuk menampilkan saldo di halaman
-- Transaksi, jadi `authenticated` tetap boleh. Tukar poin dipanggil
-- lewat trigger transaksi (SECURITY DEFINER), bukan dari klien.
grant execute on function public.saldo_poin(uuid) to authenticated, service_role;

-- Fungsi internal: hanya service_role (server) yang boleh memanggil
-- langsung. Staf menukar poin dengan membuat transaksi, bukan dengan
-- memanggil fungsi ini dari browser.
grant execute on function public.tukar_poin(uuid, integer, uuid) to service_role;
grant execute on function public.hanguskan_poin(date)            to service_role;

-- ---------- 2. tukar_poin: sinkronkan cache pelanggan.poin ----------
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

  -- BUGFIX: sinkronkan cache supaya UI tidak menampilkan saldo lama.
  update public.pelanggan
     set poin = public.saldo_poin(p_pelanggan_id)
   where id = p_pelanggan_id;

  return p_poin;
end;
$$;

-- Grant ulang: CREATE OR REPLACE mengembalikan default PUBLIC,
-- jadi revoke di atas HARUS diulang setelah fungsi didefinisikan ulang.
revoke execute on function public.tukar_poin(uuid, integer, uuid) from public, anon;
grant execute on function public.tukar_poin(uuid, integer, uuid) to service_role;

-- ---------- 3. Rapikan sisa grant bawaan pada tabel ledger ----------
revoke all on public.point_ledger from anon;

-- ---------- 4. Minta PostgREST muat ulang cache skema ----------
-- Supaya perubahan hak akses langsung berlaku tanpa tunggu refresh.
notify pgrst, 'reload schema';
