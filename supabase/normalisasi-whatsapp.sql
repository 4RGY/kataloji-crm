-- ============================================================
-- Fungsi normalisasi_whatsapp
-- ============================================================
-- Merapikan nomor WhatsApp menjadi bentuk kanonik:
--   - hanya angka yang dipertahankan
--   - nomor Indonesia dinormalkan ke awalan 62
--
-- Fungsi ini dipakai oleh constraint `pelanggan_whatsapp_isi`
-- (lihat perbaikan-batas-wa.sql) dan oleh `pelanggan_whatsapp_unik`.
--
-- Sebelumnya fungsi ini hanya ada di database live (dibuat manual
-- lewat SQL Editor) dan tidak tercatat di repo. Berkas ini adalah
-- salinan resmi definisinya, diambil dari database pada 2026-09-24.
--
-- Aman dijalankan berulang kali (CREATE OR REPLACE).
-- ============================================================

create or replace function public.normalisasi_whatsapp(no text)
returns text
language plpgsql
immutable
as $function$
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
$function$;
