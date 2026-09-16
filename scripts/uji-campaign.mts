/**
 * Uji logika campaign dan notifikasi.
 *
 * Tanggal acuan dikunci, tidak diambil dari jam sistem, supaya uji ini tidak
 * lulus hari ini lalu gagal bulan depan.
 *
 * Jalankan: npx tsx scripts/uji-campaign.mts
 */
import {
  adaMasalahBerat,
  AMBANG_HANGUS_HARI,
  CONTOH_PESAN,
  periksaPesan,
  pilihSegmen,
  pisahkanTanpaNomor,
  ringkasKirim,
  SEGMEN,
  SISIPAN,
  susunPesan,
  tautanWhatsapp,
  type TargetCampaign,
} from "../src/lib/campaign";
import {
  angkaLonceng,
  belumDibaca,
  susunNotifikasi,
  type SumberNotif,
} from "../src/lib/notifikasi";

let lulus = 0;
let gagal = 0;

function sama(label: string, dapat: unknown, harus: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harus);
  if (ok) {
    lulus++;
    console.log(`PASS  ${label}`);
  } else {
    gagal++;
    console.log(`FAIL  ${label}\n      dapat=${JSON.stringify(dapat)} harus=${JSON.stringify(harus)}`);
  }
}

const HARI_INI = new Date("2026-09-15T10:00:00");

