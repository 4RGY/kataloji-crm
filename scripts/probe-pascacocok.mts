// Read-only: ledger Budi + pelanggan, pasca pencocokan KA099.
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

const { data: pelanggan } = await admin.from("pelanggan").select("id, nama, kode_majoo, poin");
for (const p of pelanggan ?? []) {
  console.log(`- ${p.nama} (${p.kode_majoo ?? "-"}) poin=${p.poin}`);
}

const { data: ledger } = await admin.from("point_ledger").select("*");
console.log(`\nledger: ${ledger?.length} baris`);
for (const l of ledger ?? []) {
  console.log(`- ${l.pelanggan_id} earn ${l.poin_masuk} sisa ${l.sisa}`);
}
