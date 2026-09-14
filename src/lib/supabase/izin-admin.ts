import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaKunciAdmin, getKlienAdmin } from "@/lib/supabase/admin";

/**
 * Memastikan permintaan datang dari admin yang sedang login.
 *
 * Dipakai bersama oleh route handler /api/staf. Mengembalikan salah satu
 * dari dua bentuk:
 *   { ok: true, id }                    -> boleh lanjut
 *   { ok: false, respons }              -> kirim respons ini apa adanya
 *
 * Peran dibaca memakai kunci service role, bukan klien biasa, supaya
 * pemeriksaan ini tidak bergantung pada policy RLS. Kalau pemeriksaan
 * izin ikut tunduk pada RLS, sebuah kesalahan policy bisa membuat
 * pemeriksaan lolos atau justru menolak admin yang sah.
 */
export type HasilIzin =
  | { ok: true; id: string; nama: string }
  | { ok: false; respons: NextResponse };

export async function wajibAdmin(): Promise<HasilIzin> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      respons: NextResponse.json(
        { error: "Anda belum masuk. Silakan masuk ulang." },
        { status: 401 },
      ),
    };
  }

  if (!adaKunciAdmin()) {
    return {
      ok: false,
      respons: NextResponse.json(
        {
          error:
            "Fitur kelola staf belum aktif karena kunci service role belum diisi di server. " +
            "Hubungi pengembang untuk melengkapinya.",
        },
        { status: 503 },
      ),
    };
  }

  const admin = getKlienAdmin();
  const { data: profil } = await admin
    .from("profile")
    .select("role, nama")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil) {
    return {
      ok: false,
      respons: NextResponse.json(
        {
          error:
            "Akun Anda belum memiliki data staf, jadi perannya belum dikenali. " +
            "Minta admin menjalankan berkas backfill-profile.sql di Supabase.",
        },
        { status: 403 },
      ),
    };
  }

  if (profil.role !== "admin") {
    return {
      ok: false,
      respons: NextResponse.json(
        { error: "Hanya admin yang boleh mengelola akun staf." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    id: user.id,
    nama: (profil.nama as string | null) ?? user.email ?? "Admin",
  };
}
