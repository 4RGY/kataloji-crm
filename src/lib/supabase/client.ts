import { createBrowserClient } from "@supabase/ssr";

/**
 * Klien Supabase untuk komponen klien ("use client").
 *
 * Sengaja singleton (satu instance dipakai bersama), bukan factory yang
 * membuat klien baru setiap pemanggilan. Alasannya: semua halaman
 * memanggilnya di dalam komponen, dan hasilnya dipakai sebagai
 * dependency `useCallback`/`useEffect`.
 *
 * Klien baru = objek baru = dependency berubah = effect jalan lagi =
 * data diambil lagi tanpa henti. Gejalanya: daftar pelanggan dan
 * transaksi tampak berkedip terus, dan klik tombol kadang tidak
 * merespons karena React sibuk me-render ulang.
 *
 * Mengembalikan tipe yang sama seperti sebelumnya, jadi semua pemanggil
 * `createClient()` tetap bekerja tanpa diubah.
 */
let klien: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!klien) {
    klien = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return klien;
}
