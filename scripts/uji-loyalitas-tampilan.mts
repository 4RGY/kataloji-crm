/**
 * Uji logika halaman Loyalitas.
 *
 * Titik paling rawan di sini adalah aturan hangus. Database memakai
 * `kedaluwarsa_pada > current_date`, sehingga poin yang jatuh tempo TEPAT
 * HARI INI sudah tidak terhitung. Kalau berkas ini memakai `>=`, layar akan
 * menampilkan saldo lebih besar daripada saldo resmi dan kasir menjanjikan
 * potongan yang ditolak database.
 *
 * Tanggal acuan selalu disuntikkan, tidak pernah diambil dari jam sistem,
 * supaya uji yang lulus hari ini tidak gagal bulan depan.
 *
 * Jalankan: npx tsx scripts/uji-loyalitas-tampilan.mts
 */

import {
  awalHari,
  daftarAkanHangus,
  hariMenuju,
  kalimatLoyalitas,
  labelTipe,
  masihBerlaku,
  MIN_TUKAR,
  ringkasLoyalitas,
  riwayatLoyalitas,
  tanggalDari,
  tautanPengingat,
  TENGGAT_HANGUS,
  type BarisLedgerLoyalitas,
  type PelangganRingkas,
} from "../src/lib/loyalitas-tampilan";

let lulus = 0;
let gagal = 0;

function sama(label: string, dapat: unknown, harus: unknown) {
  const cocok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (cocok) {
    lulus++;
    console.log(`PASS  ${label}`);
  } else {
    gagal++;
    console.log(`FAIL  ${label}\n        dapat = ${JSON.stringify(dapat)}\n        harus = ${JSON.stringify(harus)}`);
  }
}

const NILAI_POIN = 1_000;
const HARI_INI = new Date("2026-09-15T14:30:00");

/** Bantu membuat baris buku besar tanpa menulis semua kolom tiap kali. */
let urut = 0;
function baris(p: Partial<BarisLedgerLoyalitas>): BarisLedgerLoyalitas {
  urut += 1;
  return {
    id: `b${urut}`,
    pelanggan_id: "p1",
    transaksi_id: `t${urut}`,
    tipe: "earn",
    poin_masuk: 0,
    poin_keluar: 0,
    sisa: 0,
    kedaluwarsa_pada: null,
    keterangan: "",
    created_at: "2026-09-15T10:00:00+07:00",
    ...p,
  };
}

const ORANG: PelangganRingkas[] = [
  { id: "p1", nama: "Anggara", whatsapp: "6285156803978" },
  { id: "p2", nama: "Bayu", whatsapp: "628111222333" },
  { id: "p3", nama: "Citra", whatsapp: "" },
];

console.log("\n=== 1. Tanggal dan ambang hangus ===\n");

sama("awal hari membuang jam", awalHari(HARI_INI).getHours(), 0);
sama("tanggal dari teks kosong", tanggalDari(null), null);
sama("tanggal dari teks ngawur", tanggalDari("bukan-tanggal"), null);
sama("hari menuju besok", hariMenuju("2026-09-16", HARI_INI), 1);
sama("hari menuju hari ini", hariMenuju("2026-09-15", HARI_INI), 0);
sama("hari menuju kemarin", hariMenuju("2026-09-14", HARI_INI), -1);
sama("hari menuju sebulan lagi", hariMenuju("2026-10-15", HARI_INI), 30);
sama("hari menuju tanggal kosong", hariMenuju(null, HARI_INI), null);

console.log("\n=== 2. masihBerlaku mengikuti aturan database ===\n");

sama(
  "poin hangus BESOK masih berlaku",
  masihBerlaku(baris({ sisa: 5, kedaluwarsa_pada: "2026-09-16" }), HARI_INI),
  true,
);
sama(
  "poin hangus TEPAT HARI INI sudah tidak berlaku",
  masihBerlaku(baris({ sisa: 5, kedaluwarsa_pada: "2026-09-15" }), HARI_INI),
  false,
);
sama(
  "poin hangus kemarin sudah tidak berlaku",
  masihBerlaku(baris({ sisa: 5, kedaluwarsa_pada: "2026-09-14" }), HARI_INI),
  false,
);
sama(
  "poin tanpa tanggal hangus selalu berlaku",
  masihBerlaku(baris({ sisa: 3, kedaluwarsa_pada: null }), HARI_INI),
  true,
);
sama(
  "baris penukaran bukan sisa poin",
  masihBerlaku(baris({ tipe: "redeem", poin_keluar: 5, sisa: 0 }), HARI_INI),
  false,
);
sama(
  "baris bersisa nol tidak dihitung",
  masihBerlaku(baris({ sisa: 0, kedaluwarsa_pada: "2027-01-01" }), HARI_INI),
  false,
);

