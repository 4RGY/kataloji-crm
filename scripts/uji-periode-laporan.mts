// Tes filter periode laporan. Kini dikunci ke tanggal tetap agar tidak bergantung hari tes.
import { rentangPeriode, saringPeriode, parseTanggal } from "../src/lib/periode-laporan.ts";

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) { lulus++; console.log(`  LULUS  ${nama}`); }
  else { gagal++; console.log(`  GAGAL  ${nama} ${detail}`); }
}

// Kini: Rabu, 14 Oktober 2026, pukul 10.00 waktu lokal.
const kini = new Date(2026, 9, 14, 10, 0, 0);
const iso = (y: number, m: number, d: number, jam = 12) => new Date(y, m - 1, d, jam).toISOString();

console.log("Rentang periode");
const hariIni = rentangPeriode({ jenis: "hari_ini" }, kini)!;
cek("hari ini dimulai 14 Okt 00.00", hariIni.dari.getDate() === 14 && hariIni.dari.getHours() === 0);
cek("hari ini berakhir 15 Okt 00.00", hariIni.sampai.getDate() === 15);

const kemarin = rentangPeriode({ jenis: "kemarin" }, kini)!;
cek("kemarin = 13 Okt", kemarin.dari.getDate() === 13 && kemarin.sampai.getDate() === 14);

// 14 Okt 2026 adalah Rabu. Senin minggu ini = 12 Okt.
const minggu = rentangPeriode({ jenis: "minggu_ini" }, kini)!;
cek("minggu ini mulai Senin 12 Okt", minggu.dari.getDate() === 12 && minggu.dari.getDay() === 1);
cek("minggu ini berakhir Minggu 18 Okt (eksklusif 19)", minggu.sampai.getDate() === 19);

const bulan = rentangPeriode({ jenis: "bulan_ini" }, kini)!;
cek("bulan ini mulai 1 Okt", bulan.dari.getDate() === 1 && bulan.dari.getMonth() === 9);
cek("bulan ini berakhir 1 Nov (eksklusif)", bulan.sampai.getMonth() === 10 && bulan.sampai.getDate() === 1);

const tgl = rentangPeriode({ jenis: "tanggal", tanggal: "2026-09-30" }, kini)!;
cek("pertanggal 30 Sep mengambil satu hari", tgl.dari.getDate() === 30 && tgl.sampai.getDate() === 1);

console.log("Validasi tanggal");
cek("tanggal 2026-02-31 ditolak", parseTanggal("2026-02-31") === null);
cek("format salah ditolak", parseTanggal("31-10-2026") === null);
cek("pertanggal tak valid = null", rentangPeriode({ jenis: "tanggal", tanggal: "x" }, kini) === null);

console.log("Saring transaksi (aturan hari laporan)");
const data = [
  { created_at: iso(2026, 10, 14, 9), tanggal_majoo: null },           // manual hari ini
  { created_at: iso(2026, 10, 13, 20), tanggal_majoo: null },          // manual kemarin
  { created_at: iso(2026, 10, 14, 8), tanggal_majoo: "2026-10-13" },   // impor H+1: milik kemarin
  { created_at: iso(2026, 10, 12, 10), tanggal_majoo: null },          // Senin minggu ini
  { created_at: iso(2026, 9, 30, 15), tanggal_majoo: null },           // akhir September
];
cek("hari ini hanya 1 transaksi", saringPeriode(data, hariIni).length === 1);
cek("kemarin memuat impor H+1 (tanggal_majoo 13 Okt)", saringPeriode(data, kemarin).length === 2);
cek("impor H+1 tidak masuk hari ini", !saringPeriode(data, hariIni).some((t) => t.tanggal_majoo));
cek("minggu ini 12-18 Okt = 4 transaksi (14, 13 manual, 13 impor, 12)", saringPeriode(data, minggu).length === 4);
cek("bulan ini (Okt) = 4 transaksi", saringPeriode(data, bulan).length === 4);
cek("pertanggal 30 Sep = 1 transaksi", saringPeriode(data, tgl).length === 1);

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
