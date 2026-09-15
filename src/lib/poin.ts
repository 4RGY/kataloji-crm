// ============================================================
// Modul Loyalty (Poin), Kataloji CRM
// Bagian dari monolit Next.js (bukan service terpisah).
// Dipakai via import langsung oleh route handler / server action;
// route tipis di /api/poin/hitung hanya untuk kebutuhan eksternal.
//
// Aturan bisnis poin Kataloji (dari docs BUSINESS_RULES):
// - 1 poin per Rp 20.000 dari total SEBELUM potongan poin
// - 1 poin = Rp 1.000 saat ditukar
// - minimum redeem 5 poin, maksimum 100% dari tagihan
// ============================================================

export const POIN_PER_RUPIAH = 20_000;
export const NILAI_POIN = 1_000;
export const MIN_REDEEM = 5;

export interface InputHitungPoin {
  total: number;
  diskon?: number;
  poin_dipakai: number;
  poin_tersedia: number;
}

export interface HasilHitungPoin {
  poin_didapat: number;
  potongan: number;
  net_total: number;
  sisa_poin: number;
  errors: string[];
}

/**
 * Basis poin = total SEBELUM potongan poin, TAPI setelah diskon promo.
 * BR-TRX-05: poin = floor((total - diskon) / 20.000).
 * Diskon biasa mengurangi basis, potongan poin tidak.
 */
export function basisPoin(total: number, diskon = 0): number {
  return Math.max(0, Math.floor(total) - Math.floor(diskon || 0));
}

export function hitungPoin(total: number, diskon = 0): number {
  return Math.floor(basisPoin(total, diskon) / POIN_PER_RUPIAH);
}

export function hitungPotongan(poinDipakai: number): number {
  return poinDipakai * NILAI_POIN;
}

export function maxPoinDipakai(total: number, diskon = 0): number {
  // maksimum 100% dari tagihan setelah diskon promo (dalam poin)
  const tagihan = Math.max(0, Math.floor(total) - Math.floor(diskon || 0));
  return Math.floor(tagihan / NILAI_POIN);
}

export function validateRedeem(
  poinDipakai: number,
  total: number,
  diskon = 0,
): string[] {
  const errors: string[] = [];
  if (poinDipakai < 0) errors.push("poin_dipakai tidak boleh negatif");
  if (poinDipakai > 0 && poinDipakai < MIN_REDEEM)
    errors.push(`minimum tukar poin ${MIN_REDEEM}`);
  // potongan poin tidak boleh melebihi tagihan setelah diskon promo
  if (hitungPotongan(poinDipakai) > Math.max(0, total - (diskon || 0)))
    errors.push("potongan poin melebihi total tagihan");
  return errors;
}

/**
 * Poin yang BENAR-BENAR diterima pelanggan dari sebuah transaksi.
 *
 * Kolom `poin_didapat` di tabel transaksi diisi trigger dari basis hitungan,
 * tetapi poin hanya dicatat ke buku besar bila transaksinya punya pelanggan.
 * Transaksi tanpa pelanggan karena itu bisa menyimpan angka lebih besar dari
 * nol padahal tidak ada seorang pun yang menerimanya. Menampilkan angka itu
 * apa adanya membuat kasir mengira poin sudah terbagi.
 */
export function poinDiterimaPelanggan(
  punyaPelanggan: boolean,
  poinDidapat: number,
): number {
  if (!punyaPelanggan) return 0;
  const n = Number(poinDidapat) || 0;
  return n > 0 ? n : 0;
}

/** Angka yang aman ditampilkan pada ringkasan kasir. */
export interface RingkasanTampil {
  /** Nilai yang boleh disebut kasir ke pelanggan. */
  dibayar: number;
  /** Tampilkan baris potongan poin atau tidak. */
  tampilkanPotongan: boolean;
  /** Tampilkan baris poin didapat atau tidak. */
  tampilkanPoinDidapat: boolean;
}

