// Pembuat berkas contoh ekspor Majoo (dummy) untuk uji coba impor CRM.
// Format meniru persis berkas asli Majoo (header tidak di baris pertama,
// ada metadata "Date Generated", footer "Powered By").
//
// Pakai: npx tsx scripts/buat-berkas-contoh-majoo.mts <folder-tujuan>
//
// Dua berkas dihasilkan:
//   1. data_pelanggan_...xlsx  -> ekspor "Data Pelanggan"
//   2. detil_penjualan_...xlsx -> ekspor "Detail Penjualan", DITAMBAH kolom
//                                 Kode/Nama Pelanggan supaya kunjungan dan
//                                 repeat order bisa diuji (berkas PDF asli
//                                 dari Majoo tidak memuat identitas pembeli).

import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const TANGGAL = "2026-09-19";
const STempel = "19/09/2026 - 16:42:07 WIB";
const NAMA_OUTLET = "Kataloji";

/** Baris metadata pembuka, meniru judul + cap waktu ekspor Majoo. */
function kepala(judul: string, lebar: number): string[][] {
  const kosong = () => Array<string>(lebar).fill("");
  const capWaktu = kosong();
  capWaktu[lebar - 3] = `Date Generated ${STempel}`;
  const logo = kosong();
  logo[lebar - 1] = NAMA_OUTLET;
  return [
    [judul, ...Array<string>(lebar - 2).fill(""), NAMA_OUTLET],
    logo,
    kosong(),
    ["Pencarian", ...Array<string>(lebar - 1).fill("")],
    kosong(),
    capWaktu,
    kosong(),
  ];
}

/** Baris penutup: spasi lalu jejak "Powered By". */
function kaki(lebar: number): string[][] {
  const powered = Array<string>(lebar).fill("");
  powered[lebar - 2] = "Powered By";
  // Sisipkan satu baris kosong sebelum footer, tanpa baris footer tambahan
  // yang parser akan anggap sebagai record tak valid.
  return [Array<string>(lebar).fill(""), powered];
}

// ---------- 1. Data Pelanggan ----------

const PELANGGAN = [
  ["KA230220EF8S", "Tyo", "L", "", "", "", "", "085123456", "0", "Rp0.00", ""],
  ["KA230220EF8T", "Budi Santoso", "L", "Jl. Merdeka No 12", "19/09/2000", "Bandung", "budi@email.com", "081234567891", "12", "Rp0.00", "Member"],
  ["KA230220EF8U", "Siti Nurhaliza", "P", "Jl. Cihampelas No 45", "12/03/1998", "Bandung", "siti@email.com", "081298765432", "5", "Rp0.00", "Member"],
  ["KA230220EF8V", "Andi Wijaya", "L", "Jl. Dago No 8", "05/07/1995", "Bandung", "andi@email.com", "081345678901", "23", "Rp0.00", "VIP"],
  ["KA230220EF8W", "Rina Kartika", "P", "Jl. Buah Batu No 77", "28/11/2001", "Bandung", "rina@email.com", "081456789012", "0", "Rp0.00", "Member"],
  ["KA230220EF8X", "Dedi Kurniawan", "L", "Jl. Sukabumi No 3", "14/01/1993", "Bandung", "dedi@email.com", "081567890123", "8", "Rp0.00", "Member"],
];

function buatDataPelanggan(): string[][] {
  const lebar = 11;
  const header = [
    "Kode Pelanggan", "Nama Pelanggan", "Jenis Kelamin", "Alamat",
    "Tanggal Lahir", "Kota", "Email", "No Telepon",
    "Jumlah Poin Reward", "Saldo Deposit(Rp)", "Grup Pelanggan",
  ];
  return [...kepala("Data Pelanggan", lebar), header, ...PELANGGAN, ...kaki(lebar)];
}

// ---------- 2. Detail Penjualan ----------

// Urutan: No, Waktu, Kode Pelanggan, Nama Pelanggan, Produk,
//         Metode Pembayaran, Total Penjualan, Subtotal
const TRANSAKSI = [
  // Budi belanja 2x di hari sama -> transaksi kedua = repeat order
  ["CS/23/260919/0001", `${TANGGAL} 10:15`, "KA230220EF8T", "Budi Santoso", "Kopi Susu Gula Aren, Roti Bakar", "Tunai", "Rp45.000", "45.000"],
  ["CS/23/260919/0002", `${TANGGAL} 15:40`, "KA230220EF8T", "Budi Santoso", "Es Kopi Susu", "QRIS", "Rp28.000", "28.000"],
  // Siti sekali kunjungan
  ["CS/23/260919/0003", `${TANGGAL} 11:05`, "KA230220EF8U", "Siti Nurhaliza", "Matcha Latte, Croissant", "Kartu Debit", "Rp62.000", "62.000"],
  // Andi 3x di hari sama -> transaksi ke-2 & ke-3 = repeat order
  ["CS/23/260919/0004", `${TANGGAL} 09:20`, "KA230220EF8V", "Andi Wijaya", "Americano", "Tunai", "Rp22.000", "22.000"],
  ["CS/23/260919/0005", `${TANGGAL} 13:10`, "KA230220EF8V", "Andi Wijaya", "Cappuccino, Churros", "QRIS", "Rp48.000", "48.000"],
  ["CS/23/260919/0006", `${TANGGAL} 19:55`, "KA230220EF8V", "Andi Wijaya", "Es Teh Manis", "Tunai", "Rp12.000", "12.000"],
  // Rina sekali kunjungan
  ["CS/23/260919/0007", `${TANGGAL} 14:30`, "KA230220EF8W", "Rina Kartika", "Kopi Hitam, Pisang Goreng", "Tunai", "Rp35.000", "35.000"],
  // Walk-in tanpa pelanggan
  ["CS/23/260919/0008", `${TANGGAL} 16:00`, "", "Walk-in Guest", "Es Kopi Susu", "Tunai", "Rp28.000", "28.000"],
  // Dedi hari BERBEDA -> kunjungan baru walau pelanggan pernah datang
  ["CS/23/260920/0009", "20/09/2026 10:00", "KA230220EF8X", "Dedi Kurniawan", "Kopi Tubruk", "QRIS", "Rp18.000", "18.000"],
];

function buatDetilPenjualan(): string[][] {
  const lebar = 8;
  const header = [
    "No", "Waktu", "Kode Pelanggan", "Nama Pelanggan",
    "Produk", "Metode Pembayaran", "Total Penjualan", "Subtotal",
  ];
  return [...kepala("Detail Penjualan", lebar), header, ...TRANSAKSI, ...kaki(lebar)];
}

// ---------- Tulis berkas ----------

const folder = process.argv[2];
if (!folder) {
  console.error("Pakai: npx tsx scripts/buat-berkas-contoh-majoo.mts <folder-tujuan>");
  process.exit(1);
}

fs.mkdirSync(folder, { recursive: true });

const stempelBerkas = TANGGAL.replace(/-/g, "_");
const berkas: [string, string[][]][] = [
  [`data_pelanggan_${stempelBerkas}_164207.xlsx`, buatDataPelanggan()],
  [`detil_penjualan_${stempelBerkas}_164939.xlsx`, buatDetilPenjualan()],
];

for (const [nama, baris] of berkas) {
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.aoa_to_sheet(baris), "Sheet1");
  const tujuan = path.join(folder, nama);
  XLSX.writeFile(buku, tujuan);
  console.log("Dibuat:", tujuan);
}
