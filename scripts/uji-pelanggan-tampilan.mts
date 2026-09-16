/**
 * Uji logika tampilan halaman Pelanggan (src/lib/pelanggan-tampilan.ts).
 *
 * YANG PALING PENTING DIUJI
 * Lencana status dipakai kasir/owner sebagai daftar kerja: "siapa yang perlu
 * disapa hari ini". Kalau salah, yang muncul bisa orang yang baru kemarin
 * datang, sementara pelanggan yang sudah dua bulan hilang tidak terlihat.
 * Jadi urutan prioritas lencana diuji satu per satu, termasuk kasus batas
 * tepat di angka 30 dan 45 hari.
 *
 * Tanggal "hari ini" SELALU disuntikkan, tidak diambil dari jam sistem,
 * supaya hasil ujinya sama kapan pun dijalankan. Uji yang bergantung jam
 * sistem akan lulus hari ini dan gagal bulan depan.
 *
 * Jalankan: npx tsx scripts/uji-pelanggan-tampilan.mts
 */
import {
  AMBANG_KELOMPOK,
  bersaldo,
  BATAS_AKTIF_HARI,
  BATAS_SEPI_HARI,
  hangusTerdekat,
  hitungPerLencana,
  hitungRingkasan,
  hurufAwal,
  inisialPelanggan,
  kelompokkanHuruf,
  kelompokkanPerPelanggan,
  keteranganArsip,
  lencanaPelanggan,
  pisahkanArsip,
  ringkasHalaman,
  ringkasPemeriksaan,
  rupiahPenuh,
  rupiahRingkas,
  saringLencana,
  SARINGAN_PELANGGAN,
  selisihHari,
  sudahDiarsipkan,
  TINGGI_BARIS_PX,
  tanggalIndonesia,
  tanggalSingkat,
  tanggalUltah,
  terakhirDatang,
  terjemahLedger,
  ultahBulanIni,
  warnaAvatar,
  type BarisLedger,
  type BarisTransaksi,
} from "../src/lib/pelanggan-tampilan.ts";

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