console.log("\n=== 3. Ringkasan pokok ===\n");

const bukuBesar: BarisLedgerLoyalitas[] = [
  baris({ pelanggan_id: "p1", poin_masuk: 5, sisa: 0, kedaluwarsa_pada: "2027-09-14", created_at: "2026-09-14T11:33:00+07:00" }),
  baris({ pelanggan_id: "p1", poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2027-09-14", created_at: "2026-09-14T12:14:00+07:00" }),
  baris({ pelanggan_id: "p1", tipe: "redeem", poin_keluar: 5, sisa: 0, created_at: "2026-09-15T11:02:00+07:00", keterangan: "Penukaran poin di kasir" }),
  baris({ pelanggan_id: "p1", poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2027-09-15", created_at: "2026-09-15T11:02:00+07:00" }),
  baris({ pelanggan_id: "p2", poin_masuk: 3, sisa: 3, kedaluwarsa_pada: "2026-10-10", created_at: "2026-09-01T09:00:00+07:00" }),
];

const r = ringkasLoyalitas(bukuBesar, NILAI_POIN, HARI_INI);
sama("poin beredar dijumlah dari sisa yang berlaku", r.poinBeredar, 7);
sama("nilai rupiah mengikuti poin beredar", r.nilaiRupiah, 7_000);
sama("poin diterbitkan menjumlah semua poin masuk", r.poinDiterbitkan, 12);
sama("poin ditukar dibaca dari baris redeem", r.poinDitukar, 5);
sama("pemilik poin dihitung unik", r.pemilikPoin, 2);
sama("tingkat penukaran dibulatkan", r.tingkatPenukaran, 42);

const kosong = ringkasLoyalitas([], NILAI_POIN, HARI_INI);
sama("buku besar kosong tidak menghasilkan NaN", kosong.poinBeredar, 0);
sama("tingkat penukaran tanpa penerbitan adalah nol", kosong.tingkatPenukaran, 0);
sama("nilai rupiah kosong", kosong.nilaiRupiah, 0);

// Poin yang tanggalnya sudah lewat tetapi sisanya belum dinolkan trigger
// harus tercatat sebagai hangus, bukan sebagai beredar.
const adaKedaluwarsa = ringkasLoyalitas(
  [baris({ poin_masuk: 4, sisa: 4, kedaluwarsa_pada: "2026-09-01" })],
  NILAI_POIN,
  HARI_INI,
);
sama("poin lewat tanggal tidak dihitung beredar", adaKedaluwarsa.poinBeredar, 0);
sama("poin lewat tanggal dihitung hangus", adaKedaluwarsa.poinHangus, 4);

sama(
  "tingkat penukaran tidak pernah melebihi seratus",
  ringkasLoyalitas(
    [
      baris({ poin_masuk: 2, sisa: 0 }),
      baris({ tipe: "redeem", poin_keluar: 99 }),
    ],
    NILAI_POIN,
    HARI_INI,
  ).tingkatPenukaran,
  100,
);

// ── Pemeriksaan kejujuran angka ──
// Buku besar yang sehat: aritmetikanya nyambung, jadi selisihnya nol.
const sehat = ringkasLoyalitas(
  [
    baris({ poin_masuk: 5, sisa: 0 }),
    baris({ tipe: "redeem", poin_keluar: 5 }),
    baris({ poin_masuk: 3, sisa: 3, kedaluwarsa_pada: "2027-01-01" }),
  ],
  NILAI_POIN,
  HARI_INI,
);
sama("buku besar sehat tidak punya selisih", sehat.selisihTakDikenal, 0);

// Kasus nyata dari data awal proyek: satu batch sisanya dinolkan tanpa baris
// penukaran pendamping, sehingga ada poin yang lenyap tanpa jejak.
const adaLenyap = ringkasLoyalitas(
  [
    baris({ poin_masuk: 1, sisa: 0 }), // dinolkan tanpa redeem pendamping
    baris({ poin_masuk: 5, sisa: 0 }),
    baris({ tipe: "redeem", poin_keluar: 5 }),
    baris({ poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2027-09-14" }),
  ],
  NILAI_POIN,
  HARI_INI,
);
sama("poin yang lenyap tanpa jejak terdeteksi", adaLenyap.selisihTakDikenal, 1);
sama("saldo yang dilaporkan tetap yang benar", adaLenyap.poinBeredar, 2);
sama("buku besar kosong tidak melaporkan selisih palsu", kosong.selisihTakDikenal, 0);

console.log("\n=== 4. Daftar poin akan hangus ===\n");

const hangus30 = daftarAkanHangus(bukuBesar, ORANG, 30, NILAI_POIN, HARI_INI);
sama("hanya Bayu yang hangus dalam 30 hari", hangus30.length, 1);
sama("nama pemilik ikut terbawa", hangus30[0].nama, "Bayu");
sama("poinnya benar", hangus30[0].poin, 3);
sama("nilai rupiahnya benar", hangus30[0].nilaiRupiah, 3_000);
sama("sisa hari dihitung", hangus30[0].sisaHari, 25);

sama(
  "tenggat 90 hari tetap hanya Bayu karena sisanya tahun depan",
  daftarAkanHangus(bukuBesar, ORANG, 90, NILAI_POIN, HARI_INI).length,
  1,
);
sama(
  "tenggat 10 hari tidak menangkap siapa pun",
  daftarAkanHangus(bukuBesar, ORANG, 10, NILAI_POIN, HARI_INI).length,
  0,
);

// Dua batch milik orang yang sama harus digabung, dengan tenggat terdekat.
const duaBatch = daftarAkanHangus(
  [
    baris({ pelanggan_id: "p1", poin_masuk: 3, sisa: 3, kedaluwarsa_pada: "2026-10-01" }),
    baris({ pelanggan_id: "p1", poin_masuk: 4, sisa: 4, kedaluwarsa_pada: "2026-09-20" }),
  ],
  ORANG,
  30,
  NILAI_POIN,
  HARI_INI,
);
sama("dua batch satu orang digabung jadi satu baris", duaBatch.length, 1);
sama("poinnya dijumlah", duaBatch[0].poin, 7);
sama("tenggat memakai yang paling dekat", duaBatch[0].tanggal, "2026-09-20");
sama("sisa hari mengikuti tenggat terdekat", duaBatch[0].sisaHari, 5);

// Urutan adalah daftar kerja: paling mendesak lebih dulu.
const urutan = daftarAkanHangus(
  [
    baris({ pelanggan_id: "p1", poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2026-10-05" }),
    baris({ pelanggan_id: "p2", poin_masuk: 9, sisa: 9, kedaluwarsa_pada: "2026-09-18" }),
  ],
  ORANG,
  30,
  NILAI_POIN,
  HARI_INI,
);
sama("yang paling dekat hangus muncul lebih dulu", urutan[0].nama, "Bayu");

// Tenggat sama, poin lebih besar lebih dulu karena paling rugi bila hangus.
const seri = daftarAkanHangus(
  [
    baris({ pelanggan_id: "p1", poin_masuk: 2, sisa: 2, kedaluwarsa_pada: "2026-09-20" }),
    baris({ pelanggan_id: "p2", poin_masuk: 8, sisa: 8, kedaluwarsa_pada: "2026-09-20" }),
  ],
  ORANG,
  30,
  NILAI_POIN,
  HARI_INI,
);
sama("tenggat sama, poin terbesar lebih dulu", seri[0].nama, "Bayu");

sama(
  "poin yang sudah lewat tidak masuk daftar kerja",
  daftarAkanHangus(
    [baris({ pelanggan_id: "p1", poin_masuk: 5, sisa: 5, kedaluwarsa_pada: "2026-09-01" })],
    ORANG,
    30,
    NILAI_POIN,
    HARI_INI,
  ).length,
  0,
);
sama(
  "poin tanpa pemilik tidak masuk daftar kerja",
  daftarAkanHangus(
    [baris({ pelanggan_id: null, poin_masuk: 5, sisa: 5, kedaluwarsa_pada: "2026-09-20" })],
    ORANG,
    30,
    NILAI_POIN,
    HARI_INI,
  ).length,
  0,
);
sama(
  "pelanggan yang sudah dihapus tetap ditandai jujur",
  daftarAkanHangus(
    [baris({ pelanggan_id: "entah", poin_masuk: 5, sisa: 5, kedaluwarsa_pada: "2026-09-20" })],
    ORANG,
    30,
    NILAI_POIN,
    HARI_INI,
  )[0].nama,
  "Pelanggan tidak dikenal",
);

console.log("\n=== 5. Riwayat pergerakan poin ===\n");

const riwayat = riwayatLoyalitas(bukuBesar, ORANG);
sama("semua baris ikut tampil", riwayat.length, 5);
sama("terbaru berada di urutan pertama", riwayat[0].waktu, "2026-09-15T11:02:00+07:00");
sama("nama pelanggan tersisip", riwayat[0].nama, "Anggara");
sama(
  "baris penukaran ditandai keluar",
  riwayat.find((x) => x.tipe === "redeem")?.arah,
  "keluar",
);
sama(
  "baris penerbitan ditandai masuk",
  riwayat.find((x) => x.tipe === "earn")?.arah,
  "masuk",
);
sama(
  "pelanggan tanpa identitas ditandai jujur",
  riwayatLoyalitas([baris({ pelanggan_id: null, poin_masuk: 1 })], ORANG)[0].nama,
  "Tanpa pelanggan",
);
sama(
  "pemilik yang sudah dihapus ditandai jujur",
  riwayatLoyalitas([baris({ pelanggan_id: "hilang", poin_masuk: 1 })], ORANG)[0].nama,
  "Pelanggan sudah dihapus",
);
sama("buku besar kosong menghasilkan riwayat kosong", riwayatLoyalitas([], ORANG).length, 0);

console.log("\n=== 6. Label tipe dalam bahasa pemilik ===\n");

sama("label earn", labelTipe("earn"), "Poin masuk");
sama("label redeem", labelTipe("redeem"), "Poin dipakai");
sama("label expire", labelTipe("expire"), "Poin hangus");
sama("label adjust", labelTipe("adjust"), "Penyesuaian");
sama("tipe tak dikenal tidak ditampilkan mentah", labelTipe("zzz_aneh"), "Pergerakan poin");

console.log("\n=== 7. Kalimat pembuka menyesuaikan keadaan ===\n");

sama(
  "belum ada poin sama sekali",
  kalimatLoyalitas(kosong, 0, 30).includes("Belum ada poin"),
  true,
);
sama(
  "ada yang mendesak disebut lebih dulu",
  kalimatLoyalitas(r, 1, 30).includes("hangus dalam 30 hari"),
  true,
);
sama(
  "tidak ada yang mendesak",
  kalimatLoyalitas(r, 0, 30).includes("Tidak ada yang mendesak"),
  true,
);
sama(
  "kalimat tidak pernah memuat istilah mesin",
  /ledger|null|undefined|NaN/.test(kalimatLoyalitas(r, 1, 30)),
  false,
);

console.log("\n=== 8. Pengingat WhatsApp ===\n");

const target = hangus30[0];
const tautan = tautanPengingat(target);
sama("tautan memakai wa.me", tautan?.startsWith("https://wa.me/628111222333"), true);
sama("pesan menyebut nama", decodeURIComponent(tautan ?? "").includes("Bayu"), true);
sama("pesan menyebut jumlah poin", decodeURIComponent(tautan ?? "").includes("3"), true);
sama(
  "pesan menyebut tanggal berlaku",
  decodeURIComponent(tautan ?? "").includes("Oktober"),
  true,
);
sama(
  "pesan tidak memuat istilah mesin",
  /ledger|null|undefined|NaN/.test(decodeURIComponent(tautan ?? "")),
  false,
);
sama(
  "pelanggan tanpa nomor tidak menghasilkan tautan mati",
  tautanPengingat({
    pelanggan_id: "p3",
    nama: "Citra",
    whatsapp: "",
    poin: 5,
    nilaiRupiah: 5_000,
    tanggal: "2026-10-01",
    sisaHari: 16,
  }),
  null,
);

console.log("\n=== 9. Tetapan ===\n");

sama("tenggat yang ditawarkan", [...TENGGAT_HANGUS], [30, 60, 90]);
sama("minimum tukar sama dengan aturan bisnis", MIN_TUKAR, 5);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
