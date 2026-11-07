import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adaKunciAdmin, getKlienAdmin } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES_STAFF = new Set(["admin", "manager", "kasir"]);

/**
 * Saldo asli menurut ledger.
 *
 * `pelanggan.poin` cuma cache. Kalau patch SQL `tukar_poin` belum
 * terpasang di sebuah environment, cache-nya tidak ikut turun dan UI
 * menampilkan saldo lama. Jadi angka yang dikembalikan ke klien selalu
 * diambil dari ledger, lalu cache-nya diperbaiki.
 */
async function saldoLedger(
  admin: ReturnType<typeof getKlienAdmin>,
  pelangganId: string,
): Promise<number | null> {
  const { data, error } = await admin.rpc("saldo_poin", { p_pelanggan_id: pelangganId });
  if (error) {
    console.error("[redeem poin] saldo_poin gagal", error.code, error.message);
    return null;
  }
  const angka = typeof data === "number" ? data : Number(data);
  return Number.isFinite(angka) ? angka : null;
}

export async function POST(request: Request) {
  const sesi = await createClient();
  const { data: { user } } = await sesi.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi login habis. Masuk ulang dulu." }, { status: 401 });
  }
  if (!adaKunciAdmin()) {
    return NextResponse.json({ error: "Fitur tukar poin belum aktif di server." }, { status: 503 });
  }

  const admin = getKlienAdmin();
  const { data: profil, error: errorProfil } = await admin
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (errorProfil || !profil || !ROLES_STAFF.has(String(profil.role))) {
    return NextResponse.json({ error: "Akun ini tidak berwenang menukar poin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Data penukaran tidak valid." }, { status: 400 });
  }

  const { pelanggan_id, poin } = body as Record<string, unknown>;
  if (typeof pelanggan_id !== "string" || !UUID.test(pelanggan_id)) {
    return NextResponse.json({ error: "Pelanggan tidak valid." }, { status: 400 });
  }
  if (typeof poin !== "number" || !Number.isSafeInteger(poin) || poin < 5) {
    return NextResponse.json({ error: "Minimal penukaran adalah 5 poin." }, { status: 400 });
  }

  const saldoSebelum = await saldoLedger(admin, pelanggan_id);

  const { data: hasil, error } = await admin.rpc("tukar_poin", {
    p_pelanggan_id: pelanggan_id,
    p_poin: poin,
    p_transaksi_id: null,
  });
  if (error) {
    const pesan = error.message.toLowerCase().includes("poin tidak cukup")
      ? "Poin pelanggan tidak cukup. Muat ulang saldo lalu coba lagi."
      : "Penukaran poin gagal diproses.";
    console.error("[redeem poin]", error.code, error.message);
    return NextResponse.json({ error: pesan }, { status: 400 });
  }

  const saldoSesudah = (await saldoLedger(admin, pelanggan_id)) ?? saldoSebelum;

  // Cache boleh basi, ledger tidak. Samakan cache dengan ledger supaya
  // daftar pelanggan dan panel detail ikut menampilkan angka yang benar.
  if (saldoSesudah !== null) {
    const { error: errorCache } = await admin
      .from("pelanggan")
      .update({ poin: saldoSesudah })
      .eq("id", pelanggan_id);
    if (errorCache) {
      console.error("[redeem poin] gagal menyamakan cache saldo", errorCache.message);
    }
  }

  return NextResponse.json({
    ok: true,
    poin_ditukar: typeof hasil === "number" ? hasil : poin,
    saldo_sebelum: saldoSebelum,
    saldo_poin: saldoSesudah,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";