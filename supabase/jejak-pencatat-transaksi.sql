-- ============================================================
-- JEJAK PENCATAT TRANSAKSI, Kataloji CRM
-- Prasyarat: schema.sql, rbac.sql, ledger-poin.sql, security-patch-2.sql
-- Aman dijalankan ulang (idempotent).
--
-- MASALAH YANG DIPERBAIKI
--
-- Sebelum ini, tabel transaksi tidak menyimpan siapa yang mencatat.
-- Padahal staf bisa lebih dari satu orang dan salah input itu wajar
-- terjadi. Ketika suatu hari ditemukan selisih antara omzet majoo dan
-- catatan CRM, tidak ada cara mengetahui transaksi mana yang keliru dan
-- siapa yang menginputnya. Semua baris tampak sama.
--
-- PERBAIKAN: tiap baris transaksi menyimpan identitas pencatatnya.
--
--   dicatat_oleh       uuid, menunjuk ke akun staf yang menekan Simpan
--   dicatat_oleh_nama  salinan namanya pada saat itu
--   dicatat_pada       waktu pencatatan
--
-- MENGAPA IDENTITAS DIAMBIL DARI SESI, BUKAN DARI KIRIMAN KLIEN
--
-- Ini bagian terpenting. Kalau aplikasi yang mengirim "saya yang mencatat",
-- nilainya bisa dipalsukan: siapa pun yang membuka Developer Tools bisa
-- mengubah isi permintaan dan mencatat transaksi atas nama orang lain.
-- Jejak seperti itu tidak berguna saat audit karena tidak membuktikan apa
-- pun tentang siapa yang sebenarnya mengerjakan.
--
-- Karena itu nilainya diambil dari auth.uid(), yaitu identitas yang
-- ditetapkan DATABASE dari token sesi yang sah. Isian apa pun dari klien
-- yang mencoba menimpanya diabaikan. Pola ini sama dengan perbaikan
-- hitungan poin: yang menentukan selalu database, bukan browser.
--
-- MENGAPA NAMANYA DISALIN, BUKAN HANYA MENYIMPAN ID
--
-- Kalau hanya menyimpan id, riwayat lama kehilangan nama begitu akun staf
-- dihapus (misalnya karyawan berhenti). Laporan audit tahun lalu mendadak
-- tidak terbaca. Karena itu namanya disalin saat pencatatan, dan kolom
-- id-nya diatur ON DELETE SET NULL supaya menghapus akun tidak pernah
-- merusak riwayat.
--
-- MENGAPA JEJAK INI DIKUNCI
--
-- Jejak yang bisa diubah bukan bukti. Trigger pengunci menolak setiap
-- usaha mengubah nama atau waktu pencatat, termasuk lewat permintaan REST
-- langsung memakai sesi manager maupun admin.
--
-- URUTAN LANGKAH ITU PENTING (ditemukan lewat pengujian, bukan dugaan):
-- pelabelan transaksi lama HARUS dikerjakan SEBELUM trigger pengunci
-- dipasang. Kalau terbalik, pengunci akan menolak justru langkah migrasi
-- sendiri karena nama pencatat berubah dari kosong menjadi label, dan
-- seluruh berkas ini gagal di tengah jalan.
--
-- TRANSAKSI LAMA
--
-- Baris yang sudah ada sebelum fitur ini TIDAK diisi dengan nama tebakan.
-- Menebak nama pada catatan audit lebih berbahaya daripada mengaku tidak
-- tahu, karena hasilnya terlihat seperti bukti padahal bukan. Baris lama
-- ditandai apa adanya sebagai "Sebelum fitur jejak pencatat".
-- ============================================================

-- ---------- 1. Kolom jejak pencatat ----------
alter table public.transaksi
  add column if not exists dicatat_oleh      uuid references auth.users(id) on delete set null,
  add column if not exists dicatat_oleh_nama text,
  add column if not exists dicatat_pada      timestamptz;

comment on column public.transaksi.dicatat_oleh is
  'Akun staf yang mencatat transaksi. Diisi otomatis dari sesi, tidak bisa diubah.';
comment on column public.transaksi.dicatat_oleh_nama is
  'Salinan nama pencatat saat transaksi dibuat, supaya riwayat tetap terbaca setelah akun dihapus.';

