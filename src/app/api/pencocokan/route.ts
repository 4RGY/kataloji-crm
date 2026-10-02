// ============================================================
// Route API Pencocokan Majoo, Kataloji CRM
// ============================================================
// GET  /api/pencocokan
//   Kembalikan daftar transaksi Majoo yang masih menunggu
//   pencocokan pelanggan (status_pencocokan = 'menunggu_pencocokan'),
//   plus daftar pelanggan yang berpotensi cocok (berdasarkan
//   nama/kode Majoo) untuk memudahkan admin memilih.
//
// POST /api/pencocokan
//   Body: { transaksi_id: string, pelanggan_id: string }
//   Hubungkan transaksi ke pelanggan. Trigger database
//   (trg_transaksi_pencocokan) akan menghitung dan menerbitkan
//   poin sesuai aturan periode, lalu menandai terhubung.
//   Hanya admin (dijaga wajibAdmin).
// ============================================================

import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/supabase/izin-admin";
import { getKlienAdmin } from "@/lib/supabase/admin";
import { ambilSemua } from "@/lib/supabase/ambil-semua";

type BarisPending = {
  id: string;
  external_ref: string | null;
  total: number;
  tanggal_majoo: string | null;
  kode_pelanggan_majoo: string | null;
  nama_pelanggan_majoo: string | null;
  metode_bayar: string | null;
  created_at: string;
};

type BarisPelangganKandidat = {
  id: string;
  nama: string;
  whatsapp: string;
  kode_majoo: string | null;
  poin: number;
};

export async function GET() {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  const admin = getKlienAdmin();

  const [pendek, pelanggan] = await Promise.all([
    ambilSemua<BarisPending>((dari, sampai) =>
      admin
        .from("transaksi")
        .select(
          "id, external_ref, total, tanggal_majoo, kode_pelanggan_majoo, nama_pelanggan_majoo, metode_bayar, created_at",
        )
        .eq("status_pencocokan", "menunggu_pencocokan")
        .order("created_at", { ascending: false })
        .range(dari, sampai),
    ),
    ambilSemua<BarisPelangganKandidat>((dari, sampai) =>
      admin
        .from("pelanggan")
        .select("id, nama, whatsapp, kode_majoo, poin")
        .order("nama", { ascending: true })
        .range(dari, sampai),
    ),
  ]);

  if (pendek.error) {
    return NextResponse.json(
      { error: "Gagal memuat transaksi menunggu." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    menunggu: pendek.data ?? [],
    pelanggan: pelanggan.error ? [] : (pelanggan.data ?? []),
  });
}

export async function POST(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  let body: { transaksi_id?: string; pelanggan_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON valid." }, { status: 400 });
  }

  const { transaksi_id, pelanggan_id } = body;
  if (!transaksi_id || !pelanggan_id) {
    return NextResponse.json(
      { error: "transaksi_id dan pelanggan_id wajib diisi." },
      { status: 400 },
    );
  }

  const admin = getKlienAdmin();

  // Pastikan transaksinya masih menunggu (bukan sudah tertaut / anonim).
  const { data: trx } = await admin
    .from("transaksi")
    .select("id, external_ref, status_pencocokan, total, kode_pelanggan_majoo, nama_pelanggan_majoo")
    .eq("id", transaksi_id)
    .maybeSingle();

  if (!trx) {
    return NextResponse.json(
      { error: "Transaksi tidak ditemukan." },
      { status: 404 },
    );
  }
  if (trx.status_pencocokan === "terhubung") {
    return NextResponse.json(
      { error: "Transaksi sudah tertaut ke pelanggan lain." },
      { status: 409 },
    );
  }

  const { data: pel } = await admin
    .from("pelanggan")
    .select("id, nama")
    .eq("id", pelanggan_id)
    .maybeSingle();

  if (!pel) {
    return NextResponse.json(
      { error: "Pelanggan tidak ditemukan." },
      { status: 404 },
    );
  }

  // Set pelanggan_id. Trigger trg_transaksi_pencocokan (AFTER UPDATE)
  // otomatis menghitung poin, menerbitkan ke ledger, dan menandai
  // terhubung. Jangan hitung ulang di aplikasi: satu sumber kebenaran.
  const { error } = await admin
    .from("transaksi")
    .update({ pelanggan_id, status_pencocokan: "terhubung" })
    .eq("id", transaksi_id);

  if (error) {
    return NextResponse.json(
      { error: "Gagal menghubungkan transaksi ke pelanggan." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    pelanggan: pel.nama,
    transaksi: trx.external_ref,
  });
}
