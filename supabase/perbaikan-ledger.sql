-- ============================================================
-- PERBAIKAN LEDGER POIN
--
-- Menyelesaikan dua hal yang ditemukan saat pemeriksaan data nyata
-- pada 2026-09-15.
--
-- ------------------------------------------------------------
-- TEMUAN 1: saldo bisa berkurang tanpa baris yang menjelaskan
-- ------------------------------------------------------------
-- Data Anggara: total poin_masuk = 8, total poin_keluar = 0, tetapi
-- jumlah kolom `sisa` hanya 7. Satu poin hilang dan tidak ada satu pun
-- baris redeem, expire, atau adjust yang menerangkan ke mana perginya.
--
-- Penyebabnya ada pada urutan di dalam tukar_poin(): kolom `sisa`
-- dikurangi lebih dulu di dalam perulangan, baris 'redeem' baru ditulis
-- sesudahnya. Kalau proses berhenti di antara keduanya, pengurangan
-- terlanjur tersimpan sedangkan penjelasannya tidak pernah ada.
--
-- Sudah dibuktikan ulang pada pelanggan uji: menghapus baris redeem
-- setelah penukaran berhasil menghasilkan pola yang sama persis,
-- yaitu buku 5 tetapi terpakai 2.
--
-- Perbaikannya: tulis baris 'redeem' LEBIH DULU, baru kurangi `sisa`.
-- Dengan urutan ini, kegagalan di tengah menyisakan catatan penukaran
-- tanpa pengurangan, yang bisa terlihat dan diperiksa. Itu jauh lebih
-- baik daripada pengurangan diam-diam yang tidak bisa dilacak siapa pun.
--
-- ------------------------------------------------------------
-- TEMUAN 2: baris 'adjust' tidak pernah dihitung
-- ------------------------------------------------------------
-- saldo_poin() hanya menjumlahkan baris bertipe 'earn'. Akibatnya
-- koreksi manual bertipe 'adjust' tidak menaikkan saldo sama sekali:
-- laporan menampilkan angka baru sementara kasir tetap tidak bisa
-- memakainya. Sudah dibuktikan pada pelanggan uji, menyisipkan
-- adjust +3 tidak mengubah saldo, dan penukaran tetap ditolak.
--
-- Perbaikannya: saldo_poin() dan tukar_poin() ikut membaca 'adjust'.
-- Tanpa ini, memperbaiki saldo Anggara hanya memindahkan masalah.
--
-- Jalankan di SQL editor Supabase setelah ledger-poin.sql.
-- ============================================================

-- ---------- 1. Saldo ikut menghitung koreksi ----------
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
    and tipe in ('earn', 'adjust')
    and (kedaluwarsa_pada is null or kedaluwarsa_pada > current_date)
$$;

-- ---------- 2. Penukaran mencatat dulu, mengurangi kemudian ----------
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

  -- Catatan penukaran ditulis SEBELUM kolom sisa disentuh. Urutan ini
  -- yang membedakan kesalahan yang terlihat dari poin yang lenyap diam.
  insert into public.point_ledger
    (pelanggan_id, transaksi_id, tipe, poin_keluar, keterangan)
  values
    (p_pelanggan_id, p_transaksi_id, 'redeem', p_poin, 'Penukaran poin di kasir');

  for batch in
    select id, sisa
    from public.point_ledger
    where pelanggan_id = p_pelanggan_id
      and tipe in ('earn', 'adjust')
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

  return p_poin;
end;
$$;

-- ---------- 3. Alat pemeriksa keseimbangan ----------
-- Pembukuan yang benar: (poin_masuk - poin_keluar) harus sama dengan
-- jumlah `sisa`. Selisih apa pun berarti ada poin yang berubah tanpa
-- penjelasan, dan itu harus bisa ditemukan tanpa menebak.
create or replace function public.periksa_keseimbangan_poin()
returns table (
  pelanggan_id uuid,
  nama         text,
  buku         integer,
  terpakai     integer,
  selisih      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nama,
    coalesce(sum(l.poin_masuk) - sum(l.poin_keluar), 0)::integer as buku,
    coalesce(sum(l.sisa), 0)::integer                            as terpakai,
    (coalesce(sum(l.poin_masuk) - sum(l.poin_keluar), 0)
     - coalesce(sum(l.sisa), 0))::integer                        as selisih
  from public.pelanggan p
  join public.point_ledger l on l.pelanggan_id = p.id
  group by p.id, p.nama
  having coalesce(sum(l.poin_masuk) - sum(l.poin_keluar), 0)
       <> coalesce(sum(l.sisa), 0)
$$;

-- Setelah perbaikan dijalankan, query ini harus mengembalikan nol baris:
--   select * from public.periksa_keseimbangan_poin();
