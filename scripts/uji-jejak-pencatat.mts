/**
 * Uji logika tampilan jejak pencatat transaksi (src/lib/jejak-pencatat.ts).
 *
 * YANG PALING PENTING DIUJI
 * Nilai penanda "Sebelum fitur jejak pencatat" dan "Sistem (tanpa sesi staf)"
 * TIDAK BOLEH tampil seolah-olah itu nama orang. Kalau salah tampil, saat
 * audit orang bisa mengira ada staf bernama "Sebelum fitur jejak pencatat"
 * padahal itu justru penanda bahwa namanya tidak diketahui.
 *
 * Jalankan: npx tsx scripts/uji-jejak-pencatat.mts
 */
import {
  LABEL_SEBELUM_FITUR,
  LABEL_SISTEM,
  bukanNamaOrang,
  inisialPencatat,
  labelPencatat,
  namaPendekPencatat,
  ringkasRekap,
  urutkanRekap,
} from "../src/lib/jejak-pencatat.ts";

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

// ---------- bukanNamaOrang ----------
sama("nama kosong bukan orang", bukanNamaOrang(null), true);
sama("nama string kosong bukan orang", bukanNamaOrang(""), true);
sama("label sebelum fitur bukan orang", bukanNamaOrang(LABEL_SEBELUM_FITUR), true);
sama("label sistem bukan orang", bukanNamaOrang(LABEL_SISTEM), true);
sama("nama biasa adalah orang", bukanNamaOrang("Sanusi"), false);
sama("email adalah orang", bukanNamaOrang("sinta@kataloji.id"), false);

// ---------- labelPencatat ----------
sama(
  "nama staf tampil sebagai 'Dicatat oleh'",
  labelPencatat("Sanusi"),
  "Dicatat oleh Sanusi",
);
sama(
  "email dipakai apa adanya di kalimat",
  labelPencatat("sinta@kataloji.id"),
  "Dicatat oleh sinta@kataloji.id",
);
sama(
  "label sebelum fitur TIDAK tampil sebagai nama",
  labelPencatat(LABEL_SEBELUM_FITUR),
  "Sebelum fitur ini ada",
);
sama(
  "label sistem ditulis sebagai impor",
  labelPencatat(LABEL_SISTEM),
  "Dicatat sistem (impor)",
);
sama("nama kosong jadi tanpa jejak", labelPencatat(null), "Tanpa jejak pencatat");
sama("nama spasi jadi tanpa jejak", labelPencatat("   "), "Tanpa jejak pencatat");

// ---------- namaPendekPencatat ----------
sama("nama pendek apa adanya", namaPendekPencatat("Sanusi Pratama"), "Sanusi Pratama");
sama(
  "email dipotong jadi bagian depan",
  namaPendekPencatat("sinta@kataloji.id"),
  "sinta",
);
sama(
  "label sebelum fitur jadi sebutan pendek",
  namaPendekPencatat(LABEL_SEBELUM_FITUR),
  "Sebelum fitur ini",
);
sama("label sistem jadi Sistem", namaPendekPencatat(LABEL_SISTEM), "Sistem");
sama("kosong jadi tanpa jejak", namaPendekPencatat(null), "Tanpa jejak");

// ---------- inisialPencatat ----------
sama("inisial dua kata", inisialPencatat("Sanusi Pratama"), "SP");
sama("inisial satu kata", inisialPencatat("Sanusi"), "SA");
sama("inisial tiga kata ambil tepi", inisialPencatat("Manda Ayu Lestari"), "ML");
sama("inisial dari email", inisialPencatat("sinta@kataloji.id"), "SI");
sama("inisial email pendek tidak error", inisialPencatat("a@b.co"), "A");
sama("inisial label khusus jadi tanda tanya", inisialPencatat(LABEL_SEBELUM_FITUR), "?");
sama("inisial sistem jadi tanda tanya", inisialPencatat(LABEL_SISTEM), "?");
sama("inisial kosong jadi tanda tanya", inisialPencatat(null), "?");
sama(
  "inisial dengan garis bawah dan titik",
  inisialPencatat("anggara_von.sylvan"),
  "AS",
);

// ---------- urutkanRekap ----------
const rekap = [
  { staf_id: null, nama: LABEL_SEBELUM_FITUR, jumlah_transaksi: 100, total_omzet: 900, terakhir_mencatat: null },
  { staf_id: "a", nama: "Sanusi", jumlah_transaksi: 24, total_omzet: 500, terakhir_mencatat: null },
  { staf_id: "b", nama: "Manda", jumlah_transaksi: 31, total_omzet: 700, terakhir_mencatat: null },
  { staf_id: "c", nama: "Reyhan", jumlah_transaksi: 31, total_omzet: 600, terakhir_mencatat: null },
];

sama(
  "rekap diurut jumlah terbanyak, penanda lama selalu di bawah",
  urutkanRekap(rekap).map((b) => b.nama),
  ["Manda", "Reyhan", "Sanusi", LABEL_SEBELUM_FITUR],
);
sama(
  "rekap tidak mengubah array aslinya",
  urutkanRekap(rekap)[0].nama,
  "Manda",
);
sama("rekap kosong aman", urutkanRekap([]), []);

// ---------- ringkasRekap ----------
sama(
  "ringkasan menyebut staf dan transaksi lama",
  ringkasRekap([
    { staf_id: "a", nama: "Sanusi", jumlah_transaksi: 2, total_omzet: 0, terakhir_mencatat: null },
    { staf_id: null, nama: LABEL_SEBELUM_FITUR, jumlah_transaksi: 4, total_omzet: 0, terakhir_mencatat: null },
  ]),
  "1 staf sudah tercatat mencatat transaksi. 4 transaksi lama belum punya nama pencatat.",
);
sama(
  "ringkasan tanpa transaksi lama bersih",
  ringkasRekap([
    { staf_id: "a", nama: "Sanusi", jumlah_transaksi: 2, total_omzet: 0, terakhir_mencatat: null },
    { staf_id: "b", nama: "Manda", jumlah_transaksi: 3, total_omzet: 0, terakhir_mencatat: null },
  ]),
  "2 staf sudah tercatat mencatat transaksi.",
);
sama(
  "ringkasan kalau belum ada satupun berjejak",
  ringkasRekap([
    { staf_id: null, nama: LABEL_SEBELUM_FITUR, jumlah_transaksi: 4, total_omzet: 0, terakhir_mencatat: null },
  ]),
  "Belum ada transaksi yang jejaknya tercatat. 4 transaksi lama belum punya nama pencatat.",
);
sama("ringkasan kosong jelas", ringkasRekap([]), "Belum ada transaksi tercatat.");

// ---------- tidak ada nilai penanda yang tampil mentah ----------
const MENTAH = [LABEL_SEBELUM_FITUR, LABEL_SISTEM];
let bocor = 0;
for (const nilai of MENTAH) {
  for (const fn of [labelPencatat, namaPendekPencatat]) {
    const hasil = fn(nilai);
    if (hasil.includes(nilai) && nilai.length > 20) {
      bocor++;
      console.log("FAIL  nilai penanda tampil mentah -> " + hasil);
    }
  }
}
sama("tidak ada penanda panjang yang tampil mentah", bocor, 0);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