/**
 * Tentukan angka mana yang boleh muncul di ringkasan.
 *
 * Selama rincian poin masih salah, potongannya BELUM BERLAKU, sehingga
 * angka yang benar adalah tagihan penuh setelah diskon. Menampilkan hasil
 * potongan pada keadaan itu berbahaya: kasir sedang berhadapan dengan
 * pelanggan, matanya jatuh ke angka paling besar di panel, dan angka itu
 * bisa terucap sebelum ia sadar tombol Simpan sedang terkunci.
 *
 * Tombol yang terkunci saja tidak cukup. Yang dibaca kasir adalah angkanya,
 * bukan keadaan tombolnya.
 */
export function ringkasanTampil(
  total: number,
  diskon: number,
  netTotal: number,
  poinDipakai: number,
  adaGalat: boolean,
  punyaPelanggan: boolean,
): RingkasanTampil {
  const aman = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

  if (adaGalat) {
    return {
      dibayar: aman(aman(total) - aman(diskon)),
      tampilkanPotongan: false,
      tampilkanPoinDidapat: false,
    };
  }

  return {
    dibayar: aman(netTotal),
    tampilkanPotongan: aman(poinDipakai) > 0,
    tampilkanPoinDidapat: punyaPelanggan,
  };
}

/**
 * Ubah kode galat teknis dari hitungPoinTransaksi menjadi kalimat yang
 * dimengerti kasir, lengkap dengan angka yang sedang dipakai.
 *
 * Kode galat sengaja tetap memakai nama kolom supaya mudah dicari saat
 * menelusuri masalah, tetapi kalimat itu tidak boleh sampai ke layar kasir.
 */
export function jelaskanGalatPoin(
  kode: string,
  ctx: { poinDipakai?: number; poinTersedia?: number; maksPoin?: number } = {},
): string {
  const dipakai = Number(ctx.poinDipakai) || 0;
  const tersedia = Number(ctx.poinTersedia) || 0;
  const maks = Number(ctx.maksPoin) || 0;

  if (kode.includes("melebihi poin tersedia"))
    return `Poin pelanggan hanya ${tersedia}, tidak cukup untuk menukar ${dipakai} poin.`;
  if (kode.includes("minimum tukar poin"))
    return `Penukaran poin paling sedikit ${MIN_REDEEM} poin. Saat ini baru ${dipakai} poin.`;
  if (kode.includes("potongan poin melebihi"))
    return `Potongan poin melebihi tagihan. Maksimal ${maks} poin untuk tagihan ini.`;
  if (kode.includes("tidak boleh negatif"))
    return "Jumlah poin tidak boleh minus.";
  if (kode.includes("total harus lebih dari 0"))
    return "Total tagihan belum diisi.";
  if (kode.includes("diskon melebihi"))
    return "Diskon promo melebihi total tagihan.";
  if (kode.includes("diskon tidak boleh negatif"))
    return "Diskon promo tidak boleh minus.";
  // Kode yang belum dikenal tidak pernah ditampilkan mentah.
  return "Rincian pembayaran belum benar. Periksa lagi total, diskon, dan poin.";
}

export function hitungPoinTransaksi(input: InputHitungPoin): HasilHitungPoin {
  const total = Number(input.total) || 0;
  const diskon = Number(input.diskon) || 0;
  const poinDipakai = Number(input.poin_dipakai) || 0;
  const poinTersedia = Number(input.poin_tersedia) || 0;

  const errors: string[] = [];
  if (total <= 0) errors.push("total harus lebih dari 0");
  if (diskon < 0) errors.push("diskon tidak boleh negatif");
  if (diskon > total) errors.push("diskon melebihi total tagihan");
  if (poinDipakai > poinTersedia)
    errors.push("poin_dipakai melebihi poin tersedia milik pelanggan");

  errors.push(...validateRedeem(poinDipakai, total, diskon));

  const potongan = hitungPotongan(poinDipakai);
  const netTotal = Math.max(0, total - diskon - potongan);
  // BR-TRX-05: dari total setelah diskon promo, SEBELUM potongan poin
  const poinDidapat = hitungPoin(total, diskon);

  return {
    poin_didapat: poinDidapat,
    potongan,
    net_total: netTotal,
    sisa_poin: poinTersedia - poinDipakai + poinDidapat,
    errors,
  };
}
