// ============================================================
// Route API Log Transaksi, Kataloji CRM
// ============================================================
// GET /api/log-transaksi
//   Daftar seluruh transaksi (log), paling baru di depan, dengan join
//   nama pelanggan. Opsi filter via query string:
//     cari    - teks bebas: nomor struk, kode & nama pelanggan Majoo,
//               atau nama pelanggan CRM
//     source  - crm_manual | majoo_import | majoo_parallel | csv_import
//     status  - status_pencocokan: terhubung | menunggu_pencocokan | anonim
//     dari    - batas bawah tanggal_majoo (YYYY-MM-DD)
//     sampai  - batas atas tanggal_majoo (YYYY-MM-DD)
//
// GET /api/log-transaksi?detail=<transaksi_id>
//   Detail satu transaksi + jejak poinnya di buku poin (point_ledger).
//
// Hanya admin (dijaga wajibAdmin). Filter diterapkan langsung pada query
// berhalaman: PostgREST menjalankan klausa WHERE sebelum range(), sehingga
// urutan created_at tetap stabil untuk setiap halaman ambilSemua.
// ============================================================

import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/supabase/izin-admin";
import { getKlienAdmin } from "@/lib/supabase/admin";
import { ambilSemua } from "@/lib/supabase/ambil-semua";

const SUMBER_VALID = [
  "crm_manual",
  "majoo_import",
  "majoo_parallel",
  "csv_import",
] as const;

const STATUS_VALID = [
  "terhubung",
  "menunggu_pencocokan",
  "anonim",
] as const;

/** Tanggal filter: harusYYYY-MM-DD yang benar, atau kosong (tanpa filter). */
function tanggalValid(iso: string | null | undefined): boolean {
  if (!iso) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso));
}

type BarisTransaksiLog = {
  id: string;
  pelanggan_id: string | null;
  total: number;
  diskon: number;
  poin_dipakai: number;
  poin_didapat: number;
  items: unknown[];
  external_ref: string | null;
  created_at: string;
  source: string | null;
  dicatat_oleh: string | null;
  dicatat_oleh_nama: string | null;
  dicatat_pada: string | null;
  metode_bayar: string | null;
  kode_pelanggan_majoo: string | null;
  nama_pelanggan_majoo: string | null;
  status_pencocokan: string | null;
  tanggal_majoo: string | null;
  pelanggan: {
    nama: string;
    whatsapp: string;
    kode_majoo: string | null;
    poin: number;
  } | null;
};

export async function GET(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  const param = new URL(request.url).searchParams;
  const detailId = param.get("detail");

  // ---------- Rincian satu transaksi + buku poinnya ----------
  if (detailId) {
    const admin = getKlienAdmin();

    const { data: transaksi, error } = await admin
      .from("transaksi")
      .select("*, pelanggan(id, nama, whatsapp, poin, kode_majoo)")
      .eq("id", detailId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Gagal memuat transaksi." }, { status: 500 });
    }
    if (!transaksi) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    }

    const { data: ledger, error: eLedger } = await admin
      .from("point_ledger")
      .select("*")
      .eq("transaksi_id", detailId)
      .order("created_at", { ascending: true });

    if (eLedger) {
      return NextResponse.json({ error: "Gagal memuat buku poin transaksi ini." }, { status: 500 });
    }

    return NextResponse.json({
      transaksi,
      ledger: ledger ?? [],
    });
  }

  // ---------- Daftar log dengan filter ----------
  const cari = (param.get("cari") ?? "").trim();
  const source = param.get("source") ?? "";
  const status = param.get("status") ?? "";
  const dari = param.get("dari") ?? "";
  const sampai = param.get("sampai") ?? "";

  if (
    source &&
    !SUMBER_VALID.includes(source as (typeof SUMBER_VALID)[number])
  ) {
    return NextResponse.json({ error: "Filter source tidak dikenali." }, { status: 400 });
  }
  if (
    status &&
    !STATUS_VALID.includes(status as (typeof STATUS_VALID)[number])
  ) {
    return NextResponse.json({ error: "Filter status tidak dikenali." }, { status: 400 });
  }
  if (!tanggalValid(dari) || !tanggalValid(sampai)) {
    return NextResponse.json(
      { error: "Filter tanggal tidak valid (format YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  const admin = getKlienAdmin();

  // Filter sumber/status/tanggal dijalankan PostgREST; filter teks bebas
  // diterapkan di sisi server. Satu klausa .or() PostgREST tidak bisa
  // mencampur kolom tabel utama dan kolom tabel join (pelanggan.nama),
  // sehingga pencarian bebas dipindah ke penapisan lokal atas hasil
  // ambilSemua agar lintas tabel tetap bisa dicocokkan.
  const { data, error, terpotong } = await ambilSemua<BarisTransaksiLog>(
    (batasDari, batasSampai) => {
      let q = admin
        .from("transaksi")
        .select("*, pelanggan(nama, whatsapp, kode_majoo, poin)")
        .order("created_at", { ascending: false })
        .range(batasDari, batasSampai);

      if (source) q = q.eq("source", source);
      if (status) q = q.eq("status_pencocokan", status);
      if (dari) q = q.gte("tanggal_majoo", dari);
      if (sampai) q = q.lte("tanggal_majoo", sampai);

      return q;
    },
  );

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  let hasil = data;
  if (cari) {
    const k = cari.toLowerCase();
    hasil = hasil.filter((t) =>
      [
        t.external_ref,
        t.kode_pelanggan_majoo,
        t.nama_pelanggan_majoo,
        t.pelanggan?.nama,
      ].some((nilai) => nilai && nilai.toLowerCase().includes(k)),
    );
  }

  return NextResponse.json({
    transaksi: hasil,
    total: hasil.length,
    terpotong,
  });
}