/** Hari ini selalu tetap: 14 September 2026. */
const HARI_INI = new Date("2026-09-14T10:00:00");
/** Bantu bikin tanggal N hari sebelum HARI_INI. */
function hariLalu(n: number): string {
  const d = new Date(HARI_INI);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ======================= tanggalIndonesia =======================
sama("tanggal lahir dibaca Indonesia", tanggalIndonesia("2004-11-09"), "9 November 2004");
sama("tanggal kosong jujur", tanggalIndonesia(null), "Belum diisi");
sama("tanggal ngawur dikembalikan apa adanya", tanggalIndonesia("bukan-tanggal"), "bukan-tanggal");

// ======================= tanggalSingkat =======================
// Sengaja pakai tengah hari waktu setempat, bukan "Z": stempel "T19:14:00Z"
// itu pukul 02.14 WIB hari berikutnya, jadi hasilnya "15 Sep" dan itu BENAR.
// Hari kerja kafe berlangsung siang, jadi jam 11.00 adalah waktu yang wajar.
sama("stempel waktu jadi tanggal ringkas", tanggalSingkat("2026-09-14T11:14:00"), "14 Sep 2026");

// ======================= inisialPelanggan =======================
sama("inisial dua kata", inisialPelanggan("Budi Santoso"), "BS");
sama("inisial satu kata", inisialPelanggan("Anggara"), "AN");
sama("inisial tiga kata ambil tepi", inisialPelanggan("Manda Ayu Lestari"), "ML");
sama("inisial nama kosong", inisialPelanggan(""), "?");
sama("inisial nama berspasi saja", inisialPelanggan("   "), "?");
sama("inisial spasi berlebih", inisialPelanggan("  Budi   Santoso  "), "BS");

// ======================= warnaAvatar =======================
sama("warna avatar stabil untuk nama sama", warnaAvatar("Anggara"), warnaAvatar("Anggara"));
sama("warna avatar nama kosong tetap valid", warnaAvatar(""), "terra");
sama(
  "warna avatar beda-beda antar nama",
  new Set(["Anggara", "Budi Santoso", "Sinta", "Dewi", "Rizky", "Agus"].map(warnaAvatar)).size > 1,
  true,
);

// ======================= selisihHari =======================
sama("selisih hari nol untuk hari ini", selisihHari("2026-09-14T08:00:00", HARI_INI), 0);
sama("selisih hari satu", selisihHari(hariLalu(1), HARI_INI), 1);
sama("selisih hari lima", selisihHari(hariLalu(5), HARI_INI), 5);
sama("selisih hari tidak dikenali -> null", selisihHari("ngawur", HARI_INI), null);
// Jam tidak boleh menggeser hitungan hari.
sama(
  "jam 23.59 kemarin tetap terhitung 1 hari",
  selisihHari("2026-09-13T23:59:00", HARI_INI),
  1,
);
sama(
  "jam 00.01 hari ini tetap terhitung 0 hari",
  selisihHari("2026-09-14T00:01:00", HARI_INI),
  0,
);

// ======================= terakhirDatang =======================
sama("terakhir datang hari ini", terakhirDatang("2026-09-14T09:00:00", HARI_INI), "hari ini");
sama("terakhir datang kemarin", terakhirDatang(hariLalu(1), HARI_INI), "kemarin");
sama("terakhir datang 5 hari lalu", terakhirDatang(hariLalu(5), HARI_INI), "5 hari lalu");
sama("terakhir datang 13 hari masih hitungan hari", terakhirDatang(hariLalu(13), HARI_INI), "13 hari lalu");
sama(
  "terakhir datang 14 hari ganti ke tanggal",
  terakhirDatang(hariLalu(14), HARI_INI),
  tanggalSingkat(hariLalu(14)),
);
sama("belum pernah datang", terakhirDatang(null, HARI_INI), "Belum pernah");

// ======================= rupiahRingkas =======================
sama("rupiah di bawah seribu polos", rupiahRingkas(500), "500");
sama("rupiah ribuan", rupiahRingkas(179000), "179rb");
sama("rupiah 1 juta lebih", rupiahRingkas(1250000), "1,3jt");
sama("rupiah 12 juta dibulatkan", rupiahRingkas(12400000), "12jt");
sama("rupiah nol", rupiahRingkas(0), "0");
sama("rupiah negatif jadi nol", rupiahRingkas(-5000), "0");
sama("rupiah nilai bukan angka jadi nol", rupiahRingkas(Number.NaN), "0");
sama("rupiah tepat 1000", rupiahRingkas(1000), "1rb");

// ======================= hitungRingkasan =======================
const TRANSAKSI: (BarisTransaksi & { pelanggan_id?: string })[] = [
  { id: "t1", total: 32000, created_at: "2026-09-14T11:15:00Z", dicatat_oleh_nama: null, external_ref: null },
  { id: "t2", total: 100000, created_at: "2026-09-14T11:33:00Z", dicatat_oleh_nama: null, external_ref: null },
  { id: "t3", total: 47000, created_at: "2026-09-14T12:14:00Z", dicatat_oleh_nama: null, external_ref: null },
];
const ringkas = hitungRingkasan(TRANSAKSI);
sama("kunjungan dihitung dari transaksi", ringkas.kunjungan, 3);
sama("total belanja dijumlahkan", ringkas.totalBelanja, 179000);
sama("rata-rata dibulatkan", ringkas.rataRata, 59667);
sama("kunjungan terakhir = transaksi terbaru", ringkas.terakhirIso, "2026-09-14T12:14:00Z");
sama("riwayat terbaru lebih dulu", ringkas.riwayat.map((t) => t.id), ["t3", "t2", "t1"]);
sama("ringkasan tanpa transaksi aman", hitungRingkasan([]).kunjungan, 0);
sama("rata-rata tanpa transaksi nol, bukan NaN", hitungRingkasan([]).rataRata, 0);
sama("kunjungan terakhir tanpa transaksi null", hitungRingkasan([]).terakhirIso, null);
sama(
  "input null tidak bikin error",
  hitungRingkasan(null as unknown as BarisTransaksi[]).kunjungan,
  0,
);

// ======================= kelompokkanPerPelanggan =======================
const peta = kelompokkanPerPelanggan([
  { ...TRANSAKSI[0], pelanggan_id: "A" },
  { ...TRANSAKSI[1], pelanggan_id: "B" },
  { ...TRANSAKSI[2], pelanggan_id: "A" },
  { ...TRANSAKSI[0], id: "t4", pelanggan_id: null },
]);
sama("pelanggan A dapat 2 transaksi", peta.get("A")?.length, 2);
sama("pelanggan B dapat 1 transaksi", peta.get("B")?.length, 1);
sama("transaksi tanpa pelanggan tidak dikelompokkan", peta.has(""), false);
sama("tidak ada pelanggan hantu", peta.size, 2);

// ======================= lencanaPelanggan =======================
// Belum pernah transaksi.
sama(
  "belum pernah transaksi dapat lencana sendiri",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 0, terakhirIso: null }, HARI_INI),
  { teks: "Belum transaksi", jenis: "belum" },
);

