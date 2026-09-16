-- ============================================================
-- ARSIP PELANGGAN: menutup pintu belakang penghapusan jejak poin
--
-- ------------------------------------------------------------
-- MASALAH YANG DITUTUP
-- ------------------------------------------------------------
-- Jejak poin di point_ledger sudah dikunci: tidak ada policy update
-- maupun delete, sehingga RLS menolak keduanya bahkan untuk admin.
-- Terbukti saat pengujian 16 Sep 2026:
--   admin UPDATE point_ledger  -> 0 baris
--   admin DELETE point_ledger  -> 0 baris
--
-- Tetapi penguncian itu bisa dilewati lewat pintu belakang:
--   admin DELETE pelanggan     -> 1 baris, dan SELURUH jejak poinnya
--                                 ikut lenyap karena on delete cascade
--
-- Terbukti pada pelanggan uji: ledger 1 baris menjadi 0 baris tanpa
-- satu pun catatan bahwa hal itu pernah terjadi. Artinya klaim "jejak
-- tidak bisa diubah siapa pun" tidak berlaku sepenuhnya.
--
-- ------------------------------------------------------------
-- CARA MENUTUPNYA
-- ------------------------------------------------------------
-- 1. Foreign key point_ledger diubah dari cascade menjadi restrict,
--    sehingga menghapus pelanggan yang punya jejak poin akan GAGAL,
--    bukan menghapus jejaknya diam-diam.
-- 2. Hak hapus pelanggan dicabut dari semua peran. Yang menggantikan
--    adalah pengarsipan: pelanggan hilang dari daftar, jejaknya utuh.
-- 3. Pengarsipan mencatat siapa dan kapan, supaya keputusan itu sendiri
--    bisa dipertanggungjawabkan.
--
-- Mengapa arsip, bukan hapus: kedai perlu menyembunyikan pelanggan yang
-- salah input atau sudah tidak relevan, tetapi poin yang pernah diberikan
-- adalah bagian dari pembukuan. Menghapusnya membuat total poin yang
-- pernah beredar tidak bisa dihitung ulang.
--
-- Jalankan di SQL editor Supabase setelah perbaikan-ledger.sql.
-- ============================================================

-- ---------- 1. Kolom penanda arsip ----------
alter table public.pelanggan
  add column if not exists diarsipkan_pada  timestamptz,
  add column if not exists diarsipkan_oleh  uuid references public.profile(id),
  add column if not exists alasan_arsip     text;

-- Daftar pelanggan aktif adalah pertanyaan tersering, jadi diberi indeks
-- sebagian yang hanya memuat baris yang belum diarsipkan.
create index if not exists idx_pelanggan_aktif
  on public.pelanggan (created_at desc)
  where diarsipkan_pada is null;

-- ---------- 2. Jejak poin tidak lagi ikut terhapus ----------
-- Nama constraint dibaca dari katalog, bukan ditebak, karena nama bawaan
-- bisa berbeda antar pemasangan.
do $$
declare
  nama_fk text;
begin
  select con.conname into nama_fk
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'point_ledger'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%REFERENCES pelanggan(id)%'
  limit 1;

  if nama_fk is not null then
    execute format('alter table public.point_ledger drop constraint %I', nama_fk);
  end if;

  alter table public.point_ledger
    add constraint point_ledger_pelanggan_id_fkey
    foreign key (pelanggan_id) references public.pelanggan(id)
    on delete restrict;
end $$;

-- Catatan campaign juga tidak boleh hilang tanpa jejak.
do $$
declare
  nama_fk text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'campaign_kirim'
  ) then
    return;
  end if;

  select con.conname into nama_fk
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'campaign_kirim'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) like '%REFERENCES pelanggan(id)%'
  limit 1;

  if nama_fk is not null then
    execute format('alter table public.campaign_kirim drop constraint %I', nama_fk);
  end if;

  alter table public.campaign_kirim
    add constraint campaign_kirim_pelanggan_id_fkey
    foreign key (pelanggan_id) references public.pelanggan(id)
    on delete restrict;
end $$;

-- ---------- 3. Hak hapus dicabut dari semua peran ----------
-- Tanpa policy delete, RLS menolak penghapusan untuk siapa pun. Ini
-- disengaja: satu-satunya cara menyingkirkan pelanggan adalah arsip.
drop policy if exists "pelanggan hapus" on public.pelanggan;

-- ---------- 4. Mengarsipkan dan mengembalikan ----------
-- Dijadikan fungsi, bukan UPDATE langsung dari aplikasi, supaya identitas
-- pengarsip diisi server. Kalau aplikasi yang mengisinya, nilainya bisa
-- dikarang oleh siapa saja yang bisa memanggil database.
create or replace function public.arsipkan_pelanggan(
  p_pelanggan_id uuid,
  p_alasan       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.staff_role() not in ('admin', 'manager') then
    raise exception 'hanya admin atau manajer yang boleh mengarsipkan pelanggan';
  end if;

  update public.pelanggan
     set diarsipkan_pada = now(),
         diarsipkan_oleh = auth.uid(),
         alasan_arsip    = nullif(btrim(coalesce(p_alasan, '')), '')
   where id = p_pelanggan_id
     and diarsipkan_pada is null;
end;
$$;

create or replace function public.kembalikan_pelanggan(p_pelanggan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.staff_role() not in ('admin', 'manager') then
    raise exception 'hanya admin atau manajer yang boleh mengembalikan pelanggan';
  end if;

  update public.pelanggan
     set diarsipkan_pada = null,
         diarsipkan_oleh = null,
         alasan_arsip    = null
   where id = p_pelanggan_id;
end;
$$;

revoke all on function public.arsipkan_pelanggan(uuid, text) from anon;
revoke all on function public.kembalikan_pelanggan(uuid) from anon;
grant execute on function public.arsipkan_pelanggan(uuid, text) to authenticated;
grant execute on function public.kembalikan_pelanggan(uuid) to authenticated;

-- ---------- Bukti bahwa celahnya tertutup ----------
-- Jalankan sebagai admin. Semuanya harus gagal atau nol baris:
--   delete from public.pelanggan where id = '<punya jejak poin>';
--     -> ditolak RLS (0 baris). Kalau policy sempat dipasang lagi,
--        foreign key restrict yang menolak dengan galat 23503.
--   update public.point_ledger set sisa = 0;   -> 0 baris
--   delete from public.point_ledger;           -> 0 baris
