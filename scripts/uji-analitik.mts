/**
 * Uji logika halaman Analitik.
 *
 * Yang paling penting diuji di sini bukan rumusnya, tapi penahanan dirinya.
 * Dengan lima transaksi, hampir semua angka terlihat meyakinkan padahal tidak
 * berarti apa-apa. Ambang keyakinan harus benar-benar menahan pola dari
 * ditampilkan, dan jam teramai harus mengembalikan null saat terjadi seri.
 *
 * Jalankan: npx tsx scripts/uji-analitik.mts
 */

import {
  AMBANG_HARI,
  AMBANG_POLA,
  BATAS_KELOMPOK,
  hariBeroperasi,
  jamTeramai,
  JAM_BUKA,
  labelJam,
  nilaiBersih,
  periksaKeyakinan,
  ringkasPelanggan,
  sebaranBelanja,
  sebaranHari,
  sebaranJam,
  tinggiBatang,
  ultahBulanIni,
  type TransaksiAnalitik,
} from "../src/lib/analitik.ts";

let lulus = 0;
let gagal = 0;

function sama(label: string, dapat: unknown, harus: unknown) {
  if (JSON.stringify(dapat) === JSON.stringify(harus)) {
    lulus++;
  } else {
    gagal++;
    console.log(
      "FAIL  " + label +
      "\n      dapat : " + JSON.stringify(dapat) +
      "\n      harus : " + JSON.stringify(harus),
    );
  }
}

const NILAI_POIN = 1000;

function trx(p: Partial<TransaksiAnalitik>): TransaksiAnalitik {
  return {
    total: 0,
    diskon: 0,
    poin_dipakai: 0,
    pelanggan_id: null,
    created_at: "2026-09-15T18:00:00",
    ...p,
  };
}

// ===================== nilaiBersih =====================
sama("nilai tanpa potongan", nilaiBersih(trx({ total: 50000 }), NILAI_POIN), 50000);
sama("diskon mengurangi", nilaiBersih(trx({ total: 50000, diskon: 5000 }), NILAI_POIN), 45000);
sama("poin mengurangi sesuai nilainya", nilaiBersih(trx({ total: 50000, poin_dipakai: 5 }), NILAI_POIN), 45000);
sama("diskon dan poin sekaligus", nilaiBersih(trx({ total: 50000, diskon: 5000, poin_dipakai: 5 }), NILAI_POIN), 40000);
sama("tidak pernah negatif", nilaiBersih(trx({ total: 10000, diskon: 99000 }), NILAI_POIN), 0);
sama("nilai bukan angka aman", nilaiBersih(trx({ total: Number.NaN }), NILAI_POIN), 0);

// ===================== periksaKeyakinan =====================
// Ini inti halaman: menahan pola yang belum layak dibaca.
const kurang = periksaKeyakinan(5, AMBANG_POLA);
sama("lima transaksi belum cukup", kurang.cukup, false);
sama("pesan menyebut angka nyata, bukan 'data belum cukup'", kurang.pesan.includes("15"), true);
sama("pesan menyebut satuannya", kurang.pesan.includes("transaksi"), true);

const pas = periksaKeyakinan(AMBANG_POLA, AMBANG_POLA);
sama("tepat di ambang sudah cukup", pas.cukup, true);
sama("saat cukup tidak ada pesan penahan", pas.pesan, "");
sama("di atas ambang cukup", periksaKeyakinan(100, AMBANG_POLA).cukup, true);
sama("nol transaksi tidak cukup", periksaKeyakinan(0, AMBANG_POLA).cukup, false);
sama("nilai negatif dianggap nol", periksaKeyakinan(-5, AMBANG_POLA).jumlah, 0);
sama("satuan bisa diganti", periksaKeyakinan(2, 7, "hari").pesan.includes("hari"), true);
sama("ambang pola masuk akal", AMBANG_POLA >= 15 && AMBANG_POLA <= 50, true);
sama("ambang hari minimal seminggu", AMBANG_HARI >= 7, true);

