// Read-only: daftar kolom tabel transaksi (live DB).
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();
const { data, error } = await admin.from("transaksi").select("*").limit(1);
if (error) {
  console.log("ERROR:", error.message);
  process.exit(1);
}
if (!data?.length) {
  console.log("(kosong) ambil dari migrasi");
} else {
  console.log(Object.keys(data[0]).join(", "));
}
