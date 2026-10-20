// ============================================================
// Uji murni: normalisasi metode bayar impor Majoo.
// ============================================================
// Kolom transaksi.metode_bayar dijaga CHECK constraint yang hanya menerima
// 'tunai' | 'debit' | 'qris' (huruf kecil). Ekspor Majoo menulis "Tunai",
// "QRIS", "Debit". Tanpa normalisasi, SELURUH baris transaksi impor ditolak
// database (21 Okt 2026: 6 asersi uji impor gagal karena ini, ditambah kolom
// subtotal NOT NULL yang belum diisi).
//
// Jalankan: npx tsx scripts/uji-impor-metode.mts
import { normalisasiMetodeBayar, parseMajoo } from "../src/lib/impor-majoo.ts";

const kasus: [string, string][] = [
  ["Tunai", "tunai"],
  ["TUNAI", "tunai"],
  ["  tunai ", "tunai"],
  ["QRIS", "qris"],
  ["Qris BCA", "qris"],
  ["Debit", "debit"],
  ["Kartu Debit BCA", "debit"],
  ["EDC Mandiri", "debit"],
  ["Cash", "tunai"],
  ["GoPay", ""],
  ["", ""],
];
let lulus = 0, gagal = 0;
for (const [masuk, harap] of kasus) {
  const dapat = normalisasiMetodeBayar(masuk);
  if (dapat === harap) lulus++;
  else { gagal++; console.log(`  GAGAL  "${masuk}" -> "${dapat}", harusnya "${harap}"`); }
}

const raw = [
  ["No", "Total Penjualan", "Metode Pembayaran", "Produk", "Waktu"],
  ["A-1", "75.900", "QRIS", "Kopi Uji", "19/10/2026 18:00"],
  ["A-2", "20.000", "TUNAI", "Teh", "19/10/2026 19:00"],
];
const h = parseMajoo(raw);
console.log("hasil parse:", JSON.stringify(h.transaksi.map((t) => [t.external_ref, t.total, t.metode_bayar])));
for (const t of h.transaksi) if (!["tunai", "qris", "debit", ""].includes(t.metode_bayar)) { gagal++; console.log("  GAGAL  metode tidak sah:", t.metode_bayar); } else lulus++;
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