// ===================== sebaranJam =====================
const trxJam = [
  trx({ total: 47000, created_at: "2026-09-15T11:02:00" }),
  trx({ total: 32000, created_at: "2026-09-14T18:15:00" }),
  trx({ total: 100000, created_at: "2026-09-14T18:33:00" }),
  trx({ total: 32000, created_at: "2026-09-14T18:26:00" }),
  trx({ total: 47000, created_at: "2026-09-14T19:14:00" }),
];

const jam = sebaranJam(trxJam, NILAI_POIN);
sama("sumbu memakai jam buka saja", jam.length, JAM_BUKA.selesai - JAM_BUKA.mulai + 1);
sama("jam pertama adalah jam buka", jam[0].jam, JAM_BUKA.mulai);
sama("jam 18 punya tiga transaksi", jam.find((j) => j.jam === 18)?.jumlah, 3);
sama("jam 18 menjumlah omzetnya", jam.find((j) => j.jam === 18)?.omzet, 164000);
sama("jam 11 punya satu", jam.find((j) => j.jam === 11)?.jumlah, 1);
sama("jam kosong tetap ada di sumbu", jam.find((j) => j.jam === 9)?.jumlah, 0);
sama(
  "transaksi di luar jam buka tidak merusak",
  sebaranJam([trx({ total: 5000, created_at: "2026-09-15T03:00:00" })], NILAI_POIN)
    .reduce((n, j) => n + j.jumlah, 0),
  0,
);
sama(
  "tanggal ngawur dilewati",
  sebaranJam([trx({ created_at: "bukan-tanggal" })], NILAI_POIN).reduce((n, j) => n + j.jumlah, 0),
  0,
);

// ===================== jamTeramai =====================
sama("jam teramai ditemukan", jamTeramai(jam)?.jam, 18);
sama("daftar kosong menghasilkan null", jamTeramai([]), null);
sama(
  "semua nol menghasilkan null",
  jamTeramai([{ jam: 8, jumlah: 0, omzet: 0 }, { jam: 9, jumlah: 0, omzet: 0 }]),
  null,
);
// Seri TIDAK boleh menghasilkan pemenang: angka ini dipakai menyusun jadwal staf.
sama(
  "seri tidak menghasilkan pemenang",
  jamTeramai([{ jam: 8, jumlah: 3, omzet: 1 }, { jam: 9, jumlah: 3, omzet: 2 }]),
  null,
);
sama(
  "pemenang tunggal tetap terbaca walau ada seri di bawahnya",
  jamTeramai([
    { jam: 8, jumlah: 5, omzet: 1 },
    { jam: 9, jumlah: 2, omzet: 2 },
    { jam: 10, jumlah: 2, omzet: 3 },
  ])?.jam,
  8,
);

// ===================== sebaranHari =====================
const hari = sebaranHari(trxJam, NILAI_POIN);
sama("tujuh hari selalu tampil", hari.length, 7);
sama("senin diletakkan lebih dulu", hari[0].nama, "Senin");
sama("minggu diletakkan terakhir", hari[6].nama, "Minggu");
sama("senin punya empat transaksi", hari.find((h) => h.nama === "Senin")?.jumlah, 4);
sama("selasa punya satu", hari.find((h) => h.nama === "Selasa")?.jumlah, 1);
sama("hari tanpa transaksi tetap nol", hari.find((h) => h.nama === "Rabu")?.jumlah, 0);

// ===================== sebaranBelanja =====================
const belanja = sebaranBelanja(
  [
    trx({ total: 20000 }),
    trx({ total: 32000 }),
    trx({ total: 47000 }),
    trx({ total: 75000 }),
    trx({ total: 150000 }),
  ],
  NILAI_POIN,
);
sama("empat kelompok", belanja.length, BATAS_KELOMPOK.length);
sama("di bawah 25rb", belanja[0].jumlah, 1);
sama("25rb sampai 50rb", belanja[1].jumlah, 2);
sama("50rb sampai 100rb", belanja[2].jumlah, 1);
sama("100rb ke atas", belanja[3].jumlah, 1);
// Batas bawah termasuk, batas atas tidak. Tanpa aturan ini, transaksi tepat
// 50rb bisa terhitung dua kali atau hilang sama sekali.
sama("nilai tepat di batas masuk kelompok atasnya", sebaranBelanja([trx({ total: 50000 })], NILAI_POIN)[2].jumlah, 1);
sama("nilai tepat di batas tidak dobel", sebaranBelanja([trx({ total: 50000 })], NILAI_POIN)[1].jumlah, 0);
sama(
  "jumlah kelompok sama dengan jumlah transaksi",
  belanja.reduce((n, k) => n + k.jumlah, 0),
  5,
);
sama("daftar kosong tetap empat kelompok kosong", sebaranBelanja([], NILAI_POIN).every((k) => k.jumlah === 0), true);

