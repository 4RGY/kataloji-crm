// Read-only: periksa hubungan diskon vs poin_dipakai per transaksi.
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();
const { data, error } = await admin
  .from("transaksi")
  .select(
    "id, total, diskon, poin_dipakai, poin_didapat, pelanggan_id, status_pencocokan",
  )
  .order("created_at", { ascending: false });
if (error) {
  console.error("error", error.message);
  process.exitCode = 1;
} else {
  console.log("total, diskon, poin_dipakai, poin_didapat, pelanggan_id, status");
  for (const t of data ?? []) {
    console.log(
      [
        t.total,
        t.diskon,
        t.poin_dipakai,
        t.poin_didapat,
        t.pelanggan_id ?? "(null)",
        t.status_pencocokan,
      ].join(", "),
    );
  }
  // dua rumus omzet
  const omzetGross = (data ?? []).reduce((s, t) => s + t.total - t.diskon, 0);
  const omzetBersih = (data ?? []).reduce(
    (s, t) => s + Math.max(0, t.total - t.diskon - t.poin_dipakai * 1000),
    0,
  );
  const poinMentah = (data ?? []).reduce((s, t) => s + t.poin_didapat, 0);
  const poinDiberikan = (data ?? []).reduce(
    (s, t) => s + (t.pelanggan_id ? t.poin_didapat : 0),
    0,
  );
  console.log("---");
  console.log("omzet gross (total-diskon)      =", omzetGross);
  console.log("omzet bersih (-poin*1000, floor0)=", omzetBersih);
  console.log("poin mentah                      =", poinMentah);
  console.log("poin diberikan (ada pelanggan)   =", poinDiberikan);
}