// Sudah lama tidak datang. Batas 45 hari.
sama(
  "tepat 45 hari sudah disebut sepi",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 5, terakhirIso: hariLalu(BATAS_SEPI_HARI) }, HARI_INI).jenis,
  "sepi",
);
sama(
  "44 hari belum disebut sepi",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 5, terakhirIso: hariLalu(BATAS_SEPI_HARI - 1) }, HARI_INI).jenis !== "sepi",
  true,
);
sama(
  "60 hari jadi 'Sudah 2 bulan'",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 5, terakhirIso: hariLalu(60) }, HARI_INI).teks,
  "Sudah 2 bulan",
);
sama(
  "50 hari masih hitungan hari",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 5, terakhirIso: hariLalu(50) }, HARI_INI).teks,
  "Sudah 50 hari",
);

// Sepi mengalahkan ultah: yang perlu dihubungi muncul dulu.
sama(
  "pelanggan sepi yang ultah tetap tampil sepi",
  lencanaPelanggan(
    { tgl_lahir: "1995-09-21", kunjungan: 5, terakhirIso: hariLalu(90) },
    HARI_INI,
  ).jenis,
  "sepi",
);

// Baru: satu kunjungan.
sama(
  "satu kunjungan dapat lencana Baru",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 1, terakhirIso: hariLalu(2) }, HARI_INI),
  { teks: "Baru", jenis: "baru" },
);

// Ultah mengalahkan Aktif, tapi tidak mengalahkan Baru.
sama(
  "ulang tahun bulan ini terlihat",
  lencanaPelanggan({ tgl_lahir: "1995-09-21", kunjungan: 7, terakhirIso: hariLalu(3) }, HARI_INI).jenis,
  "ultah",
);
sama(
  "pelanggan baru yang ultah tetap disebut Baru",
  lencanaPelanggan({ tgl_lahir: "1995-09-21", kunjungan: 1, terakhirIso: hariLalu(2) }, HARI_INI).jenis,
  "baru",
);

// Aktif.
sama(
  "datang 3 hari lalu dan sering -> Aktif",
  lencanaPelanggan({ tgl_lahir: "1990-01-05", kunjungan: 7, terakhirIso: hariLalu(3) }, HARI_INI),
  { teks: "Aktif", jenis: "aktif" },
);
sama(
  "tepat 30 hari masih Aktif",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 7, terakhirIso: hariLalu(BATAS_AKTIF_HARI) }, HARI_INI).jenis,
  "aktif",
);

// Tanggal terakhir tidak diketahui: jangan menebak sepi.
sama(
  "tanggal terakhir kosong tidak ditebak jadi sepi",
  lencanaPelanggan({ tgl_lahir: null, kunjungan: 4, terakhirIso: null }, HARI_INI).jenis,
  "aktif",
);

// ======================= ultahBulanIni =======================
sama("ultah September cocok", ultahBulanIni("1995-09-21", HARI_INI), true);
sama("ultah Agustus tidak cocok", ultahBulanIni("1995-08-21", HARI_INI), false);
sama("ultah kosong tidak cocok", ultahBulanIni(null, HARI_INI), false);
sama("ultah ngawur tidak cocok", ultahBulanIni("99-99-99", HARI_INI), false);
sama("tanggal ultah dalam bulan", tanggalUltah("1995-09-21", HARI_INI), 21);
sama("tanggal ultah di luar bulan -> null", tanggalUltah("1995-08-21", HARI_INI), null);

