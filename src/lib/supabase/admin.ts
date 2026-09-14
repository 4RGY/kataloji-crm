import {
  createClient as buatKlienSupabase,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Klien Supabase dengan kunci service role.
 *
 * Dipakai HANYA di server (route handler), tidak pernah di komponen klien.
 * Kunci ini menembus RLS, jadi satu-satunya hal yang membuatnya aman
 * adalah bahwa dia tidak pernah dikirim ke peramban. Karena itu variabel
 * lingkungannya sengaja TANPA awalan NEXT_PUBLIC_.
 *
 * Kenapa perlu kunci ini: membuat akun staf berarti membuat user di
 * Supabase Auth, dan operasi itu hanya boleh dilakukan dengan kunci
 * service role. Kunci anon tidak punya izin tersebut.
 *
 * Dibuat malas (lazy) dan singleton, dengan alasan yang sama seperti
 * `src/lib/supabase/client.ts`: modul ini ikut dievaluasi saat build,
 * dan `createClient()` tanpa alamat yang valid akan menggagalkan build.
 */
/**
 * Tipe kliennya ditulis eksplisit sebagai `SupabaseClient` (tanpa parameter
 * tipe generik). Kalau dibiarkan memakai `ReturnType<typeof createClient>`,
 * TypeScript memilih kelebihan (overload) yang tidak cocok sehingga hasil
 * `.from(...)` bertipe `never` dan seluruh kolom dianggap tidak ada.
 * Anotasi eksplisit membuat kolom dikembalikan sebagai `any`, cukup untuk
 * proyek ini yang belum memakai tipe Database hasil generate.
 */
let klien: SupabaseClient | undefined;

export function adaKunciAdmin(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && kunci && kunci.trim().length > 20);
}

export function getKlienAdmin() {
  if (!adaKunciAdmin()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local. " +
        "Tambahkan kunci service role dari Supabase Dashboard > Project Settings > API, " +
        "lalu jalankan ulang server.",
    );
  }

  if (!klien) {
    klien = buatKlienSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          // Route handler tidak menyimpan sesi; tiap permintaan berdiri sendiri.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return klien;
}
