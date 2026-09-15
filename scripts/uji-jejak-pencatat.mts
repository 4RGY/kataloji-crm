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
  bagianOmzet,
  bukanNamaOrang,
  inisialPencatat,
  labelPencatat,
  namaPendekPencatat,
  PERIODE_REKAP,
  rataPerStrukStaf,
  ringkasRekap,
  susunRekap,
  totalRekap,
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

// ===================== susunRekap =====================
// Tanggal acuan tetap, bukan jam sistem, supaya uji yang lulus hari ini
// tidak gagal bulan depan.
const KINI = new Date("2026-09-15T20:00:00");

// Data ini MENIRU isi database sungguhan pada 15 Sep 2026: empat transaksi
// lama tanpa jejak pencatat, satu transaksi baru oleh admin. Hasil dengan
// hari = null harus sama persis dengan isi view rekap_pencatat_transaksi.
const ID_WAHYU = "18bdfad4-39ad-48ff-9408-4446220cede7";
const trxAsli = [
  { total: 32000, dicatat_oleh: null, dicatat_oleh_nama: LABEL_SEBELUM_FITUR, created_at: "2026-09-14T11:15:28Z" },
  { total: 32000, dicatat_oleh: null, dicatat_oleh_nama: LABEL_SEBELUM_FITUR, created_at: "2026-09-14T11:26:10Z" },
  { total: 100000, dicatat_oleh: null, dicatat_oleh_nama: LABEL_SEBELUM_FITUR, created_at: "2026-09-14T11:33:43Z" },
  { total: 47000, dicatat_oleh: null, dicatat_oleh_nama: LABEL_SEBELUM_FITUR, created_at: "2026-09-14T12:14:05Z" },
  { total: 47000, dicatat_oleh: ID_WAHYU, dicatat_oleh_nama: "wahyu@kataloji.id", created_at: "2026-09-15T04:02:56Z" },
];

const rekapSemua = susunRekap(trxAsli, null, KINI);
sama("rekap menghasilkan dua baris", rekapSemua.length, 2);
sama("staf sungguhan berada di atas", rekapSemua[0].nama, "wahyu@kataloji.id");
sama("baris tanpa jejak didorong ke bawah", rekapSemua[1].nama, LABEL_SEBELUM_FITUR);

// Angka di bawah ini disalin dari hasil query view sungguhan.
sama("jumlah transaksi staf cocok dengan view", rekapSemua[0].jumlah_transaksi, 1);
sama("omzet staf cocok dengan view", rekapSemua[0].total_omzet, 47000);
sama("jumlah transaksi tanpa jejak cocok dengan view", rekapSemua[1].jumlah_transaksi, 4);
sama("omzet tanpa jejak cocok dengan view", rekapSemua[1].total_omzet, 211000);
sama("id staf terbawa", rekapSemua[0].staf_id, ID_WAHYU);
sama("baris tanpa jejak tidak mengarang id", rekapSemua[1].staf_id, null);

// Empat transaksi lama dikelompokkan jadi SATU baris, bukan empat.
sama(
  "transaksi tanpa id staf tidak pecah jadi banyak baris",
  susunRekap(trxAsli, null, KINI).filter((b) => b.staf_id === null).length,
  1,
);

sama("waktu terakhir mencatat diambil yang terbaru", rekapSemua[1].terakhir_mencatat, "2026-09-14T12:14:05Z");

// Penyaringan periode. Transaksi 14 Sep berada di luar jangkauan 1 hari.
sama("periode 1 hari hanya memuat transaksi hari ini", susunRekap(trxAsli, 1, KINI).length, 1);
sama("periode 1 hari menyisakan staf yang benar", susunRekap(trxAsli, 1, KINI)[0].nama, "wahyu@kataloji.id");
sama("periode 7 hari memuat semuanya", susunRekap(trxAsli, 7, KINI).length, 2);
sama("periode 30 hari memuat semuanya", susunRekap(trxAsli, 30, KINI).length, 2);

sama("daftar kosong menghasilkan rekap kosong", susunRekap([], null, KINI).length, 0);
sama(
  "tanggal ngawur dilewati, bukan bikin baris palsu",
  susunRekap(
    [{ total: 1000, dicatat_oleh: null, dicatat_oleh_nama: "X", created_at: "bukan-tanggal" }],
    null,
    KINI,
  ).length,
  0,
);
sama(
  "nama kosong dianggap sebelum fitur ini",
  susunRekap(
    [{ total: 1000, dicatat_oleh: null, dicatat_oleh_nama: null, created_at: "2026-09-15T05:00:00Z" }],
    null,
    KINI,
  )[0].nama,
  LABEL_SEBELUM_FITUR,
);
sama(
  "nilai total negatif tidak mengurangi omzet",
  susunRekap(
    [{ total: -5000, dicatat_oleh: "a", dicatat_oleh_nama: "A", created_at: "2026-09-15T05:00:00Z" }],
    null,
    KINI,
  )[0].total_omzet,
  0,
);

// ===================== rataPerStrukStaf =====================
sama("rata per struk dibulatkan", rataPerStrukStaf(211000, 4), 52750);
sama("satu transaksi sama dengan nilainya", rataPerStrukStaf(47000, 1), 47000);
sama("nol transaksi tidak menghasilkan NaN", rataPerStrukStaf(0, 0), 0);
sama("pembagi nol aman", rataPerStrukStaf(99000, 0), 0);
sama("nilai bukan angka aman", rataPerStrukStaf(Number.NaN, 3), 0);

// ===================== bagianOmzet =====================
sama("bagian omzet dihitung persen", bagianOmzet(47000, 258000), 18);
sama("bagian penuh seratus persen", bagianOmzet(100, 100), 100);
sama("omzet nol tidak menghasilkan NaN", bagianOmzet(0, 0), 0);
sama("pembagi nol aman", bagianOmzet(5000, 0), 0);
sama("tidak pernah melebihi seratus", bagianOmzet(999, 100), 100);
sama("tidak pernah negatif", bagianOmzet(-50, 100), 0);

// ===================== totalRekap =====================
const tot = totalRekap(rekapSemua);
sama("total transaksi menjumlah semua baris", tot.transaksi, 5);
sama("total omzet menjumlah semua baris", tot.omzet, 258000);
sama("rekap kosong menghasilkan nol", totalRekap([]), { transaksi: 0, omzet: 0 });

// Total rekap harus sama dengan jumlah seluruh transaksi yang masuk periode.
sama(
  "total rekap konsisten dengan sumbernya",
  totalRekap(rekapSemua).omzet,
  trxAsli.reduce((n, t) => n + t.total, 0),
);

// ===================== PERIODE_REKAP =====================
sama("periode yang ditawarkan", PERIODE_REKAP.map((p) => p.label), ["7 hari", "30 hari", "Semua"]);
sama("pilihan semua tidak punya batas hari", PERIODE_REKAP[2].hari, null);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
