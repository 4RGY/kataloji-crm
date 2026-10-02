// ============================================================
// Route API Impor Majoo, Kataloji CRM
// ============================================================
// Hanya admin yang boleh mengimpor data. Route ini menangani dua tahap:
//
//   1. POST mode=preview : baca file ekspor Majoo, kembalikan hasil parsing
//      (baris pelanggan & transaksi) UNTUK DITINJAU, tanpa menulis apa pun.
//   2. POST mode=apply   : baca ulang file yang sama, lalu tulis ke database
//      secara idempoten. Mengimpor file yang sama dua kali tidak menggandakan
//      data (dedup via pelanggan.kode_majoo & transaksi.external_ref).
//
// File dibaca di server (library xlsx tidak dikirim ke peramban), sehingga
// payload yang bolak-balik hanyalah hasil parsing berupa JSON, bukan baris
// spreadsheet mentah.
// ============================================================

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { wajibAdmin } from "@/lib/supabase/izin-admin";
import { getKlienAdmin } from "@/lib/supabase/admin";
import { parseMajoo } from "@/lib/impor-majoo";
import { tulisImporMajoo } from "@/lib/tulis-impor-majoo";

/** Ukuran maksimum file (10 MB), cukup untuk ekspor harian Majoo. */
const MAKS_BYTE = 10 * 1024 * 1024;

/**
 * Baca ArrayBuffer file menjadi array baris 2D (sheet pertama), bentuk yang
 * dimengerti `parseMajoo()`. Memakai nilai sel sebagai teks (`raw:false`)
 * supaya tanggal/angka terbaca persis seperti tampil di Excel, bukan sebagai
 * angka serial.
 */
function bacaBaris(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const namaSheet = wb.SheetNames[0];
  const ws = wb.Sheets[namaSheet];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];
}

/** Ambil berkas dari body multipart, kembali ke null bila tidak ada. */
async function ambilBerkas(request: Request): Promise<File | null> {
  const form = await request.formData();
  const berkas = form.get("file");
  if (!(berkas instanceof File)) return null;
  return berkas;
}

export async function POST(request: Request) {
  const izin = await wajibAdmin();
  if (!izin.ok) return izin.respons;

  const mode = new URL(request.url).searchParams.get("mode") ?? "";
  if (mode !== "preview" && mode !== "apply") {
    return NextResponse.json(
      { error: "Parameter mode harus 'preview' atau 'apply'." },
      { status: 400 },
    );
  }

  const berkas = await ambilBerkas(request);
  if (!berkas) {
    return NextResponse.json(
      { error: "Berkas tidak ditemukan. Pilih file ekspor Majoo (.xlsx/.xls/.csv)." },
      { status: 400 },
    );
  }
  if (berkas.size > MAKS_BYTE) {
    return NextResponse.json(
      { error: "Ukuran file melebihi 10 MB." },
      { status: 413 },
    );
  }

  let baris: unknown[][];
  try {
    baris = bacaBaris(await berkas.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "File tidak bisa dibaca. Pastikan formatnya .xlsx/.xls/.csv dari Majoo." },
      { status: 400 },
    );
  }

  const hasil = parseMajoo(baris);

  if (hasil.pelanggan.length === 0 && hasil.transaksi.length === 0) {
    return NextResponse.json(
      {
        error:
          "Tidak ada data yang dikenali. Pastikan file berisi ekspor Data Pelanggan " +
          "atau Detail Penjualan dari Majoo (bukan PDF/laporan).",
      },
      { status: 400 },
    );
  }

  // ---------- Tahap tinjau (preview) ----------
  if (mode === "preview") {
    return NextResponse.json({
      jumlah: {
        pelanggan: hasil.pelanggan.length,
        transaksi: hasil.transaksi.length,
        dilewati: hasil.dilewati.length,
      },
      pelanggan: hasil.pelanggan,
      transaksi: hasil.transaksi,
      dilewati: hasil.dilewati,
    });
  }

  // ---------- Tahap tulis (apply) ----------
  const admin = getKlienAdmin();
  const ringkasan = await tulisImporMajoo(
    admin,
    hasil.pelanggan,
    hasil.transaksi,
  );

  return NextResponse.json({ ringkasan });
}
