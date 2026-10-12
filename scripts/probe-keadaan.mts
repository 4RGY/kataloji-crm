// Probe keadaan DB nyata sebelum uji UI end-to-end.
// Tidak menulis apa pun, hanya membaca.
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

async function hitung(tabel: string) {
  const { count, error } = await admin
    .from(tabel)
    .select("*", { count: "exact", head: true });
  if (error) return `ERROR: ${error.message}`;
  return String(count ?? 0);
}

console.log("=== Keadaan DB (read-only) ===");
for (const t of ["pelanggan", "transaksi", "point_ledger", "aturan_poin"]) {
  console.log(`${t}: ${await hitung(t)} baris`);
}

console.log("\n=== Aturan poin aktif ===");
const { data: aturan, error: eA } = await admin
  .from("aturan_poin")
  .select("*")
  .order("mulai", { ascending: false });
if (eA) {
  console.log("ERROR:", eA.message);
} else if (!aturan || aturan.length === 0) {
  console.log("(kosong, belum ada aturan)");
} else {
  for (const a of aturan) {
    console.log(`  ${a.mode} | dari ${a.mulai} s/d ${a.selesai ?? "-"}`);
  }
}

console.log("\n=== Transaksi menunggu pencocokan ===");
const { count: menunggu, error: eM } = await admin
  .from("transaksi")
  .select("*", { count: "exact", head: true })
  .eq("status_pencocokan", "menunggu_pencocokan");
console.log(eM ? `ERROR: ${eM.message}` : `${menunggu ?? 0} baris`);
