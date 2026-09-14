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
