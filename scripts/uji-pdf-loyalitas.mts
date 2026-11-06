/**
 * Uji nyata pembuat PDF laporan loyalitas.
 * Membangun PDF dengan data contoh, lalu memeriksa hasilnya: bukan kosong,
 * header PDF benar, dan ukurannya masuk akal. Ditulis sebagai berkas sementara
 * karena hanya dipakai untuk memverifikasi sekali.
 */
import { writeFileSync } from "node:fs";
import { buatPdfLaporan } from "../src/lib/laporan-pdf";

let lulus = 0;
let gagal = 0;
function cek(nama: string, kondisi: boolean, bukti: string) {
  if (kondisi) {
    lulus++;
    console.log(`PASS  ${nama} -> ${bukti}`);
  } else {
    gagal++;
    console.log(`FAIL  ${nama} -> ${bukti}`);
  }
}

const blob = buatPdfLaporan({
  periodeLabel: "November 2026",
  dibuatPada: "6 Nov 2026, 16.00",
  jumlahTransaksi: 42,
  omzet: 3_150_000,
  hari: [
    { nama: "Senin", omzet: 450_000 },
    { nama: "Selasa", omzet: 610_000 },
    { nama: "Rabu", omzet: 520_000 },
  ],
  tertaut: 36,
  tanpaPelanggan: 6,
  persenTertaut: 86,
  jumlahPelangganAktif: 12,
  poinBeredar: 184,
  nilaiPoinBeredar: 184_000,
  jumlahPelanggan: 20,
  sebaranPoin: [
    { label: "belum ada poin", jumlah: 2 },
    { label: "1 sampai 4 poin", jumlah: 9 },
    { label: "5 sampai 9 poin", jumlah: 6 },
    { label: "10 poin ke atas", jumlah: 3 },
  ],
  setia: [
    { nama: "Anggara", kunjungan: 8, omzet: 420_000 },
    { nama: "Sanusi", kunjungan: 5, omzet: 310_000 },
    { nama: "Reyhan", kunjungan: 4, omzet: 260_000 },
    { nama: "Manda", kunjungan: 3, omzet: 180_000 },
  ],
  jumlahPelangganDatang: 4,
});

const buf = Buffer.from(await blob.arrayBuffer());
cek("PDF terbentuk", buf.length > 0, `${buf.length} byte`);
cek("header PDF valid", buf.subarray(0, 5).toString() === "%PDF-", buf.subarray(0, 8).toString());
cek("ukuran wajar", buf.length > 8000, `${Math.round(buf.length / 1024)} KB`);
cek("blob bertipe pdf", blob.type === "application/pdf", blob.type);

const keluar = process.argv[2];
if (keluar) {
  writeFileSync(keluar, buf);
  console.log(`Disimpan ke ${keluar}`);
}

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exit(gagal === 0 ? 0 : 1);