/** Tanggal n hari setelah HARI_INI, dalam bentuk ISO tanggal saja. */
function nanti(n: number): string {
  const d = new Date(HARI_INI);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function lalu(n: number): string {
  return nanti(-n);
}

const ORANG: TargetCampaign[] = [
  {
    id: "a",
    nama: "Anggara",
    whatsapp: "6285156803978",
    poin: 12,
    tgl_lahir: "2004-09-20",
    kunjungan: 5,
    terakhirIso: lalu(2),
    hangusPada: nanti(10),
  },
  {
    id: "b",
    nama: "Bayu",
    whatsapp: "08123456789",
    poin: 3,
    tgl_lahir: null,
    kunjungan: 1,
    terakhirIso: lalu(5),
    hangusPada: null,
  },
  {
    id: "c",
    nama: "Citra",
    whatsapp: "6281298765432",
    poin: 8,
    tgl_lahir: null,
    kunjungan: 4,
    terakhirIso: lalu(90),
    hangusPada: nanti(100),
  },
  {
    id: "d",
    nama: "Dewi",
    whatsapp: "",
    poin: 6,
    tgl_lahir: null,
    kunjungan: 3,
    terakhirIso: lalu(3),
    hangusPada: nanti(5),
  },
  {
    id: "e",
    nama: "Eka",
    whatsapp: "6285199998888",
    poin: 4,
    tgl_lahir: null,
    kunjungan: 2,
    terakhirIso: lalu(1),
    hangusPada: lalu(3), // sudah lewat, tidak boleh ikut
  },
];

console.log("\n=== 1. Memilih segmen ===\n");

sama("segmen semua mengambil seluruh pelanggan", pilihSegmen(ORANG, "semua", HARI_INI).length, 5);
sama(
  "segmen hangus hanya yang tenggatnya di depan",
  pilihSegmen(ORANG, "hangus", HARI_INI).map((p) => p.nama).sort(),
  ["Anggara", "Dewi"],
);
sama(
  "poin yang sudah telanjur hangus tidak diikutkan",
  pilihSegmen(ORANG, "hangus", HARI_INI).some((p) => p.nama === "Eka"),
  false,
);
sama(
  "hangus yang masih jauh tidak diikutkan",
  pilihSegmen(ORANG, "hangus", HARI_INI).some((p) => p.nama === "Citra"),
  false,
);
sama(
  "segmen sepi mengambil yang lama tidak datang",
  pilihSegmen(ORANG, "sepi", HARI_INI).map((p) => p.nama),
  ["Citra"],
);
sama(
  "segmen baru mengambil yang sekali datang",
  pilihSegmen(ORANG, "baru", HARI_INI).map((p) => p.nama),
  ["Bayu"],
);
sama(
  "segmen ultah mengambil yang lahir bulan ini",
  pilihSegmen(ORANG, "ultah", HARI_INI).map((p) => p.nama),
  ["Anggara"],
);
sama("daftar kosong tidak menimbulkan galat", pilihSegmen([], "hangus", HARI_INI).length, 0);
sama(
  "memilih segmen tidak mengubah daftar asal",
  (() => {
    const sebelum = ORANG.length;
    pilihSegmen(ORANG, "semua", HARI_INI).pop();
    return ORANG.length === sebelum;
  })(),
  true,
);
sama("pelanggan tanpa poin tidak masuk segmen hangus",
  pilihSegmen(
    [{ ...ORANG[0], id: "z", nama: "Zul", poin: 0, hangusPada: nanti(3) }],
    "hangus",
    HARI_INI,
  ).length,
  0,
);
sama("ambang hangus sebulan", AMBANG_HANGUS_HARI, 30);
sama("segmen paling mendesak diletakkan pertama", SEGMEN[0].kode, "hangus");
sama("tiap segmen punya penjelasan", SEGMEN.every((s) => s.alasan.length > 10), true);

console.log("\n=== 2. Memisahkan yang tidak punya nomor ===\n");

const pisah = pisahkanTanpaNomor(ORANG);
sama("yang siap dihubungi", pisah.siap.length, 4);
sama("yang tidak punya nomor", pisah.tanpaNomor.map((p) => p.nama), ["Dewi"]);
sama(
  "tidak ada yang hilang saat dipisah",
  pisah.siap.length + pisah.tanpaNomor.length,
  ORANG.length,
);
sama(
  "nomor terlalu pendek ikut dilewati",
  pisahkanTanpaNomor([{ ...ORANG[0], whatsapp: "0812" }]).tanpaNomor.length,
  1,
);

console.log("\n=== 3. Menyusun pesan ===\n");

const NILAI_POIN = 1000;
const contoh = susunPesan(
  "Halo {nama}, poin kamu {poin} senilai {nilai}, hangus {hangus}.",
  ORANG[0],
  NILAI_POIN,
);
sama("nama tersisip", contoh.includes("Anggara"), true);
sama("poin tersisip", contoh.includes("12"), true);
sama("nilai rupiah tersisip", contoh.includes("Rp"), true);
sama("tidak menyisakan kurung kurawal", /[{}]/.test(contoh), false);
sama(
  "sisipan tanpa isi tidak menyisakan kurung kurawal",
  /[{}]/.test(susunPesan("Hangus {hangus}.", ORANG[1], NILAI_POIN)),
  false,
);
sama(
  "sisipan yang muncul dua kali diganti semuanya",
  susunPesan("{nama} dan {nama}", ORANG[0], NILAI_POIN),
  "Anggara dan Anggara",
);
sama("pesan kosong tetap aman", susunPesan("", ORANG[0], NILAI_POIN), "");
sama("daftar sisipan terdokumentasi", SISIPAN.length, 4);
sama(
  "semua contoh pesan memakai sisipan yang dikenal",
  CONTOH_PESAN.every((c) => periksaPesan(c.isi).every((m) => !m.berat)),
  true,
);
sama("tiap contoh pesan menyebut nama",
  CONTOH_PESAN.every((c) => c.isi.includes("{nama}")), true);

console.log("\n=== 4. Tautan WhatsApp ===\n");

const tautan = tautanWhatsapp("0851-5680-3978", "Halo Anggara");
sama("tautan memakai wa.me", tautan.startsWith("https://wa.me/"), true);
sama("nomor sudah dirapikan di tautan", tautan.includes("6285156803978"), true);
sama("nomor tidak lagi memakai tanda hubung", tautan.includes("-"), false);
sama("spasi pada pesan dikodekan", tautan.includes("Halo%20Anggara"), true);
sama("nomor kosong tidak menghasilkan tautan", tautanWhatsapp("", "halo"), "");
sama(
  "tanda yang rawan salah baca ikut dikodekan",
  tautanWhatsapp("08123456789", "diskon 50% & gratis").includes("%26"),
  true,
);

console.log("\n=== 5. Memeriksa pesan sebelum kirim ===\n");

sama("pesan kosong ditolak", adaMasalahBerat(periksaPesan("")), true);
sama("pesan berisi spasi saja ditolak", adaMasalahBerat(periksaPesan("   ")), true);
sama(
  "kata kunci asing ditolak",
  adaMasalahBerat(periksaPesan("Halo {namaa}, apa kabar")),
  true,
);
sama(
  "kata kunci asing disebutkan di pesan galat",
  periksaPesan("Halo {namaa}").some((m) => m.teks.includes("{namaa}")),
  true,
);
sama(
  "pesan tanpa nama hanya diperingatkan",
  periksaPesan("Promo hari ini di Kataloji").some((m) => m.berat),
  false,
);
sama(
  "pesan tanpa nama tetap memunculkan peringatan",
  periksaPesan("Promo hari ini di Kataloji").length > 0,
  true,
);
sama("pesan wajar tidak diprotes", periksaPesan("Halo {nama}, mampir ya").length, 0);
sama(
  "pesan sangat panjang diperingatkan tanpa mengunci",
  (() => {
    const m = periksaPesan("Halo {nama}. " + "x".repeat(950));
    return m.length > 0 && !adaMasalahBerat(m);
  })(),
  true,
);

console.log("\n=== 6. Ringkasan sebelum kirim ===\n");

sama("segmen kosong dikatakan apa adanya", ringkasKirim(0, 0, 0), "Tidak ada pelanggan pada segmen ini.");
sama("jumlah siap disebutkan", ringkasKirim(4, 0, 0), "4 pelanggan siap dihubungi.");
sama(
  "yang dilewati disebutkan",
  ringkasKirim(4, 1, 0).includes("1 dilewati"),
  true,
);
sama("yang sudah dikirim disebutkan", ringkasKirim(4, 0, 2).includes("2 sudah dikirim"), true);

console.log("\n=== 7. Notifikasi ===\n");

const SUMBER: SumberNotif[] = ORANG.map((p) => ({
  id: p.id,
  nama: p.nama,
  poin: p.poin,
  tgl_lahir: p.tgl_lahir,
  kunjungan: p.kunjungan,
  terakhirIso: p.terakhirIso,
  hangusPada: p.hangusPada,
}));

const notif = susunNotifikasi(SUMBER, HARI_INI);
sama("tiga keadaan menghasilkan tiga notifikasi", notif.length, 3);
sama("yang mendesak diletakkan pertama", notif[0].jenis, "hangus");
sama(
  "notifikasi hangus menyebut jumlah orang",
  notif[0].judul.includes("2"),
  true,
);
sama(
  "notifikasi hangus menyebut total poin",
  notif[0].isi.includes("18"),
  true,
);
sama(
  "tiap notifikasi menuju halaman yang bisa ditindaklanjuti",
  notif.every((n) => n.tautan.startsWith("/campaign?segmen=")),
  true,
);
sama("nol pelanggan berarti nol notifikasi", susunNotifikasi([], HARI_INI).length, 0);
sama(
  "satu orang memakai namanya, bukan angka",
  susunNotifikasi([SUMBER[0]], HARI_INI)[0].judul.includes("Anggara"),
  true,
);
sama(
  "penanda notifikasi tetap sama kalau keadaannya tidak berubah",
  susunNotifikasi(SUMBER, HARI_INI)[0].id,
  notif[0].id,
);

console.log("\n=== 8. Tanda sudah dibaca ===\n");

sama("tanpa tanda, semua belum dibaca", belumDibaca(notif, []).length, 3);
sama("yang ditandai tidak dihitung lagi", belumDibaca(notif, [notif[0].id]).length, 2);
sama("menandai semuanya mengosongkan lonceng",
  belumDibaca(notif, notif.map((n) => n.id)).length, 0);
sama("tanda milik notifikasi lama diabaikan", belumDibaca(notif, ["entah-apa"]).length, 3);

sama("lonceng kosong tidak menampilkan angka", angkaLonceng(0), "");
sama("angka negatif tidak ditampilkan", angkaLonceng(-2), "");
sama("angka biasa ditampilkan apa adanya", angkaLonceng(3), "3");
sama("angka besar dipendekkan supaya lebarnya tetap", angkaLonceng(25), "9+");
sama("sembilan masih ditulis utuh", angkaLonceng(9), "9");

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
