// Read-only: lihat isi pelanggan, transaksi, ledger sekarang.
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

const { data: pelanggan } = await admin.from("pelanggan").select("*");
console.log("=== Pelanggan ===");
for (const p of pelanggan ?? []) {
  console.log(`- ${p.nama} | WA ${p.whatsapp ?? "-"} | kode_majoo ${p.kode_majoo ?? "-"}`);
}

const { data: transaksi } = await admin.from("transaksi").select("*").order("dibuat_di", { ascending: false });
console.log("\n=== Transaksi ===");
for (const t of transaksi ?? []) {
  console.log(
    `- ${t.dibuat_di} | total ${t.total_akhir} | status ${t.status} | poin ${t.poin} | external_ref ${t.external_ref ?? "-"}`,
  );
}

const { data: ledger } = await admin.from("point_ledger").select("*").order("dibuat_di");
console.log("\n=== Point Ledger ===");
for (const l of ledger ?? []) {
  console.log(`- ${l.dibuat_di} | ${l.jenis} ${l.poin} | jejak ${l.jejak ?? "-"}`);
}