// ===================== ringkasPelanggan =====================
const rp = ringkasPelanggan(
  [
    trx({ total: 47000, pelanggan_id: "p1" }),
    trx({ total: 32000, pelanggan_id: "p1" }),
    trx({ total: 100000, pelanggan_id: null }),
    trx({ total: 32000, pelanggan_id: null }),
  ],
  NILAI_POIN,
);
sama("total transaksi", rp.totalTransaksi, 4);
sama("berpelanggan", rp.berpelanggan, 2);
sama("tanpa pelanggan", rp.tanpaPelanggan, 2);
sama("persen tertaut", rp.persenTertaut, 50);
sama("omzet berpelanggan", rp.omzetBerpelanggan, 79000);
sama("omzet tanpa pelanggan", rp.omzetTanpaPelanggan, 132000);
sama("daftar kosong tidak menghasilkan NaN", ringkasPelanggan([], NILAI_POIN).persenTertaut, 0);
sama(
  "jumlah dua sisi selalu sama dengan total",
  rp.berpelanggan + rp.tanpaPelanggan,
  rp.totalTransaksi,
);

// ===================== ultahBulanIni =====================
const ACUAN = new Date("2026-09-15T12:00:00");
const orang = [
  { id: "1", nama: "Anggara", tgl_lahir: "2004-11-09", created_at: "2026-01-01" },
  { id: "2", nama: "Bayu", tgl_lahir: "2000-09-20", created_at: "2026-01-01" },
  { id: "3", nama: "Citra", tgl_lahir: "1999-09-03", created_at: "2026-01-01" },
  { id: "4", nama: "Dewi", tgl_lahir: null, created_at: "2026-01-01" },
];
sama("hanya yang ultah bulan ini", ultahBulanIni(orang, ACUAN).length, 2);
sama("diurutkan dari tanggal terkecil", ultahBulanIni(orang, ACUAN)[0].nama, "Citra");
sama("tanpa tanggal lahir dilewati", ultahBulanIni(orang, ACUAN).some((x) => x.nama === "Dewi"), false);
sama("daftar kosong aman", ultahBulanIni([], ACUAN).length, 0);
sama(
  "tanggal lahir ngawur dilewati",
  ultahBulanIni([{ id: "x", nama: "X", tgl_lahir: "bukan", created_at: "" }], ACUAN).length,
  0,
);

// ===================== hariBeroperasi =====================
sama("dua tanggal berbeda", hariBeroperasi(trxJam), 2);
sama("daftar kosong nol hari", hariBeroperasi([]), 0);
sama(
  "transaksi pada tanggal sama dihitung satu",
  hariBeroperasi([
    trx({ created_at: "2026-09-15T08:00:00" }),
    trx({ created_at: "2026-09-15T20:00:00" }),
  ]),
  1,
);

// ===================== tinggiBatang & labelJam =====================
sama("batang penuh", tinggiBatang(100, 100), 100);
sama("batang separuh", tinggiBatang(50, 100), 50);
sama("nilai nol", tinggiBatang(0, 100), 0);
sama("pembagi nol tidak menghasilkan NaN", tinggiBatang(50, 0), 0);
sama("tidak melebihi seratus", tinggiBatang(200, 100), 100);
sama("tidak negatif", tinggiBatang(-50, 100), 0);
sama("label jam dua digit", labelJam(9), "09.00");
sama("label jam sore", labelJam(18), "18.00");

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
