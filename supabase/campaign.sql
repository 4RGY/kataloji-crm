-- ============================================================
-- CAMPAIGN: catatan siapa yang sudah dihubungi
--
-- Kataloji tidak memakai WhatsApp Business API, jadi pengiriman dilakukan
-- kasir lewat tautan wa.me satu per satu. Tabel ini TIDAK mengirim apa pun.
-- Tugasnya satu: mencatat bahwa seorang pelanggan sudah dihubungi, supaya
-- tidak dikirimi pesan yang sama dua kali oleh kasir yang berbeda.
--
-- Mengapa pesannya ikut disimpan, bukan hanya penandanya:
-- kalau pelanggan bertanya "kemarin saya dikirimi apa", jawabannya harus
-- ada. Menyimpan penanda saja membuat pertanyaan itu tidak terjawab.
--
-- Jalankan di SQL editor Supabase setelah rbac.sql.
-- ============================================================

create table if not exists public.campaign_kirim (
  id uuid primary key default gen_random_uuid(),
  pelanggan_id uuid not null references public.pelanggan(id) on delete cascade,
  -- Segmen saat pesan dikirim, misalnya 'hangus' atau 'sepi'. Disimpan apa
  -- adanya dan tidak dijadikan foreign key: daftar segmen adalah aturan
  -- aplikasi yang bisa berubah, sedangkan catatan ini tidak boleh ikut
  -- berubah hanya karena daftarnya diperbarui.
  segmen text not null,
  pesan text not null,
  dikirim_oleh uuid not null references public.profile(id),
  dikirim_pada timestamptz not null default now()
);

-- Pertanyaan tersering: "siapa saja yang sudah dikirimi pada segmen ini".
create index if not exists idx_campaign_kirim_segmen
  on public.campaign_kirim (segmen, dikirim_pada desc);

create index if not exists idx_campaign_kirim_pelanggan
  on public.campaign_kirim (pelanggan_id, dikirim_pada desc);

alter table public.campaign_kirim enable row level security;

-- ---------- Siapa boleh apa ----------
-- Semua staf boleh membaca: kasir perlu tahu pelanggan di depannya sudah
-- dihubungi atau belum sebelum menekan kirim.
drop policy if exists "campaign baca" on public.campaign_kirim;
create policy "campaign baca"
  on public.campaign_kirim
  for select
  using (public.staff_role() in ('admin','manager','kasir'));

-- Mencatat pengiriman hanya boleh atas nama diri sendiri. Tanpa syarat
-- dikirim_oleh = auth.uid(), seorang kasir bisa mencatat seolah-olah orang
-- lain yang mengirim, dan catatannya berhenti bisa dipercaya.
drop policy if exists "campaign catat" on public.campaign_kirim;
create policy "campaign catat"
  on public.campaign_kirim
  for insert
  with check (
    public.staff_role() in ('admin','manager','kasir')
    and dikirim_oleh = auth.uid()
  );

-- Catatan pengiriman TIDAK BOLEH diubah atau dihapus oleh siapa pun,
-- termasuk admin. Sengaja tidak dibuatkan policy update maupun delete:
-- tanpa policy, RLS menolak keduanya. Ini mengikuti aturan yang sama
-- dengan jejak poin, yaitu bukti tidak boleh bisa dirapikan belakangan.

-- ---------- Bukti bahwa penguncian benar-benar berlaku ----------
-- Jalankan sebagai kasir, keduanya harus mengubah 0 baris:
--   update public.campaign_kirim set pesan = 'diubah';
--   delete from public.campaign_kirim;
