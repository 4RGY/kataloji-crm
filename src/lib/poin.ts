// ============================================================
// Modul Loyalty (Poin) — Kataloji CRM
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

export function hitungPoin(total: number): number {
  return Math.floor(total / POIN_PER_RUPIAH);
}

export function hitungPotongan(poinDipakai: number): number {
  return poinDipakai * NILAI_POIN;
}

export function maxPoinDipakai(total: number): number {
  // maksimum 100% dari tagihan (dalam poin)
  return Math.floor(total / NILAI_POIN);
}

export function validateRedeem(
  poinDipakai: number,
  total: number,
): string[] {
  const errors: string[] = [];
  if (poinDipakai < 0) errors.push("poin_dipakai tidak boleh negatif");
  if (poinDipakai > 0 && poinDipakai < MIN_REDEEM)
    errors.push(`minimum tukar poin ${MIN_REDEEM}`);
  if (hitungPotongan(poinDipakai) > total)
    errors.push("potongan poin melebihi total tagihan");
  return errors;
}

export function hitungPoinTransaksi(input: InputHitungPoin): HasilHitungPoin {
  const total = Number(input.total) || 0;
  const poinDipakai = Number(input.poin_dipakai) || 0;
  const poinTersedia = Number(input.poin_tersedia) || 0;

  const errors: string[] = [];
  if (total <= 0) errors.push("total harus lebih dari 0");
  if (poinDipakai > poinTersedia)
    errors.push("poin_dipakai melebihi poin tersedia milik pelanggan");

  errors.push(...validateRedeem(poinDipakai, total));

  const potongan = hitungPotongan(poinDipakai);
  const netTotal = Math.max(0, total - potongan);
  const poinDidapat = hitungPoin(total); // dari total SEBELUM potongan

  return {
    poin_didapat: poinDidapat,
    potongan,
    net_total: netTotal,
    sisa_poin: poinTersedia - poinDipakai + poinDidapat,
    errors,
  };
}