-- ---------- 2. BEFORE INSERT: paksa identitas dari sesi ----------
create or replace function public.isi_jejak_pencatat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_nama  text;
begin
  v_uid := auth.uid();

  if v_uid is not null then
    -- Identitas sah dari token sesi. Kiriman klien diabaikan sepenuhnya.
    new.dicatat_oleh := v_uid;
    new.dicatat_pada := now();

    select p.nama into v_nama
      from public.profile p
     where p.id = v_uid;

    -- Akun yang belum punya baris profil tetap tercatat, memakai emailnya,
    -- supaya tidak ada transaksi yang lolos tanpa jejak sama sekali.
    new.dicatat_oleh_nama := coalesce(v_nama, auth.jwt() ->> 'email', 'Tanpa nama');
  else
    -- Tanpa sesi: hanya jalur tepercaya (service role, SQL Editor, impor,
    -- harness uji). Nilai yang dikirim dipakai apa adanya; bila kosong
    -- dicatat sebagai pencatatan sistem supaya tetap jelas siapa pelakunya.
    if new.dicatat_pada is null then
      new.dicatat_pada := now();
    end if;
    new.dicatat_oleh_nama := coalesce(
      nullif(new.dicatat_oleh_nama, ''),
      'Sistem (tanpa sesi staf)'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaksi_jejak_pencatat on public.transaksi;
create trigger trg_transaksi_jejak_pencatat
  before insert on public.transaksi
  for each row execute function public.isi_jejak_pencatat();

-- ---------- 3. Tandai transaksi lama tanpa menebak nama ----------
-- WAJIB sebelum trigger pengunci dipasang (lihat catatan urutan di atas).
update public.transaksi
   set dicatat_oleh_nama = 'Sebelum fitur jejak pencatat',
       dicatat_pada      = created_at
 where dicatat_oleh is null
   and (dicatat_oleh_nama is null or dicatat_oleh_nama = '');

-- ---------- 4. BEFORE UPDATE: kunci jejak supaya tidak bisa diubah ----------
-- Tanpa ini, jejak bisa ditimpa lewat PATCH /rest/v1/transaksi memakai sesi
-- manager atau admin, dan nilainya tidak lagi bisa dipercaya saat audit.
--
-- SATU PENYIMPANGAN YANG SENGAJA DIIZINKAN: tautan ke akun boleh berubah
-- menjadi kosong, TAPI hanya bila akun itu memang sudah benar-benar
-- dihapus. Alasannya ditemukan lewat pengujian: kolom dicatat_oleh memakai
-- ON DELETE SET NULL, sehingga menghapus akun staf memicu pembaruan
-- otomatis yang menolkan kolom itu. Pengunci yang menolak semua perubahan
-- membuat penghapusan akun staf SELALU GAGAL. Jadi transisi ke kosong
-- diizinkan, tetapi dijaga ketat: selama akunnya masih ada, permintaan itu
-- ditolak, supaya tidak ada yang bisa mengosongkan jejak lewat permintaan
-- REST. Namanya tetap tersalin, jadi riwayat tetap terbaca.
create or replace function public.kunci_jejak_pencatat()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.dicatat_oleh_nama is distinct from old.dicatat_oleh_nama
     or new.dicatat_pada is distinct from old.dicatat_pada then
    raise exception
      'Jejak pencatat transaksi tidak bisa diubah atau dihapus.'
      using errcode = '42501';
  end if;

  if new.dicatat_oleh is distinct from old.dicatat_oleh then
    if new.dicatat_oleh is not null then
      raise exception
        'Jejak pencatat transaksi tidak bisa dipindahkan ke akun lain.'
        using errcode = '42501';
    end if;

    if exists (select 1 from auth.users u where u.id = old.dicatat_oleh) then
      raise exception
        'Jejak pencatat transaksi tidak bisa dihapus.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transaksi_jejak_terkunci on public.transaksi;
create trigger trg_transaksi_jejak_terkunci
  before update on public.transaksi
  for each row execute function public.kunci_jejak_pencatat();

-- ---------- 5. Kewajiban jejak untuk sesi staf ----------
-- Staf yang sudah login tidak boleh mencatat transaksi tanpa jejak.
-- Tautan ke akun yang kosong tetap diizinkan pada lapisan ini karena jalur
-- tepercaya (impor, service role) memang tidak punya sesi staf; yang
-- mencegah penyalahgunaan adalah trigger pengunci di atas.
drop policy if exists "transaksi tambah" on public.transaksi;
create policy "transaksi tambah"
  on public.transaksi for insert
  to authenticated
  with check (
    public.staff_role() in ('admin','manager','kasir')
    and (
      dicatat_oleh = auth.uid()
      or dicatat_oleh is null
    )
  );

-- ---------- 6. Index untuk penelusuran saat audit ----------
create index if not exists idx_transaksi_dicatat_oleh
  on public.transaksi (dicatat_oleh, created_at desc);

-- ---------- 7. Ringkasan pencatatan per staf ----------
-- Dipakai halaman transaksi untuk rekap "siapa mencatat berapa".
-- security_invoker supaya RLS tabel transaksi tetap berlaku bagi pemanggil.
create or replace view public.rekap_pencatat_transaksi
with (security_invoker = true)
as
select
  t.dicatat_oleh                                   as staf_id,
  coalesce(t.dicatat_oleh_nama, 'Tanpa jejak')     as nama,
  count(*)::integer                                as jumlah_transaksi,
  coalesce(sum(t.total), 0)::bigint                as total_omzet,
  max(t.created_at)                                as terakhir_mencatat
from public.transaksi t
group by t.dicatat_oleh, coalesce(t.dicatat_oleh_nama, 'Tanpa jejak');

grant select on public.rekap_pencatat_transaksi to authenticated, service_role;
revoke all on public.rekap_pencatat_transaksi from anon;
