// ============================================================
// Uji PDF laporan penjualan versi baru: bagian perbandingan periode.
// ============================================================
// Membuktikan bagian "Perbandingan Periode Sebelumnya" benar-benar tercetak,
// bahwa tanda minus tidak menempel pada "Rp", dan bahwa catatan ragu ikut
// tercetak saat periode belum selesai.
//
// Jalankan: npx tsx scripts/uji-banding-penjualan-pdf.mts

import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { bandingPenjualan, ringkasPenjualan, type TransaksiPenjualan } from "../src/lib/laporan-penjualan.ts";
import { buatPdfPenjualan } from "../src/lib/laporan-penjualan-pdf.ts";

let lulus = 0;
let gagal = 0;
function cek(nama: string, benar: boolean) {
  if (benar) lulus++;
  else {
    gagal++;
    console.log(`  GAGAL  ${nama}`);
  }
}

const NILAI_POIN = 1000;
const KINI = new Date(2026, 9, 12, 17, 30);

function trx(tgl: string, total: number): TransaksiPenjualan {
  const [y, m, d] = tgl.split("-").map(Number);
  return {
    total,
    diskon: 0,
    poin_dipakai: 0,
    created_at: new Date(y, m - 1, d, 12).toISOString(),
    tanggal_majoo: null,
    source: "crm_manual",
  };
}

/**
 * Ambil teks dari PDF jsPDF tanpa dependensi tambahan.
 *
 * jsPDF menulis isi halaman sebagai stream yang dipadatkan (FlateDecode).
 * Setiap stream di-inflate, lalu teksnya diambil dari operator Tj/TJ. Cukup
 * untuk memastikan kalimat dan angka benar-benar tercetak, bukan cuma file
 * yang "berhasil dibuat".
 */
async function teksPdf(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const mentah = buf.toString("latin1");
  const potongan: string[] = [];
  const pola = /stream\r?\n?([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(mentah)) !== null) {
    const isi = Buffer.from(m[1], "latin1");
    let teks = "";
    try {
      teks = inflateSync(isi).toString("latin1");
    } catch {
      teks = isi.toString("latin1"); // stream yang tidak dipadatkan
    }
    potongan.push(teks);
  }
  const gabung = potongan.join("\n");
  const keluaran: string[] = [];
  // Operator Tj: (teks) Tj  ; operator TJ: [(a) -250 (b)] TJ
  const polaTj = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
  while ((m = polaTj.exec(gabung)) !== null) keluaran.push(m[1]);
  const polaTJ = /\[((?:[^\][])*)\]\s*TJ/g;
  while ((m = polaTJ.exec(gabung)) !== null) {
    const dalam = m[1];
    const bagian = dalam.match(/\(((?:\\.|[^\\()])*)\)/g) ?? [];
    keluaran.push(bagian.map((b) => b.slice(1, -1)).join(""));
  }
  return keluaran
    .join(" ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\s+/g, " ");
}

console.log("=== Kasus A: ada pembanding, periode belum selesai ===");
{
  const data = [trx("2026-10-02", 93_000), trx("2026-09-10", 280_000)];
  const ringkas = ringkasPenjualan([data[0]], NILAI_POIN);
  const banding = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  const blob = buatPdfPenjualan({
    periodeLabel: "1 Okt 2026 s.d. 31 Okt 2026",
    dibuatPada: "12 Okt 2026, 17.30",
    ringkas,
    banding,
  });
  const teks = await teksPdf(blob);
  const rapi = teks.replace(/\s+/g, " ");

  cek("PDF jadi", blob.size > 2000);
  cek("ada judul bagian banding", /Perbandingan Periode Sebelumnya/i.test(rapi));
  cek("ada label pembanding", /Bulan lalu/i.test(rapi));
  cek("ada selisih bertanda minus rapi", /-Rp\s?187\.000/.test(rapi));
  cek("tidak ada 'Rp -'", !/Rp\s-/.test(rapi));
  cek("ada persen", /-67%/.test(rapi));
  cek("ada catatan belum selesai", /belum selesai/i.test(rapi));

  const jalur = "C:/Users/Anggara/AppData/Local/hermes/cache/uji-banding-penjualan.pdf";
  writeFileSync(jalur, Buffer.from(await blob.arrayBuffer()));
  console.log(`  PDF ditulis: ${jalur}`);
  console.log(`  cuplikan: ${(rapi.match(/Perbandingan Periode Sebelumnya.{0,180}/i) || [""])[0]}`);
}

console.log("=== Kasus B: tanpa pembanding -> bagian itu tidak dicetak ===");
{
  const data = [trx("2026-10-02", 93_000)];
  const ringkas = ringkasPenjualan(data, NILAI_POIN);
  const banding = bandingPenjualan(data, { jenis: "bulan_ini" }, KINI, NILAI_POIN, ringkas, true);
  cek("tanpaData true", banding.tanpaData);
  const blob = buatPdfPenjualan({
    periodeLabel: "1 Okt 2026 s.d. 31 Okt 2026",
    dibuatPada: "12 Okt 2026, 17.30",
    ringkas,
    banding,
  });
  const rapi = (await teksPdf(blob)).replace(/\s+/g, " ");
  cek("tidak ada bagian banding", !/Perbandingan Periode Sebelumnya/i.test(rapi));
  cek("tidak ada angka naik/turun", !/\d+%/.test(rapi) || !/naik|turun/i.test(rapi));
  cek("ringkasan tetap ada", /Omzet bersih/i.test(rapi));
}

console.log("=== Kasus C: banding tidak dikirim sama sekali (unduhan lama) ===");
{
  const ringkas = ringkasPenjualan([trx("2026-10-02", 93_000)], NILAI_POIN);
  const blob = buatPdfPenjualan({
    periodeLabel: "Oktober 2026",
    dibuatPada: "12 Okt 2026",
    ringkas,
  });
  const rapi = (await teksPdf(blob)).replace(/\s+/g, " ");
  cek("tidak meledak tanpa banding", blob.size > 2000);
  cek("tidak ada bagian banding", !/Perbandingan Periode Sebelumnya/i.test(rapi));
}

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
