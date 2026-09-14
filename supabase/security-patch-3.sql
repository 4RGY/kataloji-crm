-- ============================================================
-- PATCH KEAMANAN 3, Kataloji CRM
-- Prasyarat: schema.sql, rbac.sql, ledger-poin.sql,
--            security-patch.sql, security-patch-2.sql sudah dijalankan.
-- Aman dijalankan ulang (idempotent).
--
-- MASALAH YANG DIPERBAIKI
--
-- BUG: NOMOR WHATSAPP TIDAK UNIK DI DATABASE.
--
-- Selama ini "satu nomor WhatsApp = satu pelanggan" (BR-CUS) hanya
-- diperiksa di aplikasi: halaman Pelanggan menanyakan dulu
-- `select id from pelanggan where whatsapp = ...` sebelum insert.
-- Pemeriksaan itu bisa dilewati dengan dua cara:
--   1. Mengirim dua permintaan langsung ke /rest/v1/pelanggan.
--   2. Dua kasir menekan Simpan hampir bersamaan (balapan).
-- Terbukti: dua pelanggan bernomor sama-sama 628777000111 berhasil
-- dibuat, keduanya balas HTTP 201.
--
-- Kenapa ini berbahaya untuk program loyalitas:
--   - Poin pelanggan menjadi pecah. Nilai total 60.000 hanya memberi
--     3 poin di satu baris, sementara baris kembarannya tetap 0.
--     Pelanggan dirugikan tanpa ada yang sadar.
--   - Riwayat kunjungan terbelah, jadi segmentasi RFM salah.
--   - Kasir di meja melihat dua entri nama sama dan tidak tahu mana
--     yang harus dipakai.
--
-- PERBAIKAN: jadikan aturan itu bagian dari skema, bukan kesepakatan
-- di kode. Contohnya supaya nomor yang sudah dirapikan
-- (`0812...` menjadi `62812...`) tetap dianggap sama, uniknya
-- ditetapkan pada nilai yang sudah dinormalkan.
--
-- Catatan: normalisasi nomor tetap dilakukan di aplikasi
-- (src/lib/pelanggan.ts). Fungsi di bawah adalah jaring pengaman
-- lapisan database; sengaja dibuat sederhana dan hanya menangani
-- bentuk yang lazim (awalan 0, 62, +62, dan spasi/tanda hubung).
-- Kalau nanti aturan nomornya berubah, ubah di DUA tempat.
-- ============================================================

-- ---------- 1. Rapikan nomor yang sudah ada dulu ----------
-- Baris kembar harus dibereskan sebelum indeks unik dibuat, kalau
-- tidak pembuatan indeks akan gagal.
--
-- Kembaran yang lebih tua dipertahankan sebagai pemilik nomor, karena
-- ke sanalah poin pertama kali tercatat. Kembaran yang lebih baru
-- diberi penanda "-DUP" supaya tidak menghalangi indeks, tanpa
-- menghapus datanya (data pelanggan tidak boleh hilang diam-diam).
-- Admin bisa menggabungkan keduanya secara manual lewat SQL Editor.
--
-- PENTING: trigger normalisasi dimatikan selama pembersihan.
-- Kalau tidak, penanda "-DUP2" ikut dibersihkan oleh
-- normalisasi_whatsapp() saat baris itu di-UPDATE, sehingga nomor
-- berubah menjadi angka palsu seperti "6285551112222". Ini baru
-- terasa pada pemasangan ulang (ketika trigger sudah ada), bukan
-- pada pemasangan pertama. Harness verifikasi menangkapnya.
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_rapikan_whatsapp') then
    execute 'alter table public.pelanggan disable trigger trg_rapikan_whatsapp';
  end if;
end $$;

do $$
declare
  r record;
begin
  for r in
    select id, row_number() over (partition by whatsapp order by created_at, id) as urutan
    from public.pelanggan
  loop
    if r.urutan > 1 then
      update public.pelanggan
         set whatsapp = whatsapp || '-DUP' || r.urutan,
             nama = nama || ' [DUPLIKAT]'
       where id = r.id;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_rapikan_whatsapp') then
    execute 'alter table public.pelanggan enable trigger trg_rapikan_whatsapp';
  end if;
end $$;

-- ---------- 2. Fungsi normalisasi nomor ----------
create or replace function public.normalisasi_whatsapp(no text)
returns text
language plpgsql
immutable
as $$
declare
  digit text;
begin
  if no is null then return null; end if;

  -- Buang semua karakter selain angka.
  digit := regexp_replace(no, '[^0-9]', '', 'g');
  if digit = '' then return null; end if;

  -- 0 di depan menjadi 62 (nomor Indonesia).
  if left(digit, 1) = '0' then
    digit := '62' || substring(digit from 2);
  end if;

  -- 8 di depan (ditulis tanpa 0) juga dianggap 62.
  if left(digit, 1) = '8' then
    digit := '62' || digit;
  end if;

  -- 620... (salah tulis 0 setelah 62) dirapikan.
  if left(digit, 3) = '620' then
    digit := '62' || substring(digit from 4);
  end if;

  return digit;
end;
$$;

-- ---------- 3. Terapkan ke baris baru lewat trigger ----------
-- Trigger, bukan hanya DEFAULT kolom, supaya nilai yang dikirim klien
-- tetap dirapikan sebelum masuk indeks unik.
create or replace function public.rapikan_whatsapp_pelanggan()
returns trigger
language plpgsql
as $$
begin
  new.whatsapp := public.normalisasi_whatsapp(new.whatsapp);
  if new.whatsapp is null then
    raise exception 'Nomor WhatsApp tidak boleh kosong atau tanpa angka.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rapikan_whatsapp on public.pelanggan;
create trigger trg_rapikan_whatsapp
  before insert or update of whatsapp on public.pelanggan
  for each row execute function public.rapikan_whatsapp_pelanggan();

-- ---------- 4. Indeks unik ----------
-- Pemeriksaan keunikan ikut memakai normalisasi, sehingga nomor lama
-- yang tersimpan dalam format berbeda tetap dianggap sama.
--
-- Indeksnya parsial: baris bertanda "-DUP" dikecualikan. Tanpa
-- pengecualian ini, normalisasi akan mengubah "628555111222-DUP2"
-- menjadi deretan angka palsu dan angka karangan itu ikut masuk
-- indeks, padahal baris tersebut hanya penanda sementara yang menunggu
-- digabungkan admin.
drop index if exists public.pelanggan_whatsapp_unik;
create unique index pelanggan_whatsapp_unik
  on public.pelanggan (public.normalisasi_whatsapp(whatsapp))
  where whatsapp not like '%-DUP%';

-- ---------- 5. Pastikan lewat jalur lain juga ----------
-- Nomor kosong/tanpa angka tidak boleh lolos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pelanggan_whatsapp_isi') then
    alter table public.pelanggan
      add constraint pelanggan_whatsapp_isi
      check (length(public.normalisasi_whatsapp(whatsapp)) >= 9);
  end if;
end $$;

notify pgrst, 'reload schema';