// ======================= ringkasHalaman =======================
const PENUH = [
  { tgl_lahir: "1990-01-05", kunjungan: 3, terakhirIso: hariLalu(0), poin: 7 },
  { tgl_lahir: "1995-09-21", kunjungan: 11, terakhirIso: hariLalu(3), poin: 24 },
  { tgl_lahir: "1988-02-02", kunjungan: 9, terakhirIso: hariLalu(60), poin: 31 },
];
const kepala = ringkasHalaman(PENUH, HARI_INI);
sama("kepala: total pelanggan", kepala.total, 3);
sama("kepala: hitung yang perlu disapa", kepala.perluDisapa, 1);
sama("kepala: hitung ultah bulan ini", kepala.ultahBulanIni, 1);
sama("kepala: poin beredar dijumlahkan", kepala.poinBeredar, 62);
sama(
  "kepala: kalimat lengkap",
  kepala.teks,
  "3 pelanggan terdaftar, 1 perlu disapa, 1 ultah bulan ini",
);
sama(
  "kepala: tanpa yang perlu disapa kalimatnya bersih",
  ringkasHalaman([PENUH[0], PENUH[1]], HARI_INI).teks,
  "2 pelanggan terdaftar, 1 ultah bulan ini",
);
sama(
  "kepala: kosong jujur",
  ringkasHalaman([], HARI_INI).teks,
  "Belum ada pelanggan tercatat",
);

// ======================= terjemahLedger =======================
const LEDGER: BarisLedger[] = [
  {
    id: "l1",
    tipe: "earn",
    poin_masuk: 5,
    poin_keluar: 0,
    sisa: 5,
    kedaluwarsa_pada: "2027-09-14",
    keterangan: null,
    created_at: "2026-09-14T11:33:00Z",
  },
  {
    id: "l2",
    tipe: "redeem",
    poin_masuk: 0,
    poin_keluar: 10,
    sisa: 0,
    kedaluwarsa_pada: null,
    keterangan: null,
    created_at: "2026-09-10T10:00:00Z",
  },
  {
    id: "l3",
    tipe: "expire",
    poin_masuk: 0,
    poin_keluar: 3,
    sisa: 0,
    kedaluwarsa_pada: null,
    keterangan: null,
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "l4",
    tipe: "adjust",
    poin_masuk: 0,
    poin_keluar: 2,
    sisa: 0,
    kedaluwarsa_pada: null,
    keterangan: "Koreksi salah input kasir",
    created_at: "2026-07-01T10:00:00Z",
  },
];
sama("ledger earn: judul Indonesia", terjemahLedger(LEDGER[0]).judul, "Poin masuk");
sama("ledger earn: jumlah bertanda plus", terjemahLedger(LEDGER[0]).jumlah, "+5");
sama(
  "ledger earn: masa hangus disebut bulannya",
  terjemahLedger(LEDGER[0]).keterangan,
  "Hangus Sep 2027 kalau tidak dipakai",
);
sama("ledger redeem: judul Indonesia", terjemahLedger(LEDGER[1]).judul, "Poin dipakai");
sama("ledger redeem: jumlah bertanda minus", terjemahLedger(LEDGER[1]).jumlah, "-10");
sama("ledger expire: judul Indonesia", terjemahLedger(LEDGER[2]).judul, "Poin hangus");
sama("ledger adjust: keterangan asli dipakai", terjemahLedger(LEDGER[3]).keterangan, "Koreksi salah input kasir");
sama("ledger adjust minus kalau poin keluar", terjemahLedger(LEDGER[3]).jumlah, "-2");
sama(
  "istilah database tidak bocor ke tampilan",
  ["earn", "redeem", "expire", "adjust"].some((istilah) =>
    LEDGER.map(terjemahLedger).some(
      (h) => h.judul.includes(istilah) || h.keterangan.includes(istilah),
    ),
  ),
  false,
);
sama(
  "jenis ledger ngawur tidak ditebak",
  terjemahLedger({
    id: "x",
    tipe: "entah",
    poin_masuk: 4,
    poin_keluar: 0,
    sisa: 4,
    kedaluwarsa_pada: null,
    keterangan: null,
    created_at: "2026-09-01T10:00:00Z",
  }).judul,
  "Perubahan poin",
);

