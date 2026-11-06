// Uji PDF laporan loyalitas: hasilkan file nyata lalu periksa isinya.
import { writeFileSync, readFileSync } from "node:fs";
import { buatPdfLaporan } from "../src/lib/laporan-pdf.ts";

const data = {
  periodeLabel: "Minggu ini, 12 Okt 2026 sampai 18 Okt 2026",
  dibuatPada: "14 Okt 2026, 10.00",
  jumlahTransaksi: 4,
  omzet: 245000,
  hari: [
    { nama: "Senin", omzet: 150000 },
    { nama: "Selasa", omzet: 95000 },
  ],
  tertaut: 3,
  tanpaPelanggan: 1,
  persenTertaut: 75,
  jumlahPelangganAktif: 3,
  poinBeredar: 12,
  nilaiPoinBeredar: 12000,
  jumlahPelanggan: 5,
  sebaranPoin: [
    { label: "belum ada poin", jumlah: 1 },
    { label: "1 sampai 4 poin", jumlah: 2 },
    { label: "5 sampai 9 poin", jumlah: 1 },
    { label: "10 poin ke atas", jumlah: 1 },
  ],
  setia: [
    { nama: "Budi Santoso", kunjungan: 4, omzet: 300000 },
    { nama: "Siti", kunjungan: 2, omzet: 80000 },
    { nama: "Andi", kunjungan: 1, omzet: 20000 },
  ],
  jumlahPelangganDatang: 3,
};

let lulus = 0, gagal = 0;
function cek(nama: string, k: boolean, d = "") { if (k) { lulus++; console.log("  LULUS  " + nama); } else { gagal++; console.log("  GAGAL  " + nama + " " + d); } }

const blob = buatPdfLaporan(data);
const buf = Buffer.from(await blob.arrayBuffer());
const out = "C:/Users/Anggara/AppData/Local/hermes/cache/uji-laporan.pdf";
writeFileSync(out, buf);

cek("file dimulai dengan %PDF", buf.subarray(0, 4).toString() === "%PDF");
cek("ukuran wajar (> 2 KB)", buf.length > 2000, "(" + buf.length + " byte)");

// Teks di dalam PDF tidak selalu utuh (font terkompresi), jadi cek juga versi tanpa kompresi.
const teks = readFileSync(out).toString("latin1");
cek("memuat judul", teks.includes("Laporan Loyalitas") || teks.includes("Loyalitas"));
cek("halaman dihitung (ada /Type /Page)", /\/Type\s*\/Page[^s]/.test(teks));

console.log("\n=== " + lulus + " LULUS, " + gagal + " GAGAL ===");
console.log("PDF: " + out + " (" + buf.length + " byte)");
if (gagal > 0) process.exit(1);
