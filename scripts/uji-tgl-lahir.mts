// Uji validasi tanggal lahir. Hanya fungsi murni, tanpa DB.
import { validasiPelanggan } from "../src/lib/pelanggan.ts";

const basis = { nama: "Uji", whatsapp: "081200000001" } as const;
const kasus: [string, string, boolean][] = [
  ["tahun 4 digit wajar", "1995-06-15", true],
  ["tahun 0200 (salah ketik)", "0200-01-01", false],
  ["tahun 0195 (salah ketik)", "0195-01-01", false],
  ["kosong", "", false],
];

let gagal = 0;
for (const [label, tgl, harusLolos] of kasus) {
  const err = validasiPelanggan({ ...basis, tgl_lahir: tgl } as never);
  const tglErr = err.some((e) => e.toLowerCase().includes("tanggal"));
  const lolos = !tglErr;
  const ok = lolos === harusLolos;
  if (!ok) gagal++;
  console.log(`${ok ? "OK  " : "GAGAL"} ${label} -> ${tgl || "(kosong)"} :: ${err.filter((e) => e.toLowerCase().includes("tanggal")).join(" | ") || "lolos"}`);
}
console.log(`=== ${kasus.length - gagal} lulus, ${gagal} gagal ===`);
process.exitCode = gagal === 0 ? 0 : 1;
