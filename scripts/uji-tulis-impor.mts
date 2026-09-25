// ============================================================
// Uji tulis impor Majoo ke database sungguhan (sekali pakai).
// ============================================================
// Jalankan dengan: node --env-file=.env.local --import tsx <file>
// Atau:           npx tsx --env-file=.env.local <file> (bila didukung)
// Membuktikan 3 hal dengan eksekusi nyata:
//   1. parseMajoo() membaca baris -> baris siap impor.
//   2. tulisImporMajoo() menulis ke Supabase (dibuat).
//   3. Menulis data yang SAMA lagi tidak menggandakan (diperbarui).
// Lalu baris uji dihapus supaya database bersih kembali.
// ============================================================

const { getKlienAdmin } = await import("../src/lib/supabase/admin.ts");
const { parseMajoo } = await import("../src/lib/impor-majoo.ts");
const { tulisImporMajoo } = await import("../src/lib/tulis-impor-majoo.ts");

const KODE_UJI = "TEST-IMP-0001";
const REF_UJI = "TEST-TRX-0001";

const barisPelanggan = [
  ["Data Pelanggan", "", ""],
  ["Pencarian", "", ""],
  ["Date Generated: 19/09/2026", "", ""],
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
  [
    "Kode Pelanggan",
    "Nama Pelanggan",
    "No Telepon",
    "Tanggal Lahir",
    "Jenis Kelamin",
    "Email",
    "Alamat",
  ],
  [KODE_UJI, "Test Impor Majoo", "081234567891", "19/09/2000", "L", "test@example.com", "Jl. Test No 1"],
];

const barisTransaksi = [
  ["No", "Total Penjualan", "Metode Pembayaran", "Produk"],
  [REF_UJI, "75.900", "QRIS", "Black Oranje, Kopsus Gula Aren"],
];

const admin = getKlienAdmin();

// 1) Parse
const parsedPel = parseMajoo(barisPelanggan);
const parsedTrx = parseMajoo(barisTransaksi);
console.log("=== PARSE ===");
console.log("pelanggan:", JSON.stringify(parsedPel.pelanggan));
console.log("transaksi:", JSON.stringify(parsedTrx.transaksi));

// 2) Tulis pertama (harus dibuat)
const ringkas1 = await tulisImporMajoo(admin, parsedPel.pelanggan, parsedTrx.transaksi);
console.log("=== TULIS #1 ===");
console.log(JSON.stringify(ringkas1, null, 2));

// 3) Tulis lagi data yang sama (harus diperbarui, bukan dibuat lagi)
const ringkas2 = await tulisImporMajoo(admin, parsedPel.pelanggan, parsedTrx.transaksi);
console.log("=== TULIS #2 (idempoten) ===");
console.log(JSON.stringify(ringkas2, null, 2));

// 4) Cek jumlah aktual di DB (harus tetap 1, bukan 2)
const { data: jumlahPelanggan } = await admin
  .from("pelanggan")
  .select("id", { count: "exact" })
  .eq("kode_majoo", KODE_UJI);
const { data: jumlahTransaksi } = await admin
  .from("transaksi")
  .select("id", { count: "exact" })
  .eq("external_ref", REF_UJI);

console.log("=== CEK JUMLAH DI DB ===");
console.log("pelanggan (kode_majoo):", jumlahPelanggan?.length);
console.log("transaksi (external_ref):", jumlahTransaksi?.length);

// 5) Bersihkan baris uji
await admin.from("pelanggan").delete().eq("kode_majoo", KODE_UJI);
await admin.from("transaksi").delete().eq("external_ref", REF_UJI);
console.log("=== BERSIH: baris uji dihapus ===");
