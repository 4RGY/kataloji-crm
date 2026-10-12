// Buat file detail penjualan uji pencocokan (format = generator dummy, teruji).
// - 1 baris kode pelanggan BELUM ada di CRM (KA099) -> transaksi harus masuk
//   status_pencocokan 'menunggu_pencocokan' (poin ditahan)
// - 1 baris walk-in tanpa kode -> 'anonim'
import "./muat-env.mts";
import XLSX from "xlsx";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const baris: (string | number)[][] = [
  ["No", "Waktu", "Kode Pelanggan", "Nama Pelanggan", "Produk", "Metode Pembayaran", "Total Penjualan", "Subtotal"],
  ["CS/23/261002/0011", "2026-10-02 14:00", "KA099", "Eko Pengujian", "Kopi Susu Gula Aren", "Tunai", "Rp30.000", "30.000"],
  ["CS/23/261002/0012", "2026-10-02 14:30", "", "Walk-in Guest", "Es Teh Manis", "QRIS", "Rp20.000", "20.000"],
];

const ws = XLSX.utils.aoa_to_sheet(baris);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
const out = "contoh-majoo-dummy/detail_penjualan_uji_pencocokan.xlsx";
XLSX.writeFile(wb, out);
console.log("✓ Dibuat:", out);

const admin = getKlienAdmin();
const { data: cek } = await admin
  .from("pelanggan")
  .select("kode_majoo")
  .eq("kode_majoo", "KA099");
console.log(cek?.length ? "!! KA099 sudah ada di pelanggan, ganti kodenya" : "OK KA099 belum ada di pelanggan");