// ======================= hangusTerdekat =======================
sama(
  "hangus terdekat diambil dari yang paling awal",
  hangusTerdekat(
    [
      { ...LEDGER[0], kedaluwarsa_pada: "2027-09-14", sisa: 5 },
      { ...LEDGER[0], id: "l9", kedaluwarsa_pada: "2027-03-14", sisa: 2 },
    ],
    HARI_INI,
  ),
  "2027-03-14",
);
sama("masa hangus yang masih berlaku ditemukan", hangusTerdekat(LEDGER, HARI_INI), "2027-09-14");
sama(
  "poin yang sudah hangus dilewati, bukan dipilih",
  hangusTerdekat(
    [
      { ...LEDGER[0], kedaluwarsa_pada: "2020-01-01", sisa: 5 },
      { ...LEDGER[0], id: "l8", kedaluwarsa_pada: "2027-05-01", sisa: 3 },
    ],
    HARI_INI,
  ),
  "2027-05-01",
);
sama(
  "poin masuk tanpa masa hangus dilewati",
  hangusTerdekat([{ ...LEDGER[0], kedaluwarsa_pada: null }], HARI_INI),
  null,
);
sama("semua poin sudah hangus -> null", hangusTerdekat([{ ...LEDGER[0], kedaluwarsa_pada: "2020-01-01" }], HARI_INI), null);
sama(
  "sisa nol tidak dihitung walaupun tanggalnya masih depan",
  hangusTerdekat([{ ...LEDGER[0], kedaluwarsa_pada: "2027-01-01", sisa: 0 }], HARI_INI),
  null,
);
sama(
  "baris redeem tidak dihitung masa hangus",
  hangusTerdekat([{ ...LEDGER[1], kedaluwarsa_pada: "2027-01-01" }], HARI_INI),
  null,
);


// ======================= rupiahPenuh =======================
sama("rupiah penuh pakai pemisah ribuan", rupiahPenuh(7000), "Rp 7.000");
sama("rupiah penuh nol", rupiahPenuh(0), "Rp 0");
sama("rupiah penuh jutaan", rupiahPenuh(1250000), "Rp 1.250.000");
sama("rupiah penuh dibulatkan ke rupiah", rupiahPenuh(59667.4), "Rp 59.667");
sama("rupiah penuh nilai aneh jadi nol", rupiahPenuh(Number.NaN), "Rp 0");

// ======================= saringLencana =======================
// Tanggal acuan tetap, tidak diambil dari jam sistem, supaya uji ini tidak
// lulus hari ini lalu gagal bulan depan.
const ACUAN = new Date("2026-09-15T12:00:00");

const contohSaring = [
  // aktif: lebih dari satu kunjungan, baru saja datang
  { nama: "Anggara", tgl_lahir: "2004-11-09", kunjungan: 4, terakhirIso: "2026-09-15" },
  // baru: tepat satu kunjungan
  { nama: "Bayu", tgl_lahir: null, kunjungan: 1, terakhirIso: "2026-09-10" },
  // sepi: lewat dari batas 45 hari
  { nama: "Citra", tgl_lahir: null, kunjungan: 3, terakhirIso: "2026-06-01" },
  // belum transaksi
  { nama: "dewi", tgl_lahir: null, kunjungan: 0, terakhirIso: null },
  // ultah bulan ini, kunjungan lebih dari satu dan masih aktif
  { nama: "Eka", tgl_lahir: "2000-09-20", kunjungan: 5, terakhirIso: "2026-09-14" },
];

sama("tanpa penyaring, semua tampil", saringLencana(contohSaring, null, ACUAN).length, 5);
sama("penyaring sepi hanya ambil yang sepi", saringLencana(contohSaring, "sepi", ACUAN).length, 1);
sama(
  "penyaring sepi mengambil orang yang benar",
  saringLencana(contohSaring, "sepi", ACUAN)[0].nama,
  "Citra",
);
sama("penyaring belum transaksi", saringLencana(contohSaring, "belum", ACUAN).length, 1);
sama("penyaring baru", saringLencana(contohSaring, "baru", ACUAN).length, 1);
sama("penyaring ultah", saringLencana(contohSaring, "ultah", ACUAN).length, 1);
sama("penyaring aktif", saringLencana(contohSaring, "aktif", ACUAN).length, 1);
sama("daftar kosong tetap aman", saringLencana([], "sepi", ACUAN).length === 0, true);
sama(
  "menyaring tidak mengubah daftar asal",
  (() => {
    const salinan = [...contohSaring];
    saringLencana(contohSaring, "sepi", ACUAN);
    return contohSaring.length === salinan.length;
  })(),
  true,
);

// ======================= hitungPerLencana =======================
const jumlah = hitungPerLencana(contohSaring, ACUAN);
sama("jumlah semua lencana sama dengan jumlah pelanggan",
  jumlah.aktif + jumlah.baru + jumlah.sepi + jumlah.ultah + jumlah.belum, 5);
