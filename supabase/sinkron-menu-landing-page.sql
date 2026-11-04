-- ============================================================
-- SINKRONISASI MENU POS KATALOJI DENGAN LANDING PAGE (91 MENU)
-- Sumber: kataloji-web/lib/data.ts (Reyhan Dava & Rahma)
-- Idempotent. Aman dijalankan ulang.
-- ============================================================

-- 1. PASTIKAN 5 KATEGORI STANDAR TERSEDIA
do $$
begin
  -- Normalisasi nama kategori lama jika ada
  update public.menu_kategori set nama = 'Non-Kopi & Matcha', urutan = 2 where nama = 'Non-Kopi';
  update public.menu_kategori set nama = 'Main Course', urutan = 3 where nama = 'Makanan';
  update public.menu_kategori set nama = 'Starter', urutan = 5 where nama = 'Snack';

  -- Upsert 5 kategori
  if not exists (select 1 from public.menu_kategori where nama = 'Kopi') then
    insert into public.menu_kategori (nama, urutan) values ('Kopi', 1);
  else
    update public.menu_kategori set urutan = 1 where nama = 'Kopi';
  end if;
  if not exists (select 1 from public.menu_kategori where nama = 'Non-Kopi & Matcha') then
    insert into public.menu_kategori (nama, urutan) values ('Non-Kopi & Matcha', 2);
  else
    update public.menu_kategori set urutan = 2 where nama = 'Non-Kopi & Matcha';
  end if;
  if not exists (select 1 from public.menu_kategori where nama = 'Main Course') then
    insert into public.menu_kategori (nama, urutan) values ('Main Course', 3);
  else
    update public.menu_kategori set urutan = 3 where nama = 'Main Course';
  end if;
  if not exists (select 1 from public.menu_kategori where nama = 'Pastry & Sweet') then
    insert into public.menu_kategori (nama, urutan) values ('Pastry & Sweet', 4);
  else
    update public.menu_kategori set urutan = 4 where nama = 'Pastry & Sweet';
  end if;
  if not exists (select 1 from public.menu_kategori where nama = 'Starter') then
    insert into public.menu_kategori (nama, urutan) values ('Starter', 5);
  else
    update public.menu_kategori set urutan = 5 where nama = 'Starter';
  end if;
end $$;

-- 2. UPSERT 91 MENU LENGKAP
do $$
declare
  v_kat_kopi uuid;
  v_kat_nonkopi uuid;
  v_kat_main uuid;
  v_kat_pastry uuid;
  v_kat_starter uuid;
