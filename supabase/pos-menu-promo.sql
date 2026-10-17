-- ============================================================
-- POS + MENU + PROMO + SETTINGS
-- Migrasi: CRM Kataloji v2 -> POS built-in
--
-- Urutan dependency: schema.sql -> rbac.sql -> ledger-poin.sql
--   -> security-patch.sql -> security-patch-2.sql -> security-patch-3.sql
--   -> aturan-poin.sql -> jejak-pencatat-transaksi.sql
--   -> perbaikan-hapus-transaksi.sql
--   -> FILE INI
--
-- Idempotent. Aman dijalankan ulang.
-- ============================================================

-- ============================================================
-- 1. TABEL SETTINGS (sumber kebenaran konfigurasi)
-- ============================================================
create table if not exists public.settings (
  key         text primary key,
  value       text not null,
  keterangan  text,
  updated_at  timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Policy: admin boleh semua, manager+kasir boleh baca
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (true);

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings
  for all to authenticated
  using (public.staff_role() = 'admin')
  with check (public.staff_role() = 'admin');

-- Seed default values (insert if not exists)
insert into public.settings (key, value, keterangan) values
  ('ppn_persen', '10', 'Persen Pajak Pertambahan Nilai'),
  ('biaya_layanan_persen', '5', 'Persen biaya pelayanan (service charge)'),
  ('poin_per_rupiah', '20000', 'Rp yang menghasilkan 1 poin'),
  ('nilai_poin', '1000', 'Nilai tukar 1 poin dalam Rupiah'),
  ('min_redeem', '5', 'Minimum poin untuk ditukar'),
  ('max_redeem_persen', '100', 'Maksimum persen tagihan yang bisa dibayar poin'),
  ('masa_kadaluwarsa_poin_bulan', '12', 'Masa berlaku poin dalam bulan (FIFO)'),
  ('nota_prefix', 'CS', 'Kode awal nomor nota'),
  ('struk_nama', 'Kataloji Coffee and Eatery', 'Nama untuk header struk'),
  ('struk_alamat', 'Ruko Puri Cipayung 05 Jalan Setu Cipayung Raya No.09 RT09/RW04 Setu Cipayung - Jakarta Timur', 'Alamat untuk struk'),
  ('struk_wifi_nama', 'Kataloji Customer', 'Nama WiFi untuk struk'),
  ('struk_wifi_pass', 'kopisusukataloji', 'Password WiFi untuk struk'),
  ('struk_instagram', 'kataloji.co', 'Akun Instagram untuk struk'),
  ('struk_footer', 'dicetak: Kataloji', 'Footer struk')
on conflict (key) do nothing;

-- ============================================================
-- 2. TABEL MENU KATEGORI
-- ============================================================
create table if not exists public.menu_kategori (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  urutan      integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.menu_kategori enable row level security;

drop policy if exists menu_kategori_select on public.menu_kategori;
create policy menu_kategori_select on public.menu_kategori
  for select to authenticated using (true);

drop policy if exists menu_kategori_write on public.menu_kategori;
create policy menu_kategori_write on public.menu_kategori
  for all to authenticated
  using (public.staff_role() in ('admin','manager'))
  with check (public.staff_role() in ('admin','manager'));

-- ============================================================
-- 3. TABEL MENU
-- ============================================================
create table if not exists public.menu (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,
  harga        integer not null check (harga >= 0),
  gambar_url   text,
  kategori_id  uuid references public.menu_kategori(id) on delete set null,
  aktif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_menu_kategori on public.menu (kategori_id);
create index if not exists idx_menu_aktif on public.menu (aktif) where aktif = true;

alter table public.menu enable row level security;

drop policy if exists menu_select on public.menu;
create policy menu_select on public.menu
  for select to authenticated using (true);

drop policy if exists menu_write on public.menu;
create policy menu_write on public.menu
  for all to authenticated
  using (public.staff_role() in ('admin','manager'))
  with check (public.staff_role() in ('admin','manager'));

drop trigger if exists trg_menu_updated_at on public.menu;
create trigger trg_menu_updated_at
  before update on public.menu
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. KOLOM BARU DI TABEL TRANSAKSI
-- ============================================================
alter table public.transaksi
  add column if not exists subtotal integer;

alter table public.transaksi
  add column if not exists ppn integer not null default 0;

alter table public.transaksi
  add column if not exists biaya_layanan integer not null default 0;

alter table public.transaksi
  add column if not exists metode_bayar text not null default 'tunai';

alter table public.transaksi
  add column if not exists jumlah_bayar integer not null default 0;

alter table public.transaksi
  add column if not exists kembalian integer not null default 0;

alter table public.transaksi
  add column if not exists no_nota text;

-- (promo_id ditambah setelah tabel promo dibuat, lihat section 6)

-- Backfill transaksi lama: subtotal = total, metode bayar default
update public.transaksi
   set subtotal = total
 where subtotal is null;

-- Set subtotal NOT NULL setelah backfill
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'transaksi' and column_name = 'subtotal'
      and is_nullable = 'YES'
  ) then
    alter table public.transaksi
      alter column subtotal set not null;
  end if;
end $$;

-- Normalize metode_bayar yang ada (case-insensitive)
update public.transaksi set metode_bayar = 'tunai' where lower(metode_bayar) = 'tunai';
update public.transaksi set metode_bayar = 'qris' where lower(metode_bayar) = 'qris';
update public.transaksi set metode_bayar = 'debit' where lower(metode_bayar) like '%debit%';
update public.transaksi set metode_bayar = 'tunai' where metode_bayar is null;

-- Constraint metode_bayar
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transaksi_metode_bayar_cek'
  ) then
    alter table public.transaksi
      add constraint transaksi_metode_bayar_cek
      check (metode_bayar in ('tunai','debit','qris'));
  end if;
end $$;

-- Tambah 'crm_pos' ke allowed source
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'transaksi_source_cek'
  ) then
    alter table public.transaksi
      drop constraint transaksi_source_cek;
  end if;
