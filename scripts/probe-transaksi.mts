// Read-only: struktur baris transaksi beneran.
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

const { data, error } = await admin.from("transaksi").select("*").limit(15);
if (error) {
  console.log("ERROR:", error.message);
  process.exit(1);
}
for (const t of data ?? []) {
  console.log(JSON.stringify(t));
}

const { data: ledger } = await admin.from("point_ledger").select("*").limit(15);
console.log("\n--- ledger ---");
for (const l of ledger ?? []) {
  console.log(JSON.stringify(l));
}