sama("hitung sepi", jumlah.sepi, 1);
sama("hitung belum transaksi", jumlah.belum, 1);
sama(
  "tiap jenis pada daftar penyaring punya kuncinya",
  SARINGAN_PELANGGAN.every((s) => typeof jumlah[s.jenis] === "number"),
  true,
);
sama("daftar kosong menghasilkan semua nol",
  Object.values(hitungPerLencana([], ACUAN)).reduce((a, b) => a + b, 0), 0);
sama(
  "jumlah penyaring cocok dengan hasil menyaring",
  SARINGAN_PELANGGAN.every(
    (s) => saringLencana(contohSaring, s.jenis, ACUAN).length === jumlah[s.jenis],
  ),
  true,
);

// Penyaring "Perlu disapa" harus lebih dulu: itu satu-satunya yang menuntut
// tindakan hari ini, sedangkan sisanya sekadar keterangan.
sama("perlu disapa berada di urutan pertama", SARINGAN_PELANGGAN[0].jenis, "sepi");

// ======================= hurufAwal & kelompokkanHuruf =======================
sama("huruf awal biasa", hurufAwal("Anggara"), "A");
sama("huruf awal huruf kecil dinaikkan", hurufAwal("dewi"), "D");
sama("nama berawalan spasi tetap terbaca", hurufAwal("  Budi"), "B");
sama("nama berawalan angka masuk pagar", hurufAwal("3 Saudara"), "#");
sama("nama kosong masuk pagar", hurufAwal(""), "#");
sama("nama berawalan tanda baca masuk pagar", hurufAwal("'Aisyah"), "#");

const kelompok = kelompokkanHuruf(contohSaring);
sama("kelompok terurut menaik",
  kelompok.map((k) => k.huruf).join("") === "ABCDE", true);
sama("jumlah anggota kelompok sama dengan jumlah pelanggan",
  kelompok.reduce((s, k) => s + k.isi.length, 0), 5);
sama(
  "pagar diletakkan paling akhir",
  (() => {
    const k = kelompokkanHuruf([{ nama: "9 Naga" }, { nama: "Adi" }]);
    return k[k.length - 1].huruf === "#";
  })(),
  true,
);
sama("daftar kosong menghasilkan nol kelompok", kelompokkanHuruf([]).length === 0, true);
sama(
  "nama berhuruf awal sama masuk kelompok yang sama",
  kelompokkanHuruf([{ nama: "Adi" }, { nama: "andi" }])[0].isi.length === 2,
  true,
);

// ======================= acuan tampilan =======================
sama("tinggi baris lebih padat daripada 76px sebelumnya", TINGGI_BARIS_PX < 76, true);
sama("tinggi baris tetap nyaman disentuh", TINGGI_BARIS_PX >= 44, true);
sama("ambang kelompok masuk akal", AMBANG_KELOMPOK >= 20 && AMBANG_KELOMPOK <= 60, true);

// ======================= bersaldo =======================
// Baris 'adjust' sempat diabaikan di enam berkas sekaligus, sehingga
// koreksi manual tidak pernah terhitung sebagai saldo pelanggan. Terbukti
// pada database nyata: menyisipkan adjust +3 tidak menaikkan saldo sama
// sekali, dan penukaran tetap ditolak karena dianggap tidak cukup.
sama("earn menambah saldo", bersaldo("earn"), true);
sama("adjust menambah saldo", bersaldo("adjust"), true);
sama("redeem tidak menyimpan saldo", bersaldo("redeem"), false);
sama("expire tidak menyimpan saldo", bersaldo("expire"), false);
sama("tipe asing tidak dianggap bersaldo", bersaldo("entah"), false);
sama("teks kosong tidak dianggap bersaldo", bersaldo(""), false);