end $$;
alter table public.transaksi
  add constraint transaksi_source_cek
  check (source in ('crm_manual','majoo_parallel','majoo_import','csv_import','crm_pos'));

-- ============================================================
-- 5. TABEL TRANSAKSI_ITEM
-- ============================================================
create table if not exists public.transaksi_item (
  id            uuid primary key default gen_random_uuid(),
  transaksi_id  uuid not null references public.transaksi(id) on delete cascade,
  menu_id       uuid references public.menu(id) on delete set null,
  nama          text not null,
  qty           integer not null default 1 check (qty > 0),
  harga_satuan  integer not null check (harga_satuan >= 0),
  subtotal      integer not null check (subtotal >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists idx_transaksi_item_transaksi
  on public.transaksi_item (transaksi_id);

alter table public.transaksi_item enable row level security;

drop policy if exists transaksi_item_select on public.transaksi_item;
create policy transaksi_item_select on public.transaksi_item
  for select to authenticated using (true);

drop policy if exists transaksi_item_insert on public.transaksi_item;
create policy transaksi_item_insert on public.transaksi_item
  for insert to authenticated with check (true);

drop policy if exists transaksi_item_delete on public.transaksi_item;
create policy transaksi_item_delete on public.transaksi_item
  for delete to authenticated using (public.staff_role() in ('admin','manager'));

-- ============================================================
-- 6. TABEL PROMO
-- ============================================================
create table if not exists public.promo (
  id             uuid primary key default gen_random_uuid(),
  nama           text not null,
  tipe           text not null check (tipe in ('diskon_persen','diskon_tetap','bundle')),
  nilai          integer not null check (nilai >= 0),
  syarat_min     integer not null default 0 check (syarat_min >= 0),
  aktif          boolean not null default true,
  berlaku_mulai  date,
  berlaku_sampai date,
  created_at     timestamptz not null default now()
);

-- Tambah promo_id ke transaksi (sekarang tabel promo sudah ada)
alter table public.transaksi
  add column if not exists promo_id uuid references public.promo(id) on delete set null;

alter table public.promo enable row level security;

drop policy if exists promo_select on public.promo;
create policy promo_select on public.promo
  for select to authenticated using (true);

drop policy if exists promo_write on public.promo;
create policy promo_write on public.promo
  for all to authenticated
  using (public.staff_role() in ('admin','manager'))
  with check (public.staff_role() in ('admin','manager'));

-- ============================================================
-- 7. UPDATE TRIGGER POIN: pakai subtotal + baca dari settings
-- ============================================================
-- BR-TRX-05 (updated): basis poin = subtotal - diskon
-- PPN dan biaya layanan TIDAK ikut dihitung.
-- poin_per_rupiah dibaca dari tabel settings (default 20000).

create or replace function public.hitung_poin_transaksi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  basis integer;
  v_poin_per_rupiah integer;
begin
  if new.pelanggan_id is null then
    new.poin_didapat := 0;
    new.poin_dipakai := 0;
    return new;
  end if;

  -- Baca konfigurasi dari settings, fallback 20000
  select value::integer into v_poin_per_rupiah
  from public.settings where key = 'poin_per_rupiah';
  if v_poin_per_rupiah is null or v_poin_per_rupiah <= 0 then
    v_poin_per_rupiah := 20000;
  end if;

  -- BR-TRX-05: basis = subtotal - diskon (SEBELUM PPN & biaya layanan)
  -- Fallback: kalau subtotal null (transaksi lama), pakai total
  basis := greatest(0,
    coalesce(new.subtotal, new.total, 0) - coalesce(new.diskon, 0)
  );
  new.poin_didapat := floor(basis / v_poin_per_rupiah)::integer;

  if coalesce(new.poin_dipakai, 0) < 0 then
    new.poin_dipakai := 0;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 8. UPDATE APPLY_TRANSAKSI_POIN: baca masa kadaluwarsa dari settings
-- ============================================================
create or replace function public.apply_transaksi_poin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bulan integer;
begin
  if new.pelanggan_id is null then
    return new;
  end if;

  if coalesce(new.poin_dipakai, 0) > 0 then
    perform public.tukar_poin(new.pelanggan_id, new.poin_dipakai, new.id);
  end if;

  if coalesce(new.poin_didapat, 0) > 0 then
    -- Baca masa kadaluwarsa dari settings, fallback 12 bulan
    select value::integer into v_bulan
    from public.settings where key = 'masa_kadaluwarsa_poin_bulan';
    if v_bulan is null or v_bulan <= 0 then
      v_bulan := 12;
    end if;

    insert into public.point_ledger
      (pelanggan_id, transaksi_id, tipe, poin_masuk, sisa, kedaluwarsa_pada, keterangan)
    values
      (new.pelanggan_id, new.id, 'earn', new.poin_didapat, new.poin_didapat,
       (new.created_at + (v_bulan || ' months')::interval)::date,
       'Poin dari transaksi');
  end if;

  update public.pelanggan
     set poin = public.saldo_poin(new.pelanggan_id)
   where id = new.pelanggan_id;

  return new;
end;
$$;

-- Revoke ulang (create or replace reset ACL)
revoke execute on function public.hitung_poin_transaksi() from public, anon, authenticated;
revoke execute on function public.apply_transaksi_poin() from public, anon, authenticated;

-- ============================================================
-- 9. NOMOR NOTA OTOMATIS
-- Format: CS/YYMMDD/NNNN (auto-increment per hari)
-- ============================================================
create or replace function public.buat_no_nota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_tanggal text;
  v_urutan integer;
begin
  -- Jangan timpa jika sudah ada (mis. dari impor)
  if new.no_nota is not null then
    return new;
  end if;

  select value into v_prefix from public.settings where key = 'nota_prefix';
  if v_prefix is null then
    v_prefix := 'CS';
  end if;

  v_tanggal := to_char(new.created_at::date, 'YYMMDD');

  select count(*) + 1 into v_urutan
  from public.transaksi
  where no_nota is not null
    and no_nota like v_prefix || '/' || v_tanggal || '/%';

  new.no_nota := v_prefix || '/' || v_tanggal || '/'
    || lpad(v_urutan::text, 4, '0');

  return new;
end;
$$;

drop trigger if exists trg_transaksi_no_nota on public.transaksi;
create trigger trg_transaksi_no_nota
  before insert on public.transaksi
  for each row execute function public.buat_no_nota();

revoke execute on function public.buat_no_nota() from public, anon, authenticated;

-- ============================================================
-- 10. GRANT
-- ============================================================
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.menu_kategori to authenticated;
grant select, insert, update, delete on public.menu to authenticated;
grant select, insert, delete on public.transaksi_item to authenticated;
grant select, insert, update, delete on public.promo to authenticated;

-- ============================================================
-- 11. SEED DUMMY: KATEGORI + MENU
-- ============================================================
insert into public.menu_kategori (nama, urutan) values
  ('Kopi', 1),
  ('Non-Kopi', 2),
  ('Makanan', 3),
  ('Snack', 4)
on conflict do nothing;

insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values
  ('Espresso', 18000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Cappuccino', 25000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Caffe Latte', 28000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Americano', 22000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Mont Blanc', 32000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Caramel Macchiato', 30000, (select id from public.menu_kategori where nama='Kopi' limit 1), null, true),
  ('Matcha Latte', 28000, (select id from public.menu_kategori where nama='Non-Kopi' limit 1), null, true),
  ('Chocolate', 25000, (select id from public.menu_kategori where nama='Non-Kopi' limit 1), null, true),
  ('Lemon Tea', 20000, (select id from public.menu_kategori where nama='Non-Kopi' limit 1), null, true),
  ('Nasi Goreng Kataloji', 35000, (select id from public.menu_kategori where nama='Makanan' limit 1), null, true),
  ('Spaghetti Aglio Olio', 38000, (select id from public.menu_kategori where nama='Makanan' limit 1), null, true),
  ('Croissant', 18000, (select id from public.menu_kategori where nama='Snack' limit 1), null, true),
  ('Kentang Goreng', 22000, (select id from public.menu_kategori where nama='Snack' limit 1), null, true),
  ('Cheesecake', 30000, (select id from public.menu_kategori where nama='Snack' limit 1), null, true)
on conflict do nothing;

notify pgrst, 'reload schema';
