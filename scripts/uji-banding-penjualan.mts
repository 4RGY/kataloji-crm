// ============================================================
// Uji perbandingan periode laporan penjualan
// ============================================================
// Fokus: memastikan "naik/turun" tidak pernah menipu. Yang paling penting
// adalah tepi-tepi: bulan tidak sama panjang, hari yang belum selesai, dan
// periode pembanding yang kosong (harus "tanpa data", bukan turun 100 persen).
//
// Jalankan: npx tsx scripts/uji-banding-penjualan.mts

import {
  periodeMasihBerjalan,
  rentangPeriode,
  rentangSebelumnya,
  saringPeriode,
} from "../src/lib/periode-laporan.ts";
import {
  bandingPenjualan,
  ringkasPenjualan,
  type TransaksiPenjualan,
} from "../src/lib/laporan-penjualan.ts";

let lulus = 0;
let gagal = 0;

function cek(nama: string, dapat: unknown, harap: unknown) {
  const a = JSON.stringify(dapat);
  const b = JSON.stringify(harap);
  if (a === b) {
    lulus++;
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}\n         dapat: ${a}\n         harap: ${b}`);
  }
}

const NILAI_POIN = 1000;
const KINI = new Date(2026, 9, 12, 17, 30); // 12 Okt 2026, 17:30 waktu lokal

/** Transaksi manual pada tanggal tertentu (YYYY-MM-DD) dengan total tertentu. */
function trx(tgl: string, total: number, ekstra: Partial<TransaksiPenjualan> = {}): TransaksiPenjualan {
  const [y, m, d] = tgl.split("-").map(Number);
  return {
    total,
    diskon: 0,
    poin_dipakai: 0,
    created_at: new Date(y, m - 1, d, 12, 0).toISOString(),
    tanggal_majoo: null,
    source: "crm_manual",
    ...ekstra,
  };
}

function kunci(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

console.log("=== 1. rentangSebelumnya: tiap jenis ===");

{
  const r = rentangSebelumnya({ jenis: "hari_ini" }, KINI)!;
  cek("hari_ini -> kemarin", [kunci(r.dari), kunci(r.sampai)], ["2026-10-11", "2026-10-12"]);
}
{
  const r = rentangSebelumnya({ jenis: "kemarin" }, KINI)!;
  cek("kemarin -> sehari sebelum", [kunci(r.dari), kunci(r.sampai)], ["2026-10-10", "2026-10-11"]);
}
{
  // 12 Okt 2026 adalah Senin. Minggu lalu = Senin 5 Okt sampai Minggu 11 Okt.
  const r = rentangSebelumnya({ jenis: "minggu_ini" }, KINI)!;
  cek("minggu_ini -> minggu lalu", [kunci(r.dari), kunci(r.sampai)], ["2026-10-05", "2026-10-12"]);
}
{
  const r = rentangSebelumnya({ jenis: "bulan_ini" }, KINI)!;
  cek("bulan_ini -> bulan lalu", [kunci(r.dari), kunci(r.sampai)], ["2026-09-01", "2026-10-01"]);
}
{
  const r = rentangSebelumnya({ jenis: "tanggal", tanggal: "2026-10-12" }, KINI)!;
  cek("tanggal -> sehari sebelumnya", [kunci(r.dari), kunci(r.sampai)], ["2026-10-11", "2026-10-12"]);
}
cek("tanggal rusak -> null", rentangSebelumnya({ jenis: "tanggal", tanggal: "2026-02-31" }, KINI), null);

console.log("=== 2. Jebakan panjang bulan (Oktober 31 hari) ===");
{
  // Kalau mundur "31 hari" dari 1 Oktober, hasilnya 31 Agustus. Yang benar:
  // bulan lalu selalu mulai tanggal 1 September.
  const r = rentangSebelumnya({ jenis: "bulan_ini" }, KINI)!;
  cek("1 Okt mundur bukan 31 Agustus", kunci(r.dari), "2026-09-01");
  const lamaHari = Math.round((r.sampai.getTime() - r.dari.getTime()) / 86400000);
  cek("bulan lalu September = 30 hari", lamaHari, 30);
}
{
  // Maret 2026: mundur dari 1 Maret ke 1 Februari (28 hari di 2026).
  const r = rentangSebelumnya({ jenis: "bulan_ini" }, new Date(2026, 2, 15))!;
  cek("Maret -> Februari", [kunci(r.dari), kunci(r.sampai)], ["2026-02-01", "2026-03-01"]);
}
{
  // Januari: bulan lalu harus Desember tahun sebelumnya, bukan Januari tahun ini.
  const r = rentangSebelumnya({ jenis: "bulan_ini" }, new Date(2026, 0, 10))!;
  cek("Januari -> Desember tahun lalu", [kunci(r.dari), kunci(r.sampai)], ["2025-12-01", "2026-01-01"]);
}

console.log("=== 3. periodeMasihBerjalan ===");
cek("hari_ini berjalan", periodeMasihBerjalan({ jenis: "hari_ini" }, KINI), true);
cek("minggu_ini berjalan", periodeMasihBerjalan({ jenis: "minggu_ini" }, KINI), true);
cek("bulan_ini berjalan", periodeMasihBerjalan({ jenis: "bulan_ini" }, KINI), true);
cek("kemarin sudah selesai", periodeMasihBerjalan({ jenis: "kemarin" }, KINI), false);
cek("tanggal lampau sudah selesai", periodeMasihBerjalan({ jenis: "tanggal", tanggal: "2026-09-20" }, KINI), false);
cek("tanggal hari ini masih berjalan", periodeMasihBerjalan({ jenis: "tanggal", tanggal: "2026-10-12" }, KINI), true);
cek("tanggal besok masih berjalan", periodeMasihBerjalan({ jenis: "tanggal", tanggal: "2026-10-13" }, KINI), true);

console.log("=== 4. bandingPenjualan: kasus normal ===");
{
  // Bulan ini (Okt sampai 12): 100rb + 50rb = 150rb dari 2 transaksi.
  // Bulan lalu (Sep): 100rb dari 1 transaksi. Naik 50rb = +50%.
  const data = [
    trx("2026-10-02", 100_000),
    trx("2026-10-05", 50_000),
    trx("2026-09-10", 100_000),
  ];
  const r = rentangPeriode({ jenis: "bulan_ini" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("tanpaData", b.tanpaData, false);
  cek("omzet pembanding", b.sebelumnya?.omzet, 100_000);
  cek("selisih", b.selisih, 50_000);
  cek("persen", b.persen, 50);
  cek("belumSelesai diteruskan", b.belumSelesai, true);
  cek("bulan ini bukan tidakSetara (bukan hari_ini)", b.tidakSetara, false);
}

console.log("=== 5. bandingPenjualan: turun ===");
{
  const data = [trx("2026-10-02", 40_000), trx("2026-09-10", 100_000)];
  const r = rentangPeriode({ jenis: "bulan_ini" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("selisih negatif", b.selisih, -60_000);
  cek("persen negatif", b.persen, -60);
}

console.log("=== 6. Jebakan: periode pembanding kosong BUKAN turun 100% ===");
{
  // Kasus nyata di data Kataloji: September tidak punya transaksi sama sekali.
  const data = [trx("2026-10-02", 93_000)];
  const r = rentangPeriode({ jenis: "bulan_ini" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("tanpaData true", b.tanpaData, true);
  cek("tidak menyebut selisih", b.selisih, null);
  cek("tidak menyebut persen", b.persen, null);
  cek("tidak ada label pembanding", b.sebelumnya, null);
}

console.log("=== 7. Jebakan: pembanding ADA transaksi tapi omzet nol ===");
{
  // Transaksi 100% dibayar poin: omzet bersih 0. Persen tidak boleh NaN/Infinity.
  const data = [
    trx("2026-10-02", 50_000),
    trx("2026-09-10", 5_000, { poin_dipakai: 5 }), // 5000 - 5000 = 0
  ];
  const r = rentangPeriode({ jenis: "bulan_ini" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("tanpaData false (ada transaksi)", b.tanpaData, false);
  cek("omzet pembanding 0", b.sebelumnya?.omzet, 0);
  cek("persen null (bukan Infinity)", b.persen, null);
  cek("selisih tetap dihitung", b.selisih, 50_000);
}

console.log("=== 8. Jebakan: hari ini lawan kemarin belum setara ===");
{
  const data = [trx("2026-10-12", 25_000), trx("2026-10-11", 80_000)];
  const r = rentangPeriode({ jenis: "hari_ini" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "hari_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("pembanding = kemarin 80rb", b.sebelumnya?.omzet, 80_000);
  cek("ditandai tidak setara", b.tidakSetara, true);
  cek("belum selesai", b.belumSelesai, true);
}

console.log("=== 9. bandingPenjualan: hari selesai -> tidakSetara false ===");
{
  const data = [trx("2026-10-11", 25_000), trx("2026-10-10", 20_000)];
  const r = rentangPeriode({ jenis: "kemarin" }, KINI)!;
  const ringkas = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  const b = bandingPenjualan(data, { jenis: "kemarin" }, KINI, NILAI_POIN, ringkas, false);
  cek("kemarin: belumSelesai false", b.belumSelesai, false);
  cek("kemarin: tidakSetara false", b.tidakSetara, false);
  cek("kemarin: naik 5rb", b.selisih, 5_000);
  cek("kemarin: +25%", b.persen, 25);
}

console.log("=== 10. Rumus omzet sama di kedua sisi perbandingan ===");
{
  // Sisi sekarang dan sisi pembanding wajib memakai netto yang sama. Kalau
  // salah satu sisi lupa mengurangi poin, perbandingannya jadi palsu.
  const data = [
    trx("2026-10-02", 100_000, { diskon: 10_000, poin_dipakai: 5 }),
    trx("2026-09-10", 100_000, { diskon: 10_000, poin_dipakai: 5 }),
  ];
  const r = rentangPeriode({ jenis: "bulan_ini" }, KINI)!;
  const sekarang = ringkasPenjualan(saringPeriode(data, r), NILAI_POIN);
  cek("netto sisi sekarang", sekarang.omzet, 85_000);
  const b = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, sekarang, true);
  cek("netto sisi pembanding", b.sebelumnya?.omzet, 85_000);
  cek("sama -> selisih 0", b.selisih, 0);
  cek("sama -> 0%", b.persen, 0);
}

console.log("=== 11. Format rupiah selisih: tanda di depan Rp, bukan menempel angka ===");
{
  // Cacat nyata yang ketemu saat verifikasi live: "-187.000" sempat tercetak
  // sebagai "Rp -187.000". Tandanya harus di depan.
  const rupiahSelisih = (n: number) =>
    n < 0
      ? "-Rp " + Math.abs(n).toLocaleString("id-ID", { maximumFractionDigits: 0 })
      : "+Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  cek("negatif", rupiahSelisih(-187_000), "-Rp 187.000");
  cek("positif", rupiahSelisih(50_000), "+Rp 50.000");
  cek("nol tetap bertanda plus", rupiahSelisih(0), "+Rp 0");
  cek("tidak ada 'Rp -'", rupiahSelisih(-1).includes("Rp -"), false);
}

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