begin
  select id into v_kat_kopi from public.menu_kategori where nama = 'Kopi' limit 1;
  select id into v_kat_nonkopi from public.menu_kategori where nama = 'Non-Kopi & Matcha' limit 1;
  select id into v_kat_main from public.menu_kategori where nama = 'Main Course' limit 1;
  select id into v_kat_pastry from public.menu_kategori where nama = 'Pastry & Sweet' limit 1;
  select id into v_kat_starter from public.menu_kategori where nama = 'Starter' limit 1;

  -- Espresso
  if exists (select 1 from public.menu where nama = 'Espresso') then
    update public.menu set harga = 18000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/espresso.jpg', aktif = true where nama = 'Espresso';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Espresso', 18000, v_kat_kopi, '/assets/menu-items/espresso.jpg', true);
  end if;
  -- Americano
  if exists (select 1 from public.menu where nama = 'Americano') then
    update public.menu set harga = 26000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/americano.jpg', aktif = true where nama = 'Americano';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Americano', 26000, v_kat_kopi, '/assets/menu-items/americano.jpg', true);
  end if;
  -- Cafe Latte
  if exists (select 1 from public.menu where nama = 'Cafe Latte') then
    update public.menu set harga = 28000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/cafe-latte.jpg', aktif = true where nama = 'Cafe Latte';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cafe Latte', 28000, v_kat_kopi, '/assets/menu-items/cafe-latte.jpg', true);
  end if;
  -- Cappuccino
  if exists (select 1 from public.menu where nama = 'Cappuccino') then
    update public.menu set harga = 28000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/cappuccino.jpg', aktif = true where nama = 'Cappuccino';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cappuccino', 28000, v_kat_kopi, '/assets/menu-items/cappuccino.jpg', true);
  end if;
  -- Magic
  if exists (select 1 from public.menu where nama = 'Magic') then
    update public.menu set harga = 30000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/magic.jpg', aktif = true where nama = 'Magic';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Magic', 30000, v_kat_kopi, '/assets/menu-items/magic.jpg', true);
  end if;
  -- Manual Brew (Lokal)
  if exists (select 1 from public.menu where nama = 'Manual Brew (Lokal)') then
    update public.menu set harga = 30000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/manual-brew-lokal.jpg', aktif = true where nama = 'Manual Brew (Lokal)';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Manual Brew (Lokal)', 30000, v_kat_kopi, '/assets/menu-items/manual-brew-lokal.jpg', true);
  end if;
  -- Manual Brew (Seasonal)
  if exists (select 1 from public.menu where nama = 'Manual Brew (Seasonal)') then
    update public.menu set harga = 33000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/manual-brew-seasonal.jpg', aktif = true where nama = 'Manual Brew (Seasonal)';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Manual Brew (Seasonal)', 33000, v_kat_kopi, '/assets/menu-items/manual-brew-seasonal.jpg', true);
  end if;
  -- Montblanc
  if exists (select 1 from public.menu where nama = 'Montblanc') then
    update public.menu set harga = 32000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/montblanc.jpg', aktif = true where nama = 'Montblanc';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Montblanc', 32000, v_kat_kopi, '/assets/menu-items/montblanc.jpg', true);
  end if;
  -- Black Lemonade
  if exists (select 1 from public.menu where nama = 'Black Lemonade') then
    update public.menu set harga = 32000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/black-lemonade.jpg', aktif = true where nama = 'Black Lemonade';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Black Lemonade', 32000, v_kat_kopi, '/assets/menu-items/black-lemonade.jpg', true);
  end if;
  -- Black Orange
  if exists (select 1 from public.menu where nama = 'Black Orange') then
    update public.menu set harga = 32000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/black-orange.jpg', aktif = true where nama = 'Black Orange';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Black Orange', 32000, v_kat_kopi, '/assets/menu-items/black-orange.jpg', true);
  end if;
  -- Affogato
  if exists (select 1 from public.menu where nama = 'Affogato') then
    update public.menu set harga = 24000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/affogato.jpg', aktif = true where nama = 'Affogato';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Affogato', 24000, v_kat_kopi, '/assets/menu-items/affogato.jpg', true);
  end if;
  -- Crème Brûlée
  if exists (select 1 from public.menu where nama = 'Crème Brûlée') then
    update public.menu set harga = 35000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/crème-brulee.jpg', aktif = true where nama = 'Crème Brûlée';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Crème Brûlée', 35000, v_kat_kopi, '/assets/menu-items/crème-brulee.jpg', true);
  end if;
  -- Butterscotch
  if exists (select 1 from public.menu where nama = 'Butterscotch') then
    update public.menu set harga = 35000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/butterscotch.jpg', aktif = true where nama = 'Butterscotch';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Butterscotch', 35000, v_kat_kopi, '/assets/menu-items/butterscotch.jpg', true);
  end if;
  -- Gula Aren
  if exists (select 1 from public.menu where nama = 'Gula Aren') then
    update public.menu set harga = 30000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/gula-aren.jpg', aktif = true where nama = 'Gula Aren';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Gula Aren', 30000, v_kat_kopi, '/assets/menu-items/gula-aren.jpg', true);
  end if;
  -- Spanish Latte OG
  if exists (select 1 from public.menu where nama = 'Spanish Latte OG') then
    update public.menu set harga = 30000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/spanish-latte-og.jpg', aktif = true where nama = 'Spanish Latte OG';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spanish Latte OG', 30000, v_kat_kopi, '/assets/menu-items/spanish-latte-og.jpg', true);
  end if;
  -- Spanish Latte Pistachio
  if exists (select 1 from public.menu where nama = 'Spanish Latte Pistachio') then
    update public.menu set harga = 32000, kategori_id = v_kat_kopi, gambar_url = '/assets/menu-items/spanish-latte-pistachio.jpg', aktif = true where nama = 'Spanish Latte Pistachio';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spanish Latte Pistachio', 32000, v_kat_kopi, '/assets/menu-items/spanish-latte-pistachio.jpg', true);
  end if;
  -- Matcha Original
  if exists (select 1 from public.menu where nama = 'Matcha Original') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/matcha-original.jpg', aktif = true where nama = 'Matcha Original';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Matcha Original', 30000, v_kat_nonkopi, '/assets/menu-items/matcha-original.jpg', true);
  end if;
  -- Matcha Crème Brûlée
  if exists (select 1 from public.menu where nama = 'Matcha Crème Brûlée') then
    update public.menu set harga = 40000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/matcha-crème-brulee.jpg', aktif = true where nama = 'Matcha Crème Brûlée';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Matcha Crème Brûlée', 40000, v_kat_nonkopi, '/assets/menu-items/matcha-crème-brulee.jpg', true);
  end if;
  -- Dirty Matcha
  if exists (select 1 from public.menu where nama = 'Dirty Matcha') then
    update public.menu set harga = 40000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/dirty-matcha.jpg', aktif = true where nama = 'Dirty Matcha';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Dirty Matcha', 40000, v_kat_nonkopi, '/assets/menu-items/dirty-matcha.jpg', true);
  end if;
  -- Strawberry Matcha
  if exists (select 1 from public.menu where nama = 'Strawberry Matcha') then
    update public.menu set harga = 40000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/strawberry-matcha.jpg', aktif = true where nama = 'Strawberry Matcha';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Strawberry Matcha', 40000, v_kat_nonkopi, '/assets/menu-items/strawberry-matcha.jpg', true);
  end if;
  -- Matcha Pistachio
  if exists (select 1 from public.menu where nama = 'Matcha Pistachio') then
    update public.menu set harga = 40000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/matcha-pistachio.jpg', aktif = true where nama = 'Matcha Pistachio';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Matcha Pistachio', 40000, v_kat_nonkopi, '/assets/menu-items/matcha-pistachio.jpg', true);
  end if;
  -- Matcha Cheese
  if exists (select 1 from public.menu where nama = 'Matcha Cheese') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/matcha-cheese.jpg', aktif = true where nama = 'Matcha Cheese';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Matcha Cheese', 32000, v_kat_nonkopi, '/assets/menu-items/matcha-cheese.jpg', true);
  end if;
  -- Summer
  if exists (select 1 from public.menu where nama = 'Summer') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/summer.jpg', aktif = true where nama = 'Summer';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Summer', 32000, v_kat_nonkopi, '/assets/menu-items/summer.jpg', true);
  end if;
  -- Cosmopolitan
  if exists (select 1 from public.menu where nama = 'Cosmopolitan') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/cosmopolitan.jpg', aktif = true where nama = 'Cosmopolitan';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cosmopolitan', 32000, v_kat_nonkopi, '/assets/menu-items/cosmopolitan.jpg', true);
  end if;
  -- Summer Flamingo
  if exists (select 1 from public.menu where nama = 'Summer Flamingo') then
    update public.menu set harga = 28000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/summer-flamingo.jpg', aktif = true where nama = 'Summer Flamingo';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Summer Flamingo', 28000, v_kat_nonkopi, '/assets/menu-items/summer-flamingo.jpg', true);
  end if;
  -- Shining Yellow
  if exists (select 1 from public.menu where nama = 'Shining Yellow') then
    update public.menu set harga = 28000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/shining-yellow.jpg', aktif = true where nama = 'Shining Yellow';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Shining Yellow', 28000, v_kat_nonkopi, '/assets/menu-items/shining-yellow.jpg', true);
  end if;
  -- Beach Please
  if exists (select 1 from public.menu where nama = 'Beach Please') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/beach-please.jpg', aktif = true where nama = 'Beach Please';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Beach Please', 30000, v_kat_nonkopi, '/assets/menu-items/beach-please.jpg', true);
  end if;
  -- Velvet Hibiscus
  if exists (select 1 from public.menu where nama = 'Velvet Hibiscus') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/velvet-hibiscus.jpg', aktif = true where nama = 'Velvet Hibiscus';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Velvet Hibiscus', 30000, v_kat_nonkopi, '/assets/menu-items/velvet-hibiscus.jpg', true);
  end if;
  -- Chocolate
  if exists (select 1 from public.menu where nama = 'Chocolate') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/chocolate.jpg', aktif = true where nama = 'Chocolate';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Chocolate', 30000, v_kat_nonkopi, '/assets/menu-items/chocolate.jpg', true);
  end if;
  -- Chocolate Mint
  if exists (select 1 from public.menu where nama = 'Chocolate Mint') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/chocolate-mint.jpg', aktif = true where nama = 'Chocolate Mint';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Chocolate Mint', 32000, v_kat_nonkopi, '/assets/menu-items/chocolate-mint.jpg', true);
  end if;
  -- Chocolate Pistachio
  if exists (select 1 from public.menu where nama = 'Chocolate Pistachio') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/chocolate-pistachio.jpg', aktif = true where nama = 'Chocolate Pistachio';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Chocolate Pistachio', 32000, v_kat_nonkopi, '/assets/menu-items/chocolate-pistachio.jpg', true);
  end if;
  -- Taro Latte
  if exists (select 1 from public.menu where nama = 'Taro Latte') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/taro-latte.jpg', aktif = true where nama = 'Taro Latte';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Taro Latte', 30000, v_kat_nonkopi, '/assets/menu-items/taro-latte.jpg', true);
  end if;
  -- Taro Cheese
  if exists (select 1 from public.menu where nama = 'Taro Cheese') then
    update public.menu set harga = 32000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/taro-cheese.jpg', aktif = true where nama = 'Taro Cheese';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Taro Cheese', 32000, v_kat_nonkopi, '/assets/menu-items/taro-cheese.jpg', true);
  end if;
  -- Easy Peachy
  if exists (select 1 from public.menu where nama = 'Easy Peachy') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/easy-peachy.jpg', aktif = true where nama = 'Easy Peachy';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Easy Peachy', 30000, v_kat_nonkopi, '/assets/menu-items/easy-peachy.jpg', true);
  end if;
  -- Le Lact
  if exists (select 1 from public.menu where nama = 'Le Lact') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/le-lact.jpg', aktif = true where nama = 'Le Lact';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Le Lact', 30000, v_kat_nonkopi, '/assets/menu-items/le-lact.jpg', true);
  end if;
  -- Sakura Bloom
  if exists (select 1 from public.menu where nama = 'Sakura Bloom') then
    update public.menu set harga = 30000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/sakura-bloom.jpg', aktif = true where nama = 'Sakura Bloom';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Sakura Bloom', 30000, v_kat_nonkopi, '/assets/menu-items/sakura-bloom.jpg', true);
  end if;
  -- Strawberry Tea
  if exists (select 1 from public.menu where nama = 'Strawberry Tea') then
    update public.menu set harga = 20000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/strawberry-tea.jpg', aktif = true where nama = 'Strawberry Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Strawberry Tea', 20000, v_kat_nonkopi, '/assets/menu-items/strawberry-tea.jpg', true);
  end if;
  -- Mango Tea
  if exists (select 1 from public.menu where nama = 'Mango Tea') then
    update public.menu set harga = 20000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/mango-tea.jpg', aktif = true where nama = 'Mango Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Mango Tea', 20000, v_kat_nonkopi, '/assets/menu-items/mango-tea.jpg', true);
  end if;
  -- Peach Tea
  if exists (select 1 from public.menu where nama = 'Peach Tea') then
    update public.menu set harga = 22000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/peach-tea.jpg', aktif = true where nama = 'Peach Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Peach Tea', 22000, v_kat_nonkopi, '/assets/menu-items/peach-tea.jpg', true);
  end if;
  -- Lemon Tea
  if exists (select 1 from public.menu where nama = 'Lemon Tea') then
    update public.menu set harga = 22000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/lemon-tea.jpg', aktif = true where nama = 'Lemon Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Lemon Tea', 22000, v_kat_nonkopi, '/assets/menu-items/lemon-tea.jpg', true);
  end if;
  -- Jasmine Tea
  if exists (select 1 from public.menu where nama = 'Jasmine Tea') then
    update public.menu set harga = 20000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/jasmine-tea.jpg', aktif = true where nama = 'Jasmine Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Jasmine Tea', 20000, v_kat_nonkopi, '/assets/menu-items/jasmine-tea.jpg', true);
  end if;
  -- Lychee Tea
  if exists (select 1 from public.menu where nama = 'Lychee Tea') then
    update public.menu set harga = 22000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/lychee-tea.jpg', aktif = true where nama = 'Lychee Tea';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Lychee Tea', 22000, v_kat_nonkopi, '/assets/menu-items/lychee-tea.jpg', true);
  end if;
  -- Soursop Mango
  if exists (select 1 from public.menu where nama = 'Soursop Mango') then
    update public.menu set harga = 25000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/soursop-mango.jpg', aktif = true where nama = 'Soursop Mango';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Soursop Mango', 25000, v_kat_nonkopi, '/assets/menu-items/soursop-mango.jpg', true);
  end if;
  -- Grapes Apple Berry
  if exists (select 1 from public.menu where nama = 'Grapes Apple Berry') then
    update public.menu set harga = 25000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/grapes-apple-berry.jpg', aktif = true where nama = 'Grapes Apple Berry';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Grapes Apple Berry', 25000, v_kat_nonkopi, '/assets/menu-items/grapes-apple-berry.jpg', true);
  end if;
  -- Lychee Berry
  if exists (select 1 from public.menu where nama = 'Lychee Berry') then
    update public.menu set harga = 25000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/lychee-berry.jpg', aktif = true where nama = 'Lychee Berry';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Lychee Berry', 25000, v_kat_nonkopi, '/assets/menu-items/lychee-berry.jpg', true);
  end if;
  -- Orange Peach
  if exists (select 1 from public.menu where nama = 'Orange Peach') then
    update public.menu set harga = 25000, kategori_id = v_kat_nonkopi, gambar_url = '/assets/menu-items/orange-peach.jpg', aktif = true where nama = 'Orange Peach';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Orange Peach', 25000, v_kat_nonkopi, '/assets/menu-items/orange-peach.jpg', true);
  end if;
  -- Iga Bakar
  if exists (select 1 from public.menu where nama = 'Iga Bakar') then
    update public.menu set harga = 60000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/iga-bakar.jpg', aktif = true where nama = 'Iga Bakar';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Iga Bakar', 60000, v_kat_main, '/assets/menu-items/iga-bakar.jpg', true);
  end if;
  -- Sop Buntut
  if exists (select 1 from public.menu where nama = 'Sop Buntut') then
    update public.menu set harga = 70000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/sop-buntut.jpg', aktif = true where nama = 'Sop Buntut';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Sop Buntut', 70000, v_kat_main, '/assets/menu-items/sop-buntut.jpg', true);
  end if;
  -- Kwetiau Goreng
  if exists (select 1 from public.menu where nama = 'Kwetiau Goreng') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/kwetiau-goreng.jpg', aktif = true where nama = 'Kwetiau Goreng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Kwetiau Goreng', 35000, v_kat_main, '/assets/menu-items/kwetiau-goreng.jpg', true);
  end if;
  -- Mie Goreng
  if exists (select 1 from public.menu where nama = 'Mie Goreng') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/mie-goreng.jpg', aktif = true where nama = 'Mie Goreng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Mie Goreng', 35000, v_kat_main, '/assets/menu-items/mie-goreng.jpg', true);
  end if;
  -- Nasi Goreng
  if exists (select 1 from public.menu where nama = 'Nasi Goreng') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/nasi-goreng.jpg', aktif = true where nama = 'Nasi Goreng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Nasi Goreng', 35000, v_kat_main, '/assets/menu-items/nasi-goreng.jpg', true);
  end if;
  -- Pecak Nila
  if exists (select 1 from public.menu where nama = 'Pecak Nila') then
    update public.menu set harga = 45000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/pecak-nila.jpg', aktif = true where nama = 'Pecak Nila';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pecak Nila', 45000, v_kat_main, '/assets/menu-items/pecak-nila.jpg', true);
  end if;
  -- Nila Bakar Bumbu Rujak
  if exists (select 1 from public.menu where nama = 'Nila Bakar Bumbu Rujak') then
    update public.menu set harga = 45000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/nila-bakar-bumbu-rujak.jpg', aktif = true where nama = 'Nila Bakar Bumbu Rujak';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Nila Bakar Bumbu Rujak', 45000, v_kat_main, '/assets/menu-items/nila-bakar-bumbu-rujak.jpg', true);
  end if;
  -- Ayam Goreng Manis
  if exists (select 1 from public.menu where nama = 'Ayam Goreng Manis') then
    update public.menu set harga = 45000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/ayam-goreng-manis.jpg', aktif = true where nama = 'Ayam Goreng Manis';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Ayam Goreng Manis', 45000, v_kat_main, '/assets/menu-items/ayam-goreng-manis.jpg', true);
  end if;
  -- Ayam Bakar Bumbu Rujak
  if exists (select 1 from public.menu where nama = 'Ayam Bakar Bumbu Rujak') then
    update public.menu set harga = 45000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/ayam-bakar-bumbu-rujak.jpg', aktif = true where nama = 'Ayam Bakar Bumbu Rujak';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Ayam Bakar Bumbu Rujak', 45000, v_kat_main, '/assets/menu-items/ayam-bakar-bumbu-rujak.jpg', true);
  end if;
  -- Crispy Duck Bali/Matah
  if exists (select 1 from public.menu where nama = 'Crispy Duck Bali/Matah') then
    update public.menu set harga = 50000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/crispy-duck-bali-matah.jpg', aktif = true where nama = 'Crispy Duck Bali/Matah';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Crispy Duck Bali/Matah', 50000, v_kat_main, '/assets/menu-items/crispy-duck-bali-matah.jpg', true);
  end if;
  -- Pindang Patin Palembang
  if exists (select 1 from public.menu where nama = 'Pindang Patin Palembang') then
    update public.menu set harga = 48000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/pindang-patin-palembang.jpg', aktif = true where nama = 'Pindang Patin Palembang';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pindang Patin Palembang', 48000, v_kat_main, '/assets/menu-items/pindang-patin-palembang.jpg', true);
  end if;
  -- Pindang Iga Palembang
  if exists (select 1 from public.menu where nama = 'Pindang Iga Palembang') then
    update public.menu set harga = 60000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/pindang-iga-palembang.jpg', aktif = true where nama = 'Pindang Iga Palembang';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pindang Iga Palembang', 60000, v_kat_main, '/assets/menu-items/pindang-iga-palembang.jpg', true);
  end if;
  -- Tekwan
  if exists (select 1 from public.menu where nama = 'Tekwan') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/tekwan.jpg', aktif = true where nama = 'Tekwan';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Tekwan', 35000, v_kat_main, '/assets/menu-items/tekwan.jpg', true);
  end if;
  -- Pempek Palembang
  if exists (select 1 from public.menu where nama = 'Pempek Palembang') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/pempek-palembang.jpg', aktif = true where nama = 'Pempek Palembang';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pempek Palembang', 35000, v_kat_main, '/assets/menu-items/pempek-palembang.jpg', true);
  end if;
  -- Ayam Goreng Kalasan
  if exists (select 1 from public.menu where nama = 'Ayam Goreng Kalasan') then
    update public.menu set harga = 40000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/ayam-goreng-kalasan.jpg', aktif = true where nama = 'Ayam Goreng Kalasan';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Ayam Goreng Kalasan', 40000, v_kat_main, '/assets/menu-items/ayam-goreng-kalasan.jpg', true);
  end if;
  -- Sate Pedas Selera
  if exists (select 1 from public.menu where nama = 'Sate Pedas Selera') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/sate-pedas-selera.jpg', aktif = true where nama = 'Sate Pedas Selera';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Sate Pedas Selera', 35000, v_kat_main, '/assets/menu-items/sate-pedas-selera.jpg', true);
  end if;
  -- Sate Maranggi
  if exists (select 1 from public.menu where nama = 'Sate Maranggi') then
    update public.menu set harga = 48000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/sate-maranggi.jpg', aktif = true where nama = 'Sate Maranggi';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Sate Maranggi', 48000, v_kat_main, '/assets/menu-items/sate-maranggi.jpg', true);
  end if;
  -- Rice Bowl Ayam
  if exists (select 1 from public.menu where nama = 'Rice Bowl Ayam') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/rice-bowl-ayam.jpg', aktif = true where nama = 'Rice Bowl Ayam';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Rice Bowl Ayam', 35000, v_kat_main, '/assets/menu-items/rice-bowl-ayam.jpg', true);
  end if;
  -- Rice Bowl Taichan Ayam
  if exists (select 1 from public.menu where nama = 'Rice Bowl Taichan Ayam') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/rice-bowl-taichan-ayam.jpg', aktif = true where nama = 'Rice Bowl Taichan Ayam';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Rice Bowl Taichan Ayam', 35000, v_kat_main, '/assets/menu-items/rice-bowl-taichan-ayam.jpg', true);
  end if;
  -- Rice Bowl Dori
  if exists (select 1 from public.menu where nama = 'Rice Bowl Dori') then
    update public.menu set harga = 35000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/rice-bowl-dori.jpg', aktif = true where nama = 'Rice Bowl Dori';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Rice Bowl Dori', 35000, v_kat_main, '/assets/menu-items/rice-bowl-dori.jpg', true);
  end if;
  -- Rice Bowl Beef
  if exists (select 1 from public.menu where nama = 'Rice Bowl Beef') then
    update public.menu set harga = 38000, kategori_id = v_kat_main, gambar_url = '/assets/menu-items/rice-bowl-beef.jpg', aktif = true where nama = 'Rice Bowl Beef';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Rice Bowl Beef', 38000, v_kat_main, '/assets/menu-items/rice-bowl-beef.jpg', true);
  end if;
  -- Butter Croissant
  if exists (select 1 from public.menu where nama = 'Butter Croissant') then
    update public.menu set harga = 28000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/butter-croissant.jpg', aktif = true where nama = 'Butter Croissant';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Butter Croissant', 28000, v_kat_pastry, '/assets/menu-items/butter-croissant.jpg', true);
  end if;
  -- Pain au Choco
  if exists (select 1 from public.menu where nama = 'Pain au Choco') then
    update public.menu set harga = 35000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/pain-au-choco.jpg', aktif = true where nama = 'Pain au Choco';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pain au Choco', 35000, v_kat_pastry, '/assets/menu-items/pain-au-choco.jpg', true);
  end if;
  -- Crombolini Choco Sprinkles
  if exists (select 1 from public.menu where nama = 'Crombolini Choco Sprinkles') then
    update public.menu set harga = 30000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/crombolini-choco-sprinkles.jpg', aktif = true where nama = 'Crombolini Choco Sprinkles';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Crombolini Choco Sprinkles', 30000, v_kat_pastry, '/assets/menu-items/crombolini-choco-sprinkles.jpg', true);
  end if;
  -- Pain Suisse
  if exists (select 1 from public.menu where nama = 'Pain Suisse') then
    update public.menu set harga = 32000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/pain-suisse.jpg', aktif = true where nama = 'Pain Suisse';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pain Suisse', 32000, v_kat_pastry, '/assets/menu-items/pain-suisse.jpg', true);
  end if;
  -- Cookies Red Velvet
  if exists (select 1 from public.menu where nama = 'Cookies Red Velvet') then
    update public.menu set harga = 20000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/cookies-red-velvet.jpg', aktif = true where nama = 'Cookies Red Velvet';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cookies Red Velvet', 20000, v_kat_pastry, '/assets/menu-items/cookies-red-velvet.jpg', true);
  end if;
  -- Cookies Original
  if exists (select 1 from public.menu where nama = 'Cookies Original') then
    update public.menu set harga = 18000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/cookies-original.jpg', aktif = true where nama = 'Cookies Original';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cookies Original', 18000, v_kat_pastry, '/assets/menu-items/cookies-original.jpg', true);
  end if;
  -- Keju Aroma
  if exists (select 1 from public.menu where nama = 'Keju Aroma') then
    update public.menu set harga = 30000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/keju-aroma.jpg', aktif = true where nama = 'Keju Aroma';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Keju Aroma', 30000, v_kat_pastry, '/assets/menu-items/keju-aroma.jpg', true);
  end if;
  -- Cheesecake
  if exists (select 1 from public.menu where nama = 'Cheesecake') then
    update public.menu set harga = 30000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/cheesecake.jpg', aktif = true where nama = 'Cheesecake';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cheesecake', 30000, v_kat_pastry, '/assets/menu-items/cheesecake.jpg', true);
  end if;
  -- Ice Cream Scoop
  if exists (select 1 from public.menu where nama = 'Ice Cream Scoop') then
    update public.menu set harga = 20000, kategori_id = v_kat_pastry, gambar_url = '/assets/menu-items/ice-cream-scoop.jpg', aktif = true where nama = 'Ice Cream Scoop';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Ice Cream Scoop', 20000, v_kat_pastry, '/assets/menu-items/ice-cream-scoop.jpg', true);
  end if;
  -- Spicy Corn Ribs
  if exists (select 1 from public.menu where nama = 'Spicy Corn Ribs') then
    update public.menu set harga = 25000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/spicy-corn-ribs.jpg', aktif = true where nama = 'Spicy Corn Ribs';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spicy Corn Ribs', 25000, v_kat_starter, '/assets/menu-items/spicy-corn-ribs.jpg', true);
  end if;
  -- Mix Platter
  if exists (select 1 from public.menu where nama = 'Mix Platter') then
    update public.menu set harga = 35000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/mix-platter.jpg', aktif = true where nama = 'Mix Platter';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Mix Platter', 35000, v_kat_starter, '/assets/menu-items/mix-platter.jpg', true);
  end if;
  -- Tahu Cabe Garam
  if exists (select 1 from public.menu where nama = 'Tahu Cabe Garam') then
    update public.menu set harga = 30000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/tahu-cabe-garam.jpg', aktif = true where nama = 'Tahu Cabe Garam';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Tahu Cabe Garam', 30000, v_kat_starter, '/assets/menu-items/tahu-cabe-garam.jpg', true);
  end if;
  -- Pisang Goreng
  if exists (select 1 from public.menu where nama = 'Pisang Goreng') then
    update public.menu set harga = 30000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/pisang-goreng.jpg', aktif = true where nama = 'Pisang Goreng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Pisang Goreng', 30000, v_kat_starter, '/assets/menu-items/pisang-goreng.jpg', true);
  end if;
  -- Singkong Goreng
  if exists (select 1 from public.menu where nama = 'Singkong Goreng') then
    update public.menu set harga = 30000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/singkong-goreng.jpg', aktif = true where nama = 'Singkong Goreng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Singkong Goreng', 30000, v_kat_starter, '/assets/menu-items/singkong-goreng.jpg', true);
  end if;
  -- Spicy Wings
  if exists (select 1 from public.menu where nama = 'Spicy Wings') then
    update public.menu set harga = 30000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/spicy-wings.jpg', aktif = true where nama = 'Spicy Wings';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spicy Wings', 30000, v_kat_starter, '/assets/menu-items/spicy-wings.jpg', true);
  end if;
  -- Cireng
  if exists (select 1 from public.menu where nama = 'Cireng') then
    update public.menu set harga = 25000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/cireng.jpg', aktif = true where nama = 'Cireng';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Cireng', 25000, v_kat_starter, '/assets/menu-items/cireng.jpg', true);
  end if;
  -- Tahu Walik
  if exists (select 1 from public.menu where nama = 'Tahu Walik') then
    update public.menu set harga = 25000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/tahu-walik.jpg', aktif = true where nama = 'Tahu Walik';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Tahu Walik', 25000, v_kat_starter, '/assets/menu-items/tahu-walik.jpg', true);
  end if;
  -- French Fries
  if exists (select 1 from public.menu where nama = 'French Fries') then
    update public.menu set harga = 25000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/french-fries.jpg', aktif = true where nama = 'French Fries';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('French Fries', 25000, v_kat_starter, '/assets/menu-items/french-fries.jpg', true);
  end if;
  -- Spaghetti Bolognese
  if exists (select 1 from public.menu where nama = 'Spaghetti Bolognese') then
    update public.menu set harga = 38000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/spaghetti-bolognese.jpg', aktif = true where nama = 'Spaghetti Bolognese';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spaghetti Bolognese', 38000, v_kat_starter, '/assets/menu-items/spaghetti-bolognese.jpg', true);
  end if;
  -- Spaghetti Carbonara
  if exists (select 1 from public.menu where nama = 'Spaghetti Carbonara') then
    update public.menu set harga = 38000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/spaghetti-carbonara.jpg', aktif = true where nama = 'Spaghetti Carbonara';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spaghetti Carbonara', 38000, v_kat_starter, '/assets/menu-items/spaghetti-carbonara.jpg', true);
  end if;
  -- Spaghetti Aglio e Olio
  if exists (select 1 from public.menu where nama = 'Spaghetti Aglio e Olio') then
    update public.menu set harga = 40000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/spaghetti-aglio-e-olio.jpg', aktif = true where nama = 'Spaghetti Aglio e Olio';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Spaghetti Aglio e Olio', 40000, v_kat_starter, '/assets/menu-items/spaghetti-aglio-e-olio.jpg', true);
  end if;
  -- Dimsum Original
  if exists (select 1 from public.menu where nama = 'Dimsum Original') then
    update public.menu set harga = 30000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/dimsum-original.jpg', aktif = true where nama = 'Dimsum Original';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Dimsum Original', 30000, v_kat_starter, '/assets/menu-items/dimsum-original.jpg', true);
  end if;
  -- Dimsum Mentai
  if exists (select 1 from public.menu where nama = 'Dimsum Mentai') then
    update public.menu set harga = 35000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/dimsum-mentai.jpg', aktif = true where nama = 'Dimsum Mentai';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Dimsum Mentai', 35000, v_kat_starter, '/assets/menu-items/dimsum-mentai.jpg', true);
  end if;
  -- Dimsum Mozzarella
  if exists (select 1 from public.menu where nama = 'Dimsum Mozzarella') then
    update public.menu set harga = 35000, kategori_id = v_kat_starter, gambar_url = '/assets/menu-items/dimsum-mozzarella.jpg', aktif = true where nama = 'Dimsum Mozzarella';
  else
    insert into public.menu (nama, harga, kategori_id, gambar_url, aktif) values ('Dimsum Mozzarella', 35000, v_kat_starter, '/assets/menu-items/dimsum-mozzarella.jpg', true);
  end if;

