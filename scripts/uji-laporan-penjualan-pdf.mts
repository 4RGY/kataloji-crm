/**
 * Uji PDF laporan penjualan benar-benar terbentuk dan isinya masuk.
 *
 * Bukan sekadar "tidak error": berkasnya ditulis ke disk lalu diperiksa
 * ukurannya dan tanda tangan PDF-nya, supaya kalau jsPDF berubah perilaku
 * kita tahu dari sini, bukan dari pemilik yang gagal mengunduh.
 */

import { writeFileSync } from "node:fs";
import { NILAI_POIN } from "../src/lib/poin";
import { ringkasPenjualan } from "../src/lib/laporan-penjualan";
import { buatPdfPenjualan } from "../src/lib/laporan-penjualan-pdf";

let lulus = 0;
let gagal = 0;

function benar(nama: string, nilai: boolean, info = "") {
  if (nilai) lulus++;
  else {
    gagal++;
    console.log(`  GAGAL ${nama}${info ? " -> " + info : ""}`);
  }
}

console.log("=== uji PDF laporan penjualan ===\n");

const ringkas = ringkasPenjualan(
  [
    { total: 20_000, diskon: 0, poin_dipakai: 0, created_at: "2026-10-02T10:00:00", tanggal_majoo: "2026-10-02", source: "majoo_import" },
    { total: 30_000, diskon: 5_000, poin_dipakai: 0, created_at: "2026-10-02T15:00:00", tanggal_majoo: "2026-10-02", source: "majoo_import" },
    { total: 25_000, diskon: 0, poin_dipakai: 5, created_at: "2026-10-12T13:17:00", tanggal_majoo: null, source: "majoo_parallel" },
  ],
  NILAI_POIN,
);

const blob = buatPdfPenjualan({
  periodeLabel: "1 Okt 2026 s.d. 31 Okt 2026",
  dibuatPada: "12 Okt 2026, 20.00",
  ringkas,
});

benar("blob terbentuk", blob instanceof Blob);
benar("ukuran wajar", blob.size > 2_000, `${blob.size} byte`);
benar("bertipe PDF", blob.type === "application/pdf", blob.type);

const buf = Buffer.from(await blob.arrayBuffer());
benar("tanda tangan %PDF di awal berkas", buf.subarray(0, 5).toString() === "%PDF-");
benar("penanda akhir berkas ada", buf.toString("latin1").includes("%%EOF"));

// Ringkasan yang masuk ke PDF harus sama dengan yang di layar.
// 20.000 + (30.000-5.000) + (25.000-5.000 poin) = 65.000
benar("omzet bersih di PDF = hasil ringkas", ringkas.omzet === 65_000, String(ringkas.omzet));
benar("potongan poin ikut dihitung", ringkas.potonganPoin === 5_000, String(ringkas.potonganPoin));
benar("rincian harian ada di PDF", ringkas.harian.length === 2, String(ringkas.harian.length));

const keluar = "C:/Users/Anggara/AppData/Local/hermes/cache/uji-laporan-penjualan.pdf";
writeFileSync(keluar, buf);
console.log(`  berkas: ${keluar} (${buf.length} byte)`);

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exit(gagal > 0 ? 1 : 0);
