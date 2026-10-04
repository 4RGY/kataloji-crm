// ============================================================
// Hari laporan sebuah transaksi, Kataloji CRM
// ============================================================
// Transaksi impor Majoo H+1: `created_at` adalah waktu IMPOR (pagi hari
// berikutnya), sedangkan transaksi sesungguhnya terjadi sehari sebelumnya
// (kolom `tanggal_majoo`). Tiap tampilan laporan (filter periode, grafik
// per hari, rekap) harus memakai tanggal transaksinya, bukan waktu catat,
// kalau tidak data impor baru masuk ke laporan hari ini alih-alih kemarin.
//
// Transaksi manual (kasir) tidak punya `tanggal_majoo`, jadi hari
// laporannya sama dengan hari catatnya. Dua sumber, satu aturan:
//
//   hariLaporan = tanggal_majoo (kalau ada) selain itu created_at
//
// Ada dua wajah aturan ini, jangan campur:
//   - ...AtauNull : mengembalikan null bila kedua sumber tak terbaca.
//                   Dipakai untuk MENGHITUNG / MENGGROUP yang tidak boleh
//                   membuat hari palsu dari data rusak (prinsip audit:
//                   yang tak valid jangan ditebak).
//   - versi biasa  : mundur ke tengah malam hari ini bila keduanya rusak,
//                   supaya tampilan (filter, grafik) tetap punya satu nilai.
//
// Tulis aturan di satu tempat ini. Kalau cara menentukannya berubah, ubah
// di sini dan semua tampilan ikut berubah, bukan di tiap halaman.
// ============================================================

export interface BasisHariLaporan {
  /** Tanggal transaksi di Majoo (YYYY-MM-DD), null untuk transaksi manual. */
  tanggal_majoo?: string | null;
  /** Waktu transaksi dicatat di CRM. */
  created_at: string;
}

function kunciHari(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tengahMalamKini(): Date {
  const kini = new Date();
  kini.setHours(0, 0, 0, 0);
  return kini;
}

/**
 * Hari laporan sebuah transaksi (waktu lokal), atau null bila kedua sumber
 * (`tanggal_majoo` dan `created_at`) sama-sama tak terbaca.
 *
 * `tanggal_majoo` dibaca sebagai tengah malam lokal tanggal itu; created_at
 * dipertahankan apa adanya.
 */
export function hariLaporanAtauNull(t: BasisHariLaporan): Date | null {
  if (t.tanggal_majoo) {
    const d = new Date(t.tanggal_majoo + "T00:00:00");
    if (Number.isFinite(d.getTime())) return d;
  }
  const c = new Date(t.created_at);
  if (Number.isFinite(c.getTime())) return c;
  return null;
}

/**
 * Hari laporan, dengan jaminan selalu ada (mundur ke tengah malam hari ini
 * bila data rusak). Dipakai tampilan yang butuh satu nilai konkret, bukan
 * pengelompokan yang harus jujur soal data tak valid.
 */
export function hariLaporan(t: BasisHariLaporan): Date {
  const d = hariLaporanAtauNull(t);
  return d ?? tengahMalamKini();
}

/** Kunci hari lokal YYYY-MM-DD dari hari laporan, atau null bila data rusak. */
export function kunciHariLaporanAtauNull(t: BasisHariLaporan): string | null {
  const d = hariLaporanAtauNull(t);
  return d ? kunciHari(d) : null;
}

/** Kunci hari lokal YYYY-MM-DD, jaminan selalu ada (mundur ke hari ini). */
export function kunciHariLaporan(t: BasisHariLaporan): string {
  const d = hariLaporanAtauNull(t);
  return d ? kunciHari(d) : kunciHari(tengahMalamKini());
}