-- 3. NONAKTIFKAN MENU DUMMY LAMA YANG TIDAK ADA DI KATALOG BARU
  update public.menu set aktif = false where nama not in ('Espresso', 'Americano', 'Cafe Latte', 'Cappuccino', 'Magic', 'Manual Brew (Lokal)', 'Manual Brew (Seasonal)', 'Montblanc', 'Black Lemonade', 'Black Orange', 'Affogato', 'Crème Brûlée', 'Butterscotch', 'Gula Aren', 'Spanish Latte OG', 'Spanish Latte Pistachio', 'Matcha Original', 'Matcha Crème Brûlée', 'Dirty Matcha', 'Strawberry Matcha', 'Matcha Pistachio', 'Matcha Cheese', 'Summer', 'Cosmopolitan', 'Summer Flamingo', 'Shining Yellow', 'Beach Please', 'Velvet Hibiscus', 'Chocolate', 'Chocolate Mint', 'Chocolate Pistachio', 'Taro Latte', 'Taro Cheese', 'Easy Peachy', 'Le Lact', 'Sakura Bloom', 'Strawberry Tea', 'Mango Tea', 'Peach Tea', 'Lemon Tea', 'Jasmine Tea', 'Lychee Tea', 'Soursop Mango', 'Grapes Apple Berry', 'Lychee Berry', 'Orange Peach', 'Iga Bakar', 'Sop Buntut', 'Kwetiau Goreng', 'Mie Goreng', 'Nasi Goreng', 'Pecak Nila', 'Nila Bakar Bumbu Rujak', 'Ayam Goreng Manis', 'Ayam Bakar Bumbu Rujak', 'Crispy Duck Bali/Matah', 'Pindang Patin Palembang', 'Pindang Iga Palembang', 'Tekwan', 'Pempek Palembang', 'Ayam Goreng Kalasan', 'Sate Pedas Selera', 'Sate Maranggi', 'Rice Bowl Ayam', 'Rice Bowl Taichan Ayam', 'Rice Bowl Dori', 'Rice Bowl Beef', 'Butter Croissant', 'Pain au Choco', 'Crombolini Choco Sprinkles', 'Pain Suisse', 'Cookies Red Velvet', 'Cookies Original', 'Keju Aroma', 'Cheesecake', 'Ice Cream Scoop', 'Spicy Corn Ribs', 'Mix Platter', 'Tahu Cabe Garam', 'Pisang Goreng', 'Singkong Goreng', 'Spicy Wings', 'Cireng', 'Tahu Walik', 'French Fries', 'Spaghetti Bolognese', 'Spaghetti Carbonara', 'Spaghetti Aglio e Olio', 'Dimsum Original', 'Dimsum Mentai', 'Dimsum Mozzarella');
end $$;
