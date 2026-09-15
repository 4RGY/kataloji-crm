/**
 * Uji dua fungsi murni yang menjaga agar layar kasir tidak berbohong:
 *
 *  1. poinDiterimaPelanggan  - transaksi tanpa pelanggan tidak boleh
 *     terlihat seolah memberi poin, karena tidak ada baris buku besar
 *     yang benar-benar dibuat untuknya.
 *  2. jelaskanGalatPoin      - kode galat yang memakai nama kolom database
 *     tidak boleh pernah tampil ke kasir.
 *
 * Jalankan: npx tsx scripts/uji-poin-tampilan.mts
 */

import {
  hitungPoinTransaksi,
  jelaskanGalatPoin,
  poinDiterimaPelanggan,
  MIN_REDEEM,
} from "../src/lib/poin";

let lulus = 0;
let gagal = 0;

function cek(judul: string, syarat: boolean, tambahan = "") {
  if (syarat) {
    lulus++;
    console.log(`PASS  ${judul}`);
  } else {
    gagal++;
    console.log(`FAIL  ${judul}${tambahan ? ` -> ${tambahan}` : ""}`);
  }
}

console.log("\n=== 1. poinDiterimaPelanggan ===\n");

cek(
  "transaksi tanpa pelanggan tidak menampilkan poin walau kolomnya terisi",
  poinDiterimaPelanggan(false, 1) === 0,
  String(poinDiterimaPelanggan(false, 1)),
);
cek(
  "angka besar pada transaksi tanpa pelanggan tetap nol",
  poinDiterimaPelanggan(false, 9999) === 0,
);
cek(
  "transaksi berpelanggan menampilkan poin apa adanya",
  poinDiterimaPelanggan(true, 2) === 2,
);
cek("poin nol tetap nol", poinDiterimaPelanggan(true, 0) === 0);
cek("poin minus tidak pernah ditampilkan", poinDiterimaPelanggan(true, -3) === 0);
cek(
  "nilai bukan angka diperlakukan sebagai nol",
  poinDiterimaPelanggan(true, Number.NaN) === 0,
);

// Kasus nyata dari data pemilik: satu transaksi Rp 32.000 tanpa pelanggan
// menyimpan poin_didapat = 1 padahal buku besar tidak mencatatnya.
const riwayatAsli = [
  { punyaPelanggan: true, poin_didapat: 2 },
  { punyaPelanggan: true, poin_didapat: 5 },
  { punyaPelanggan: false, poin_didapat: 1 },
  { punyaPelanggan: true, poin_didapat: 1 },
];
const totalTampil = riwayatAsli.reduce(
  (s, t) => s + poinDiterimaPelanggan(t.punyaPelanggan, t.poin_didapat),
  0,
);
cek(
  "total poin yang tampil sama dengan isi buku besar (8, bukan 9)",
  totalTampil === 8,
  String(totalTampil),
);

console.log("\n=== 2. jelaskanGalatPoin ===\n");

const kodeTeknis = [
  "poin_dipakai melebihi poin tersedia milik pelanggan",
  `minimum tukar poin ${MIN_REDEEM}`,
  "potongan poin melebihi total tagihan",
  "poin_dipakai tidak boleh negatif",
  "total harus lebih dari 0",
  "diskon melebihi total tagihan",
  "diskon tidak boleh negatif",
  "kode yang belum pernah ada sebelumnya",
];

const ctx = { poinDipakai: 10, poinTersedia: 7, maksPoin: 47 };

for (const kode of kodeTeknis) {
  const hasil = jelaskanGalatPoin(kode, ctx);
  cek(
    `"${kode.slice(0, 34)}..." tidak bocorkan nama kolom`,
    !/poin_dipakai|poin_tersedia|poin_didapat|_id\b/.test(hasil),
    hasil,
  );
  cek(
    `"${kode.slice(0, 34)}..." berakhir sebagai kalimat`,
    hasil.length > 12 && hasil.trim().endsWith("."),
    hasil,
  );
}

cek(
  "pesan saldo kurang menyebut angka sebenarnya",
  jelaskanGalatPoin("poin_dipakai melebihi poin tersedia milik pelanggan", ctx)
    .includes("7") &&
    jelaskanGalatPoin(
      "poin_dipakai melebihi poin tersedia milik pelanggan",
      ctx,
    ).includes("10"),
  jelaskanGalatPoin("poin_dipakai melebihi poin tersedia milik pelanggan", ctx),
);

cek(
  "pesan minimum tukar menyebut batas 5",
  jelaskanGalatPoin(`minimum tukar poin ${MIN_REDEEM}`, {
    poinDipakai: 3,
  }).includes(String(MIN_REDEEM)),
);

cek(
  "pesan potongan berlebih menyebut batas maksimal",
  jelaskanGalatPoin("potongan poin melebihi total tagihan", ctx).includes("47"),
);

cek(
  "kode tak dikenal memakai kalimat cadangan, bukan kode mentahnya",
  !jelaskanGalatPoin("galat_aneh_dari_masa_depan", ctx).includes(
    "galat_aneh_dari_masa_depan",
  ),
);

cek(
  "konteks kosong tetap menghasilkan kalimat yang utuh",
  jelaskanGalatPoin("poin_dipakai melebihi poin tersedia milik pelanggan")
    .trim()
    .endsWith("."),
);

console.log("\n=== 3. Rangkaian nyata: kasir salah input ===\n");

// Saldo pelanggan 7, kasir mengetik 10.
const salahSaldo = hitungPoinTransaksi({
  total: 47000,
  diskon: 0,
  poin_dipakai: 10,
  poin_tersedia: 7,
});
cek("hitungan menandai galat saat poin melebihi saldo", salahSaldo.errors.length > 0);
cek(
  "galat pertama diterjemahkan tanpa istilah mesin",
  !jelaskanGalatPoin(salahSaldo.errors[0], {
    poinDipakai: 10,
    poinTersedia: 7,
  }).includes("poin_dipakai"),
);

// Kasir mengetik 3 poin, di bawah minimum.
const salahMinimum = hitungPoinTransaksi({
  total: 47000,
  diskon: 0,
  poin_dipakai: 3,
  poin_tersedia: 7,
});
cek("hitungan menandai galat saat di bawah minimum", salahMinimum.errors.length > 0);

// Rincian benar: tidak ada galat, tombol boleh menyala.
const benar = hitungPoinTransaksi({
  total: 47000,
  diskon: 0,
  poin_dipakai: 5,
  poin_tersedia: 7,
});
cek("rincian yang benar tidak memunculkan galat", benar.errors.length === 0);
cek(
  "aturan BR-TRX-05 tetap berlaku: 47.000 tukar 5 poin tetap dapat 2 poin",
  benar.poin_didapat === 2,
  String(benar.poin_didapat),
);

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===\n`);
process.exitCode = gagal === 0 ? 0 : 1;