// ======================= ringkasPemeriksaan =======================
sama("pembukuan bersih dinyatakan seimbang", ringkasPemeriksaan([]).seimbang, true);
sama(
  "kalimat seimbang tidak menakut nakuti",
  ringkasPemeriksaan([]).judul,
  "Pembukuan poin seimbang",
);
const TIMPANG1 = [
  { pelanggan_id: "a", nama: "Anggara", buku: 8, terpakai: 7, selisih: 1 },
];
sama("satu pelanggan timpang terdeteksi", ringkasPemeriksaan(TIMPANG1).seimbang, false);
sama(
  "namanya disebut saat hanya satu",
  ringkasPemeriksaan(TIMPANG1).judul.indexOf("Anggara") >= 0,
  true,
);
sama(
  "jumlah poin bermasalah disebutkan",
  ringkasPemeriksaan(TIMPANG1).rincian.indexOf("1 poin") >= 0,
  true,
);
const TIMPANG2 = [
  { pelanggan_id: "a", nama: "Anggara", buku: 8, terpakai: 7, selisih: 1 },
  { pelanggan_id: "b", nama: "Bayu", buku: 5, terpakai: 3, selisih: 2 },
];
sama(
  "dua pelanggan disebut sebagai jumlah, bukan nama",
  ringkasPemeriksaan(TIMPANG2).judul.indexOf("2 pelanggan") >= 0,
  true,
);
sama(
  "selisih dijumlahkan",
  ringkasPemeriksaan(TIMPANG2).rincian.indexOf("3 poin") >= 0,
  true,
);
// Selisih negatif juga masalah: sisa lebih besar daripada yang pernah masuk.
sama(
  "selisih negatif dihitung sebagai besarannya",
  ringkasPemeriksaan([
    { pelanggan_id: "c", nama: "Citra", buku: 3, terpakai: 5, selisih: -2 },
  ]).rincian.indexOf("2 poin") >= 0,
  true,
);
sama(
  "kalimat tidak menuduh poin hilang",
  ringkasPemeriksaan(TIMPANG1).rincian.indexOf("tidak hilang") >= 0,
  true,
);

// ======================= arsip pelanggan =======================
const AKTIF = { nama: "Anggara", diarsipkan_pada: null };
const DIARSIP = {
  nama: "Salah Input",
  diarsipkan_pada: "2026-09-14T10:00:00+00:00",
  alasan_arsip: "salah ketik nama",
};

sama("pelanggan biasa bukan arsip", sudahDiarsipkan(AKTIF), false);
sama("pelanggan diarsipkan terdeteksi", sudahDiarsipkan(DIARSIP), true);
sama("tanpa kolom arsip dianggap aktif", sudahDiarsipkan({}), false);

const pisah = pisahkanArsip([AKTIF, DIARSIP, { nama: "Bayu", diarsipkan_pada: null }]);
sama("yang aktif terkumpul", pisah.aktif.length, 2);
sama("yang diarsipkan terpisah", pisah.arsip.length, 1);
sama("arsip berisi orang yang benar", pisah.arsip[0].nama, "Salah Input");
sama(
  "tidak ada yang hilang saat dipisah",
  pisah.aktif.length + pisah.arsip.length,
  3,
);
sama("daftar kosong aman", pisahkanArsip([]).aktif.length, 0);

const ACUAN_ARSIP = new Date("2026-09-16T12:00:00+00:00");
sama("pelanggan aktif tidak punya keterangan arsip", keteranganArsip(AKTIF, ACUAN_ARSIP), "");
sama(
  "keterangan menyebut alasannya",
  keteranganArsip(DIARSIP, ACUAN_ARSIP).indexOf("salah ketik nama") >= 0,
  true,
);
sama(
  "diarsipkan hari ini ditulis hari ini",
  keteranganArsip(
    { diarsipkan_pada: "2026-09-16T08:00:00+00:00" },
    ACUAN_ARSIP,
  ),
  "Diarsipkan hari ini",
);
sama(
  "diarsipkan sehari lalu ditulis kemarin",
  keteranganArsip(
    { diarsipkan_pada: "2026-09-15T08:00:00+00:00" },
    ACUAN_ARSIP,
  ),
  "Diarsipkan kemarin",
);
sama(
  "tanpa alasan tetap menyebut waktunya",
  keteranganArsip(
    { diarsipkan_pada: "2026-09-10T08:00:00+00:00" },
    ACUAN_ARSIP,
  ),
  "Diarsipkan 6 hari lalu",
);
sama(
  "alasan berisi spasi saja diperlakukan seperti kosong",
  keteranganArsip(
    { diarsipkan_pada: "2026-09-16T08:00:00+00:00", alasan_arsip: "   " },
    ACUAN_ARSIP,
  ),
  "Diarsipkan hari ini",
);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
