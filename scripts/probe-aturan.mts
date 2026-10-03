// Lihat isi + struktur tabel aturan_poin (read-only).
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

const { data, error } = await admin.from("aturan_poin").select("*");
if (error) {
  console.log("ERROR:", error.message);
} else {
  console.log("Jumlah baris:", data?.length ?? 0);
  console.log(JSON.stringify(data, null, 2));
  if (data && data.length > 0) {
    console.log("\nKolom terdeteksi:", Object.keys(data[0]).join(", "));
  }
}
