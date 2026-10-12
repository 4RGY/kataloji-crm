// ============================================================
// Hitungan laporan penjualan, Kataloji CRM
// ============================================================
// Semua angka laporan dihitung di sini, bukan di dalam komponen, supaya bisa
// diuji tanpa browser dan supaya rumusnya cuma ada di satu tempat.
//
// Rumus omzet WAJIB sama dengan Dashboard dan Analitik: total dikurangi
// diskon dan potongan poin. Sebelumnya halaman laporan penjualan hanya
// mengurangi diskon, sehingga begitu kasir mulai menerima pembayaran pakai
// poin, laporan ini akan menyebut angka lebih besar daripada dashboard.
// Dua angka resmi yang berbeda untuk hal yang sama selalu berakhir salah
// dipercaya salah satunya.
// ============================================================

import { nilaiBersih } from "@/lib/analitik";
import { kunciHariLaporanAtauNull } from "@/lib/hari-laporan";

export interface TransaksiPenjualan {
  total: number;
  diskon: number | null;
  poin_dipakai: number | null;
  created_at: string;
  /** Tanggal transaksi di Majoo (H+1), null untuk transaksi manual. */
  tanggal_majoo: string | null;
  source: string | null;
}

export interface BarisHarianPenjualan {
  /** Kunci hari lokal YYYY-MM-DD. */
  tgl: string;
  /** Tanggal siap tampil, contoh "3 Okt 2026". */
  tglLabel: string;
  jumlah: number;
  omzet: number;
  /** true untuk hari dengan omzet tertinggi. */
  terbaik: boolean;
}

export interface RingkasanPenjualan {
  /** Omzet sebelum diskon dan potongan poin. */
  bruto: number;
  diskon: number;
  potonganPoin: number;
  /** Yang benar-benar masuk laci: bruto - diskon - potongan poin. */
  omzet: number;
  jumlah: number;
  rataRata: number;
  /** Hari yang ada transaksinya, bukan seluruh hari dalam periode. */
  hariJualan: number;
  rataPerHariJualan: number;
  harian: BarisHarianPenjualan[];
  hariTerbaik: BarisHarianPenjualan | null;
}

/** Tanggal siap tampil dari kunci YYYY-MM-DD, tanpa bergeser zona waktu. */
export function labelTanggal(kunci: string): string {
  const [y, m, d] = kunci.split("-").map(Number);
  if (!y || !m || !d) return kunci;
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Ringkas transaksi satu periode untuk laporan penjualan.
 *
 * Transaksi yang hari laporannya tidak terbaca (tanggal rusak) tetap
 * dihitung di total, tetapi tidak masuk rincian per hari: menebak harinya
 * akan memunculkan hari yang tidak pernah ada di laporan.
 */
export function ringkasPenjualan(
  transaksi: TransaksiPenjualan[],
  nilaiPoin: number,
): RingkasanPenjualan {
  const daftar = transaksi ?? [];
  let bruto = 0;
  let diskon = 0;
  let potonganPoin = 0;
  let omzet = 0;
  const perHari = new Map<string, { jumlah: number; omzet: number }>();

  for (const t of daftar) {
    const net = nilaiBersih(t, nilaiPoin);
    const kotor = Math.max(0, Number(t.total) || 0);
    const potDiskon = Math.max(0, Number(t.diskon) || 0);
    const potPoin = Math.max(0, Number(t.poin_dipakai) || 0) * (Number(nilaiPoin) || 0);

    bruto += kotor;
    diskon += potDiskon;
    potonganPoin += potPoin;
    omzet += net;

    const kunci = kunciHariLaporanAtauNull(t);
    if (!kunci) continue;
    const cur = perHari.get(kunci) ?? { jumlah: 0, omzet: 0 };
    cur.jumlah += 1;
    cur.omzet += net;
    perHari.set(kunci, cur);
  }

  const harian: BarisHarianPenjualan[] = [...perHari.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([tgl, v]) => ({
      tgl,
      tglLabel: labelTanggal(tgl),
      jumlah: v.jumlah,
      omzet: v.omzet,
      terbaik: false,
    }));

  // Hari terbaik hanya berguna kalau ada lebih dari satu hari jualan: kalau
  // cuma sehari, semua hari otomatis "terbaik" dan penandanya kehilangan arti.
  let hariTerbaik: BarisHarianPenjualan | null = null;
  if (harian.length > 1) {
    for (const h of harian) {
      if (!hariTerbaik || h.omzet > hariTerbaik.omzet) hariTerbaik = h;
    }
    if (hariTerbaik) hariTerbaik.terbaik = true;
  }

  const jumlah = daftar.length;
  const hariJualan = harian.length;

  return {
    bruto,
    diskon,
    potonganPoin,
    omzet,
    jumlah,
    rataRata: jumlah > 0 ? Math.round(omzet / jumlah) : 0,
    hariJualan,
    rataPerHariJualan: hariJualan > 0 ? Math.round(omzet / hariJualan) : 0,
    harian,
    hariTerbaik,
  };
}
