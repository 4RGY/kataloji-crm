/**
 * Uji hitungan laporan penjualan.
 *
 * Yang paling penting diuji di sini: rumus omzet bersih HARUS sama dengan
 * Dashboard dan Analitik (total - diskon - potongan poin). Sebelumnya halaman
 * laporan penjualan hanya mengurangi diskon, jadi begitu ada pembayaran pakai
 * poin, laporan ini akan menyebut angka lebih besar daripada dashboard.
 *
 * Waktu tidak pernah diambil dari jam sistem: tanggal transaksi ditulis
 * langsung di data uji supaya hasilnya tidak berubah saat hari berganti.
 */

import { NILAI_POIN } from "../src/lib/poin";
import { nilaiBersih } from "../src/lib/analitik";
import {
  ringkasPenjualan,
  labelTanggal,
  type TransaksiPenjualan,
} from "../src/lib/laporan-penjualan";

let lulus = 0;
let gagal = 0;

function sama(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (ok) {
    lulus++;
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}\n    dapat: ${JSON.stringify(dapat)}\n    harap: ${JSON.stringify(harap)}`);
  }
}

function benar(nama: string, nilai: boolean) {
  sama(nama, nilai, true);
}

function trx(isi: Partial<TransaksiPenjualan>): TransaksiPenjualan {
  return {
    total: 50_000,
    diskon: 0,
    poin_dipakai: 0,
    created_at: "2026-10-03T13:17:00",
    tanggal_majoo: null,
    source: "crm_manual",
    ...isi,
  };
}

console.log("=== uji hitungan laporan penjualan ===\n");

// ===================== labelTanggal =====================
sama("label tanggal tidak bergeser zona waktu", labelTanggal("2026-10-03"), "3 Okt 2026");
sama("label tanggal awal bulan", labelTanggal("2026-01-01"), "1 Jan 2026");
sama("label tanggal akhir bulan", labelTanggal("2026-12-31"), "31 Des 2026");
sama("kunci rusak dikembalikan apa adanya", labelTanggal("bukan-tanggal"), "bukan-tanggal");

// ===================== rumus omzet =====================
// Inti perbaikan. Transaksi dengan poin: dulu laporan ini melaporkan 50.000,
// dashboard melaporkan 45.000 untuk transaksi yang sama.
const adaPoin = [
  trx({ total: 50_000, diskon: 0, poin_dipakai: 5 }),
  trx({ total: 30_000, diskon: 10_000, poin_dipakai: 0 }),
];
const rPoin = ringkasPenjualan(adaPoin, NILAI_POIN);
sama("omzet kotor tidak dikurangi apa pun", rPoin.bruto, 80_000);
sama("diskon dijumlah terpisah", rPoin.diskon, 10_000);
sama("potongan poin dihitung 5 x 1.000", rPoin.potonganPoin, 5_000);
sama("omzet bersih mengurangi diskon DAN poin", rPoin.omzet, 65_000);
sama(
  "bruto - diskon - poin = bersih",
  rPoin.bruto - rPoin.diskon - rPoin.potonganPoin,
  rPoin.omzet,
);

// Rumus laporan harus identik dengan Dashboard/Analitik per transaksi.
for (const t of adaPoin) {
  const lewatLaporan = ringkasPenjualan([t], NILAI_POIN).omzet;
  sama(
    `rumus sama dengan nilaiBersih untuk total ${t.total}`,
    lewatLaporan,
    nilaiBersih(t, NILAI_POIN),
  );
}

// Tanpa poin, hasilnya tetap sama seperti sebelumnya (diskon saja).
const tanpaPoin = [trx({ total: 100_000, diskon: 25_000 })];
sama("tanpa poin, bersih = total - diskon", ringkasPenjualan(tanpaPoin, NILAI_POIN).omzet, 75_000);
sama("tanpa poin, potongan poin nol", ringkasPenjualan(tanpaPoin, NILAI_POIN).potonganPoin, 0);

// Diskon dan poin tidak boleh menghasilkan angka minus.
const lebih = [trx({ total: 10_000, diskon: 20_000, poin_dipakai: 50 })];
sama("diskon berlebih tidak bikin omzet minus", ringkasPenjualan(lebih, NILAI_POIN).omzet, 0);

// ===================== rata-rata =====================
const rRata = ringkasPenjualan(
  [trx({ total: 10_000 }), trx({ total: 21_000 })],
  NILAI_POIN,
);
sama("jumlah transaksi dihitung", rRata.jumlah, 2);
sama("rata-rata per transaksi dibulatkan", rRata.rataRata, 15_500);
sama("tanpa transaksi rata-rata nol", ringkasPenjualan([], NILAI_POIN).rataRata, 0);
sama("tanpa transaksi jumlah nol", ringkasPenjualan([], NILAI_POIN).jumlah, 0);
sama("tanpa transaksi hari jualan nol", ringkasPenjualan([], NILAI_POIN).hariJualan, 0);

// ===================== rincian per hari =====================
const tiga = [
  trx({ total: 20_000, created_at: "2026-10-03T10:00:00" }),
  trx({ total: 30_000, created_at: "2026-10-03T15:00:00" }),
  trx({ total: 50_000, created_at: "2026-10-02T11:00:00" }),
];
const rHari = ringkasPenjualan(tiga, NILAI_POIN);
sama("dua hari berbeda terbentuk", rHari.harian.length, 2);
sama("hari terbaru di atas", rHari.harian[0].tgl, "2026-10-03");
sama("omzet hari 3 Okt digabung", rHari.harian[0].omzet, 50_000);
sama("transaksi hari 3 Okt digabung", rHari.harian[0].jumlah, 2);
sama("label hari siap tampil", rHari.harian[0].tglLabel, "3 Okt 2026");
sama("hari jualan dihitung dari hari yang ada", rHari.hariJualan, 2);
sama("rata-rata per hari jualan", rHari.rataPerHariJualan, 50_000);

// ===================== transaksi impor Majoo =====================
// Impor H+1: created_at adalah waktu impor, hari laporannya tanggal_majoo.
const impor = [
  trx({
    total: 40_000,
    created_at: "2026-10-04T09:48:00",
    tanggal_majoo: "2026-10-03",
    source: "majoo_import",
  }),
  trx({ total: 10_000, created_at: "2026-10-03T13:17:00", source: "majoo_parallel" }),
];
const rImpor = ringkasPenjualan(impor, NILAI_POIN);
sama("impor masuk ke tanggal transaksinya", rImpor.harian[0].tgl, "2026-10-03");
sama("impor dan manual tergabung di hari yang sama", rImpor.harian[0].jumlah, 2);
sama("kedua transaksi tetap dihitung", rImpor.jumlah, 2);

// ===================== tanggal rusak =====================
// Tetap dihitung di total, tetapi tidak menciptakan hari palsu.
const rusak = [trx({ total: 15_000, tanggal_majoo: "bukan-tanggal", created_at: "juga-bukan" })];
const rRusak = ringkasPenjualan(rusak, NILAI_POIN);
sama("tanggal rusak tetap masuk omzet", rRusak.omzet, 15_000);
sama("tanggal rusak tetap masuk jumlah", rRusak.jumlah, 1);
sama("tanggal rusak tidak membuat hari palsu", rRusak.harian.length, 0);

// ===================== hari terbaik =====================
const rTerbaik = ringkasPenjualan(
  [
    trx({ total: 10_000, created_at: "2026-10-01T10:00:00" }),
    trx({ total: 90_000, created_at: "2026-10-02T10:00:00" }),
    trx({ total: 40_000, created_at: "2026-10-03T10:00:00" }),
  ],
  NILAI_POIN,
);
sama("hari terbaik adalah omzet tertinggi", rTerbaik.hariTerbaik?.tgl, "2026-10-02");
benar("hanya satu hari ditandai terbaik", rTerbaik.harian.filter((h) => h.terbaik).length === 1);
benar(
  "hari terbaik ada di daftar harian",
  rTerbaik.harian.some((h) => h.tgl === "2026-10-02" && h.terbaik),
);

// Satu hari jualan saja: penanda "terbaik" tidak berguna, jadi jangan dipasang.
const satuHari = ringkasPenjualan([trx({ created_at: "2026-10-03T10:00:00" })], NILAI_POIN);
sama("satu hari jualan tidak punya hari terbaik", satuHari.hariTerbaik, null);
benar("tidak ada penanda terbaik saat cuma sehari", satuHari.harian.every((h) => !h.terbaik));

// Tanpa transaksi sama sekali.
const kosong = ringkasPenjualan([], NILAI_POIN);
sama("kosong tanpa hari terbaik", kosong.hariTerbaik, null);
sama("kosong tanpa rincian hari", kosong.harian.length, 0);

// ===================== nilaiPoin ikut dipakai =====================
// Kalau nilai poin berubah, laporan harus ikut berubah, bukan diam-diam
// memakai angka 1.000 yang ditulis di dalam fungsi.
const nilaiLain = ringkasPenjualan([trx({ total: 50_000, poin_dipakai: 5 })], 2_000);
sama("potongan poin memakai nilai poin yang diberikan", nilaiLain.potonganPoin, 10_000);
sama("omzet bersih ikut nilai poin yang diberikan", nilaiLain.omzet, 40_000);

// ===================== data kosong/null =====================
sama("daftar kosong tidak error", ringkasPenjualan([], NILAI_POIN).omzet, 0);
sama(
  "diskon null dianggap nol",
  ringkasPenjualan([trx({ total: 20_000, diskon: null })], NILAI_POIN).diskon,
  0,
);
sama(
  "poin null dianggap nol",
  ringkasPenjualan([trx({ total: 20_000, poin_dipakai: null })], NILAI_POIN).potonganPoin,
  0,
);

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exit(gagal > 0 ? 1 : 0);
