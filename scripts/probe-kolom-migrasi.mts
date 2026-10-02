// Probe sekali: cek kolom migrasi aturan-poin.sql di DB cloud.
// Jalankan: npx tsx --env-file=.env.local scripts/probe-kolom-migrasi.mts
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

// 1) Apakah tabel aturan_poin ada?
const { data: aturan, error: eAturan } = await admin
  .from("aturan_poin")
  .select("id")
  .limit(1);
console.log("aturan_poin ada:", !eAturan, eAturan ? eAturan.message : `(${aturan?.length} baris)`);

// 2) Apakah kolom baru di transaksi ada? (probe lewat select nama kolom)
const { error: eKolom } = await admin
  .from("transaksi")
  .select("kode_pelanggan_majoo, status_pencocokan, tanggal_majoo")
  .limit(1);
if (eKolom) {
  console.log("kolom transaksi baru TIDAK ada -> migrasi belum dijalankan");
  console.log("detail:", eKolom.message);
} else {
  console.log("kolom transaksi baru ADA -> migrasi sudah dijalankan");
}

// 3) Apakah fungsi cocokkan_transaksi_menunggu ada?
const { error: eFn } = await admin.rpc("cocokkan_transaksi_menunggu", {
  p_kode_majoo: "TIDAK-ADA-PROBE",
  p_pelanggan_id: 0,
});
console.log("fn cocokkan_transaksi_menunggu:", !eFn, eFn ? eFn.message : "(ada)");
