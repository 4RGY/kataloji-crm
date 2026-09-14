/**
 * Uji logika tampilan Dashboard (src/lib/dashboard-tampilan.ts).
 *
 * YANG PALING PENTING DIUJI
 * Grafik jam ramai dipakai pemilik kedai untuk memutuskan jam staf dan jam
 * promo. Kalau jamnya salah karena memakai UTC, atau kalau jam kosong
 * dibuang sehingga batangnya tampak berdampingan, keputusannya jadi salah.
 * Dua hal itu diuji lebih dulu.
 *
 * Waktu "sekarang" selalu disuntikkan, tidak diambil dari jam sistem, supaya
 * hasil uji tidak berubah saat bulan berganti.
 */

import {
  JAM_MULAI,
  JAM_SELESAI,
  JUMLAH_JAM,
  sebaranJam,
  jamLokal,
  jamTeramai,
  ringkasJamTeramai,
  hitungPapanLoyalitas,
  hitungPoinDiberikan,
  angkaKunci,
  type BarisLedger,
  type BarisTransaksi,
} from "../src/lib/dashboard-tampilan";

let lulus = 0;
let gagal = 0;

function sama(nama: string, dapat: unknown, harap: unknown) {
  const a = JSON.stringify(dapat);
  const b = JSON.stringify(harap);
  if (a === b) {
    lulus++;
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}`);
    console.log(`         dapat: ${a}`);
    console.log(`         harap: ${b}`);
  }
}

function benar(nama: string, nilai: boolean) {
  sama(nama, nilai, true);
}

/** Bangun stempel waktu pada jam lokal tertentu. */
function padaJam(hari: number, jam: number, menit = 0): string {
  const d = new Date(2026, 8, hari, jam, menit, 0);
  return d.toISOString();
}

console.log("=== uji logika tampilan Dashboard ===\n");

// ======================= jamLokal =======================
// Harus jam dinding, bukan UTC. Kalau ini salah, seluruh grafik jam meleset.
benar(
  "jamLokal memakai jam lokal, bukan UTC",
  jamLokal(padaJam(14, 19, 14)) === 19,
);
benar("jamLokal tengah malam = 0", jamLokal(padaJam(14, 0, 5)) === 0);
benar("jamLokal siang = 12", jamLokal(padaJam(14, 12, 0)) === 12);
benar(
  "jamLokal menerima objek Date juga",
  jamLokal(new Date(2026, 8, 14, 7, 30)) === 7,
);
sama("jamLokal waktu tidak sah jadi 0", jamLokal("bukan-tanggal"), 0);

// ======================= sebaranJam: sumbu utuh =======================
const tigaJam18 = [
  { created_at: padaJam(14, 18, 10) },
  { created_at: padaJam(14, 18, 40) },
  { created_at: padaJam(14, 18, 55) },
];
const satuJam19 = [{ created_at: padaJam(14, 19, 14) }];
const data = [...tigaJam18, ...satuJam19];

const batang = sebaranJam(data);
sama("satu batang untuk setiap jam operasional", batang.length, JUMLAH_JAM);
sama("rentang jam mulai", batang[0].jam, JAM_MULAI);
sama("rentang jam selesai", batang[batang.length - 1].jam, JAM_SELESAI);

// Jam kosong WAJIB tetap ada. Kalau dibuang, jam 18 dan 19 jadi bersebelahan
// dan grafiknya memberi kesan dua jam berurutan padahal tidak ditampilkan.
const jam18 = batang.find((b) => b.jam === 18);
const jam19 = batang.find((b) => b.jam === 19);
const jam20 = batang.find((b) => b.jam === 20);
sama("jam 18 berisi 3 transaksi", jam18?.jumlah, 3);
sama("jam 19 berisi 1 transaksi", jam19?.jumlah, 1);
sama("jam 20 tetap ada walau kosong", jam20?.jumlah, 0);
benar("jam kosong porsinya 0", jam20?.porsi === 0);
benar("hanya jam teramai ditandai puncak", jam18?.puncak === true);
benar("jam 19 bukan puncak", jam19?.puncak === false);
sama("porsi jam teramai penuh", jam18?.porsi, 1);
sama("porsi jam 19 sepertiga", Number(jam19?.porsi.toFixed(4)), Number((1 / 3).toFixed(4)));

// Jam di luar rentang operasional tidak boleh hilang
const luarJam = sebaranJam([
  { created_at: padaJam(14, 3, 0) },
  { created_at: padaJam(14, 23, 0) },
]);
sama("jam di bawah rentang dilekatkan ke jam mulai", luarJam[0].jumlah, 1);
sama("jam di atas rentang dilekatkan ke jam selesai", luarJam[luarJam.length - 1].jumlah, 1);
sama("total tidak ada yang hilang", luarJam.reduce((s, b) => s + b.jumlah, 0), 2);

// Beberapa jam dengan jumlah sama: penanda puncak hanya satu
const seri = sebaranJam([
  { created_at: padaJam(14, 10) },
  { created_at: padaJam(14, 11) },
]);
sama("penanda puncak hanya satu saat seri", seri.filter((b) => b.puncak).length, 1);

// Belum ada transaksi sama sekali
const kosong = sebaranJam([]);
sama("tanpa transaksi tetap ada sumbu utuh", kosong.length, JUMLAH_JAM);
sama("tanpa transaksi semua nol", kosong.reduce((s, b) => s + b.jumlah, 0), 0);
benar("tanpa transaksi tidak ada puncak", kosong.every((b) => !b.puncak));

// ======================= jamTeramai + ringkasannya =======================
sama("jam teramai = 18", jamTeramai(batang)?.jam, 18);
sama("jam teramai saat kosong = null", jamTeramai(kosong), null);
sama("ringkasan menyebut jam dan jumlahnya", ringkasJamTeramai(batang), "Paling ramai 18.00, 3 transaksi");
sama(
  "ringkasan saat kosong mengaku belum ada transaksi",
  ringkasJamTeramai(kosong),
  "Belum ada transaksi pada periode ini",
);
// Jam satu digit harus tampil dua digit supaya kolomnya rata
const pagi = sebaranJam([{ created_at: padaJam(14, 8) }]);
sama("jam satu digit diberi nol depan", ringkasJamTeramai(pagi), "Paling ramai 08.00, 1 transaksi");

// ======================= hitungPapanLoyalitas =======================
const sekarang = new Date(2026, 8, 14, 20, 0, 0);
const hariIni = "2026-09-14";

function ledger(isi: Partial<BarisLedger>[]): BarisLedger[] {
  return isi.map((b) => ({
    pelanggan_id: "p1",
    tipe: "earn",
    poin_masuk: 0,
    poin_keluar: 0,
    sisa: 0,
    kedaluwarsa_pada: null,
    ...b,
  }));
}

// Poin beredar dihitung dari `sisa`, bukan dari poin_masuk. Poin yang sudah
// dipakai tetap tercatat di baris asalnya, jadi memakai poin_masuk akan
// menghitung poin yang sudah dipakai sebagai masih beredar.
sama(
  "poin beredar memakai kolom sisa, bukan poin_masuk",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 8, sisa: 3, kedaluwarsa_pada: "2027-09-14" }]),
    [],
    1,
    1_000,
    sekarang,
  ).poinBeredar,
  3,
);

// Baris redeem dan expire tidak menambah poin beredar
sama(
  "baris redeem tidak menambah poin beredar",
  hitungPapanLoyalitas(
    ledger([
      { poin_masuk: 8, sisa: 3, kedaluwarsa_pada: "2027-09-14" },
      { tipe: "redeem", poin_keluar: 5, sisa: 0 },
    ]),
    [],
    1,
    1_000,
    sekarang,
  ).poinBeredar,
  3,
);

// Poin yang tanggal hangusnya sudah lewat DIKECUALIKAN, sama seperti aturan
// saldo_poin() di database. Ini bukan pilihan gaya: kalau dihitung, angka di
// dashboard lebih besar daripada saldo yang nanti dipakai kasir saat menukar.
sama(
  "poin lewat tanggal hangus tidak ikut beredar",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 5, sisa: 5, kedaluwarsa_pada: "2026-01-01" }]),
    [],
    1,
    1_000,
    sekarang,
  ).poinBeredar,
  0,
);
sama(
  "poin yang hangus tepat hari ini juga tidak beredar",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 3, sisa: 3, kedaluwarsa_pada: hariIni }]),
    [],
    1,
    1_000,
    sekarang,
  ).poinBeredar,
  0,
);
sama(
  "poin yang hangus besok masih beredar",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 3, sisa: 3, kedaluwarsa_pada: "2026-09-15" }]),
    [],
    1,
    1_000,
    sekarang,
  ).poinBeredar,
  3,
);
sama(
  "poin yang sudah lewat tidak ikut dihitung akan hangus",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 5, sisa: 5, kedaluwarsa_pada: "2026-01-01" }]),
    [],
    1,
    1_000,
    sekarang,
  ).akanHangus,
  0,
);

// Batas hangus 60 hari dari sekarang (14 Sep 2026)
sama(
  "poin hangus dalam 60 hari dihitung",
  hitungPapanLoyalitas(
    ledger([
      { poin_masuk: 4, sisa: 4, kedaluwarsa_pada: "2026-10-01" },
      { poin_masuk: 9, sisa: 9, kedaluwarsa_pada: "2027-09-14" },
    ]),
    [],
    1,
    1_000,
    sekarang,
  ).akanHangus,
  4,
);
sama(
  "poin hangus tepat di batas 60 hari tetap dihitung",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2026-11-13" }]),
    [],
    1,
    1_000,
    sekarang,
  ).akanHangus,
  2,
);
sama(
  "poin hangus sehari setelah batas tidak dihitung",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2026-11-14" }]),
    [],
    1,
    1_000,
    sekarang,
  ).akanHangus,
  0,
);
sama(
  "poin tanpa tanggal hangus selalu beredar dan tidak akan hangus",
  (() => {
    const h = hitungPapanLoyalitas(
      ledger([{ poin_masuk: 6, sisa: 6, kedaluwarsa_pada: null }]),
      [],
      1,
      1_000,
      sekarang,
    );
    return [h.poinBeredar, h.akanHangus];
  })(),
  [6, 0],
);
sama(
  "nilai rupiah poin beredar ikut nilai poin",
  hitungPapanLoyalitas(
    ledger([{ poin_masuk: 8, sisa: 8, kedaluwarsa_pada: "2027-09-14" }]),
    [],
    1,
    1_000,
    sekarang,
  ).nilaiPoinBeredar,
  8_000,
);

// Pelanggan ulang dihitung per ORANG, bukan per transaksi
const transaksiUlang: BarisTransaksi[] = [
  { id: "t1", total: 47000, diskon: 0, poin_dipakai: 0, poin_didapat: 2, created_at: padaJam(14, 18), pelanggan_id: "p1" },
  { id: "t2", total: 100000, diskon: 0, poin_dipakai: 0, poin_didapat: 5, created_at: padaJam(14, 18), pelanggan_id: "p1" },
  { id: "t3", total: 32000, diskon: 0, poin_dipakai: 0, poin_didapat: 1, created_at: padaJam(14, 19), pelanggan_id: "p1" },
  { id: "t4", total: 20000, diskon: 0, poin_dipakai: 0, poin_didapat: 1, created_at: padaJam(14, 19), pelanggan_id: null },
];
sama(
  "pelanggan ulang dihitung per orang, bukan per transaksi",
  hitungPapanLoyalitas([], transaksiUlang, 1, 1_000, sekarang).pelangganUlang,
  1,
);
sama(
  "transaksi tanpa pelanggan tidak dihitung sebagai pelanggan",
  hitungPapanLoyalitas([], transaksiUlang, 1, 1_000, sekarang).pelangganTerdaftar,
  1,
);
sama(
  "tidak ada pelanggan ulang kalau semua hanya sekali",
  hitungPapanLoyalitas(
    [],
    [
      { id: "a", total: 1, diskon: 0, poin_dipakai: 0, poin_didapat: 0, created_at: padaJam(14, 18), pelanggan_id: "p1" },
      { id: "b", total: 1, diskon: 0, poin_dipakai: 0, poin_didapat: 0, created_at: padaJam(14, 18), pelanggan_id: "p2" },
    ],
    2,
    1_000,
    sekarang,
  ).pelangganUlang,
  0,
);

// ======================= hitungPoinDiberikan =======================
// Bug nyata yang ketangkep uji ini: transaksi TANPA pelanggan tetap menyimpan
// poin_didapat sebesar hasil hitungan, padahal trigger database berhenti lebih
// dulu dan tidak menulis baris poin apa pun ke buku besar. Menjumlahkannya
// mentah membuat kartu "Poin diberikan" lebih besar daripada isi buku besar.
const transaksiPoin: { pelanggan_id: string | null; poin_didapat: number }[] = [
  { pelanggan_id: "p1", poin_didapat: 1 },
  { pelanggan_id: null, poin_didapat: 1 },
  { pelanggan_id: "p1", poin_didapat: 5 },
  { pelanggan_id: "p1", poin_didapat: 2 },
];
sama(
  "poin diberikan hanya dari transaksi berpelanggan",
  hitungPoinDiberikan(transaksiPoin),
  8,
);
sama(
  "transaksi tanpa pelanggan tidak menyumbang poin",
  hitungPoinDiberikan([{ pelanggan_id: null, poin_didapat: 99 }]),
  0,
);
sama("tanpa transaksi poin diberikan nol", hitungPoinDiberikan([]), 0);
sama(
  "poin nol tetap nol",
  hitungPoinDiberikan([{ pelanggan_id: "p1", poin_didapat: 0 }]),
  0,
);

// ======================= angkaKunci =======================
const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
const papan = hitungPapanLoyalitas(
  ledger([{ poin_masuk: 8, sisa: 8, kedaluwarsa_pada: "2027-09-14" }]),
  transaksiUlang,
  1,
  1_000,
  sekarang,
);
const kartu = angkaKunci(transaksiUlang, papan, 7, 1_000, rp);
sama("ada empat kartu angka kunci", kartu.length, 4);
sama("kartu 1 label", kartu[0].label, "Per transaksi");
sama("rata-rata per transaksi", kartu[0].nilai, rp(199000 / 4));
sama("kartu 2 transaksi terbesar", kartu[1].nilai, rp(100_000));
sama("kartu 3 poin beredar", kartu[2].nilai, "8");
sama("kartu 3 keterangan nilai rupiah", kartu[2].keterangan, "senilai Rp 8.000");
sama("kartu 4 hari ada transaksi", kartu[3].nilai, "1");
sama("kartu 4 keterangan dibanding periode", kartu[3].keterangan, "dari 7 hari");

// Potongan poin mengurangi omzet bersih, diskon juga
const adaPotongan: BarisTransaksi[] = [
  { id: "x", total: 100000, diskon: 10000, poin_dipakai: 5, poin_didapat: 4, created_at: padaJam(14, 18), pelanggan_id: "p1" },
];
sama(
  "omzet bersih dikurangi diskon dan potongan poin",
  angkaKunci(adaPotongan, papan, 1, 1_000, rp)[0].nilai,
  rp(85_000),
);
sama(
  "nilai poin yang berbeda ikut mengubah hitungan",
  angkaKunci(adaPotongan, papan, 1, 2_000, rp)[0].nilai,
  rp(80_000),
);

// Tidak ada transaksi: jangan menghasilkan NaN
const nol = angkaKunci([], papan, 7, 1_000, rp);
sama("tanpa transaksi rata-rata nol, bukan NaN", nol[0].nilai, rp(0));
sama("tanpa transaksi hari nol", nol[3].nilai, "0");
benar("tidak ada NaN di kartu angka", !nol.some((k) => k.nilai.includes("NaN") || k.keterangan.includes("NaN")));

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
