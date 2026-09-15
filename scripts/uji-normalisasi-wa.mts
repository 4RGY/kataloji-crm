/**
 * Uji normalisasi nomor WhatsApp, sisi TypeScript.
 *
 * Aturan yang sama hidup di DUA tempat:
 *   1. src/lib/pelanggan.ts  -> dipakai aplikasi untuk mencegah duplikat
 *      sebelum menulis ke database.
 *   2. public.normalisasi_whatsapp() di supabase/security-patch-3.sql
 *      -> penentu akhir, karena indeks uniknya memakai fungsi itu.
 *
 * Kalau keduanya berbeda, aplikasi akan MELOLOSKAN nomor yang kemudian
 * DITOLAK database, dan kasir melihat galat mentah berbahasa Inggris.
 * Berkas ini menyalin ulang logika SQL sebagai pembanding, lalu menguji
 * keduanya berdampingan pada kumpulan nomor yang sama.
 *
 * Jalankan: npx tsx scripts/uji-normalisasi-wa.mts
 */

import { normalisasiWhatsapp, formatWhatsapp, cocokCari } from "../src/lib/pelanggan";

let lulus = 0;
let gagal = 0;

function cek(judul: string, syarat: boolean, tambahan = "") {
  if (syarat) {
    lulus++;
    console.log(`PASS  ${judul}`);
  } else {
    gagal++;
    console.log(`FAIL  ${judul}${tambahan ? ` -> ${tambahan}` : ""}`);
  }
}

/**
 * Salinan persis public.normalisasi_whatsapp() dari security-patch-3.sql.
 * Sengaja ditulis ulang di sini, bukan diimpor, supaya perubahan pada versi
 * TypeScript tidak ikut mengubah pembandingnya. Kalau berkas SQL diubah,
 * fungsi ini WAJIB diubah bersamaan.
 */
function normalisasiSql(no: string | null): string | null {
  if (no === null) return null;
  let digit = no.replace(/[^0-9]/g, "");
  if (digit === "") return null;
  if (digit.slice(0, 1) === "0") digit = "62" + digit.slice(1);
  if (digit.slice(0, 1) === "8") digit = "62" + digit;
  if (digit.slice(0, 3) === "620") digit = "62" + digit.slice(3);
  return digit;
}

console.log("\n=== 1. Aplikasi dan database harus sepakat ===\n");

const nomorUji = [
  "08123456789",
  "628123456789",
  "8123456789",
  "620812345678",
  "+62 851-5680-3978",
  "0851-5680-3978",
  "62081234567893",
  "0087654321", // nol tertekan dua kali; kasus yang dulu berbeda
  "00851680",
  "62",
  "0",
  "800123",
  "6208",
  "0812 3456 7890",
  "(0812) 3456-7890",
  "62-812-3456-7890",
];

for (const n of nomorUji) {
  const ts = normalisasiWhatsapp(n);
  const sql = normalisasiSql(n);
  cek(
    `"${n}" sama di aplikasi dan database`,
    ts === sql,
    `aplikasi=${ts} database=${sql}`,
  );
}

console.log("\n=== 2. Nomor yang sama ditulis beda tetap dikenali sama ===\n");

const pasangan: [string, string][] = [
  ["0851-5680-3978", "+62 851 5680 3978"],
  ["08123456789", "8123456789"],
  ["628123456789", "0812 3456 789"],
  ["620812345678", "0812345678"],
];

for (const [a, b] of pasangan) {
  cek(
    `"${a}" dan "${b}" dianggap satu nomor`,
    normalisasiWhatsapp(a) === normalisasiWhatsapp(b),
    `${normalisasiWhatsapp(a)} vs ${normalisasiWhatsapp(b)}`,
  );
}

cek(
  "nomor berbeda tidak dianggap sama",
  normalisasiWhatsapp("08123456789") !== normalisasiWhatsapp("08123456788"),
);

console.log("\n=== 3. Masukan aneh tidak merusak ===\n");

cek("teks kosong menghasilkan kosong", normalisasiWhatsapp("") === "");
cek("hanya spasi menghasilkan kosong", normalisasiWhatsapp("   ") === "");
cek("hanya tanda baca menghasilkan kosong", normalisasiWhatsapp("+-()") === "");
cek(
  "huruf dibuang, angka dipertahankan",
  normalisasiWhatsapp("wa 0812 saya") === "62812",
);
cek(
  "hasil selalu berupa angka saja",
  /^\d*$/.test(normalisasiWhatsapp("+62 (851) 5680-3978")),
);
cek(
  "menormalkan dua kali hasilnya tetap sama",
  normalisasiWhatsapp(normalisasiWhatsapp("0851-5680-3978")) ===
    normalisasiWhatsapp("0851-5680-3978"),
);

console.log("\n=== 4. Tampilan nomor untuk dibaca manusia ===\n");

cek(
  "nomor panjang diberi pemisah",
  formatWhatsapp("6285156803978").includes(" "),
  formatWhatsapp("6285156803978"),
);
cek(
  "tampilan diawali tanda tambah",
  formatWhatsapp("6285156803978").startsWith("+"),
  formatWhatsapp("6285156803978"),
);
cek(
  "angka pada tampilan tidak berubah",
  formatWhatsapp("6285156803978").replace(/\D/g, "") === "6285156803978",
);
cek("nomor kosong tidak menghasilkan tanda aneh", formatWhatsapp("") === "");

console.log("\n=== 5. Pencarian mengikuti nomor yang sudah dirapikan ===\n");

const orang = {
  nama: "Anggara",
  whatsapp: "6285156803978",
  tgl_lahir: "2004-11-09",
};

cek("cari dengan nama", cocokCari(orang, "angga"));
cek("cari tidak peduli huruf besar kecil", cocokCari(orang, "ANGGARA"));
cek("cari dengan potongan nomor", cocokCari(orang, "5680"));
cek("cari dengan nomor berawalan nol", cocokCari(orang, "0851"));
cek("cari dengan nomor bertanda tambah", cocokCari(orang, "+62851"));
cek("kata kunci kosong dianggap cocok", cocokCari(orang, ""));
cek("kata kunci asing tidak cocok", !cocokCari(orang, "zzzz"));

console.log(`\n=== ${lulus} LULUS, ${gagal} GAGAL ===\n`);
process.exitCode = gagal === 0 ? 0 : 1;
