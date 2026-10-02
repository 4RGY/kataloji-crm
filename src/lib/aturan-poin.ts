// ============================================================
// Modul Aturan Poin (berversi per periode), Kataloji CRM
// ============================================================
// Logika murni (tanpa React, tanpa Supabase) yang MIMPIKAN aturan
// di supabase/aturan-poin.sql. Sumber kebenaran tetap database;
// fungsi di sini dipakai untuk pratinjau di layar dan validasi form
// admin sebelum menulis ke tabel aturan_poin.
//
// Keputusan bisnis (diskusi tim):
//   - Aturan lama tidak pernah dihitung ulang. Tiap transaksi
//     memakai aturan yang berlaku pada tanggal transaksinya.
//   - Tanpa aturan yang berlaku -> model lama tetap dipakai
//     (1 poin per Rp20.000), supaya poin lama tidak berubah.
//   - Poin yang masih menunggu pencocokan pelanggan TIDAK diberikan
//     sampai transaksinya tertaut (lihat trigger di aturan-poin.sql).
// ============================================================

export type ModeAturan = "per_nominal" | "per_kunjungan" | "per_transaksi";

export const MODES_VALID: readonly ModeAturan[] = [
  "per_nominal",
  "per_kunjungan",
  "per_transaksi",
];

/** Nominal bawaan model lama, dipakai saat aturan per_nominal kosong. */
export const NOMINAL_FALLBACK = 20_000;

/** Baris tabel aturan_poin sebagaimana terbaca dari Supabase. */
export interface BarisAturanPoin {
  id: string;
  mode: string;
  nominal: number | null;
  mulai: string; // YYYY-MM-DD
  selesai: string | null; // null = masih berlaku
  keterangan: string | null;
}

export interface InputAturanBaru {
  mode: ModeAturan;
  mulai: string; // YYYY-MM-DD
  selesai: string; // YYYY-MM-DD atau "" (masih berlaku)
  nominal: string; // hanya per_nominal, angka rupiah
  keterangan: string;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function labelMode(mode: string): string {
  switch (mode) {
    case "per_nominal":
      return "Per nominal";
    case "per_kunjungan":
      return "Per kunjungan";
    case "per_transaksi":
      return "Per transaksi";
    default:
      return mode;
  }
}

export function deskripsiMode(aturan: BarisAturanPoin): string {
  switch (aturan.mode) {
    case "per_nominal": {
      const n = aturan.nominal ?? NOMINAL_FALLBACK;
      return `1 poin per ${new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(n)} belanja (setelah diskon, sebelum potongan poin).`;
    }
    case "per_kunjungan":
      return "1 poin per pelanggan per tanggal. Transaksi susulan di tanggal yang sama tetap dicatat, tetapi tidak menambah poin.";
    case "per_transaksi":
      return "1 poin per transaksi yang tertaut pelanggan.";
    default:
      return "Aturan lama: 1 poin per Rp20.000.";
  }
}

/**
 * Aturan yang berlaku pada tanggal: aturan satu-satunya yang periodenya
 * memuat tanggal itu (peride tidak boleh tumpang tindih, dijaga trigger
 * database). Tidak ada yang cocok -> null (fallback model lama).
 */
export function aturanAktif(
  daftar: BarisAturanPoin[],
  tanggal: string,
): BarisAturanPoin | null {
  let cocok: BarisAturanPoin | null = null;
  for (const a of daftar) {
    if (a.mulai > tanggal) continue;
    if (a.selesai && a.selesai < tanggal) continue;
    if (!cocok || a.mulai > cocok.mulai) cocok = a;
  }
  return cocok;
}

export interface KonteksHitung {
  aturan: BarisAturanPoin | null;
  basis: number; // total setelah diskon, sebelum potongan poin
  punyaPelanggan: boolean;
  /** true bila pelanggan ini sudah punya transaksi lain di tanggal yang sama. */
  kunjunganKedua: boolean;
}

/**
 * Pratinjau jumlah poin. WAJIB sama polanya dengan
 * public.hitung_poin_aturan() di aturan-poin.sql. Jika cara hitungnya
 * berubah di SQL, ubah dua-duanya dalam perubahan yang sama.
 */
export function hitungPoinLokal(k: KonteksHitung): number {
  const basis = Math.max(0, Math.floor(k.basis || 0));

  // Tanpa aturan yang berlaku: model lama. Pelanggan wajib ada.
  if (!k.aturan) {
    if (!k.punyaPelanggan) return 0;
    return Math.floor(basis / NOMINAL_FALLBACK);
  }

  if (!k.punyaPelanggan) return 0;

  switch (k.aturan.mode) {
    case "per_nominal": {
      const n = Math.max(1, k.aturan.nominal ?? NOMINAL_FALLBACK);
      return Math.floor(basis / n);
    }
    case "per_transaksi":
      return 1;
    case "per_kunjungan":
      return k.kunjunganKedua ? 0 : 1;
    default:
      return 0;
  }
}

/**
 * Validasi form aturan baru oleh admin. Mengembalikan daftar pesan
 * (kosong = valid). Tumpang tindih periode TIDAK bisa dicek di sini
 * tanpa membaca aturan yang ada, jadi parameter `yangAda` diberi tahu
 * periodenya.
 */
export function validasiInputAturan(
  input: InputAturanBaru,
  yangAda: BarisAturanPoin[] = [],
): string[] {
  const errors: string[] = [];

  if (!MODES_VALID.includes(input.mode)) {
    errors.push("Pilih salah satu mode poin.");
  }

  if (!POLA_TANGGAL.test(input.mulai)) {
    errors.push("Tanggal mulai wajib diisi.");
  } else if (input.selesai && !POLA_TANGGAL.test(input.selesai)) {
    errors.push("Tanggal selesai tidak dikenali.");
  } else if (
    input.selesai &&
    POLA_TANGGAL.test(input.mulai) &&
    input.selesai < input.mulai
  ) {
    errors.push("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }

  if (input.mode === "per_nominal") {
    const n = Number((input.nominal || "").replace(/[^0-9]/g, ""));
    if (!n || n <= 0) {
      errors.push("Nominal poin wajib diisi (contoh: 20000).");
    } else if (n < 1000) {
      errors.push("Nominal poin terlalu kecil (minimal Rp1.000).");
    }
  }

  // Cek tumpang tindih terhadap aturan yang sudah ada.
  if (POLA_TANGGAL.test(input.mulai)) {
    const selesaiUji = input.selesai || "9999-12-31";
    const bentrok = yangAda.some((a) => {
      const aSelesai = a.selesai || "9999-12-31";
      return a.mulai <= selesaiUji && aSelesai >= input.mulai;
    });
    if (bentrok) {
      errors.push(
        "Periode ini bertumpang tindih dengan aturan yang sudah ada. Ubah salah satu periodenya dulu.",
      );
    }
  }

  return errors;
}
