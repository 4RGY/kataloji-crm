// Uji hitungan grafik dashboard. Memakai data nyata yang sudah dibaca dari
// DB (hanya baca, tidak menulis apa pun). Jalankan: npx tsx scripts/uji-dashboard-grafik.mts
import { menuTeratas, komposisiMetode, trenOmzet, AMBANG_MENU_DASHBOARD } from "../src/lib/dashboard-grafik";

let lulus = 0;
let gagal = 0;
const cek = (nama: string, ok: boolean) => {
  console.log((ok ? "LULUS " : "GAGAL ") + nama);
  if (ok) lulus++;
  else gagal++;
};

// Menu: "Kopi Susu" dan "kopi susu " harus jadi satu menu.
const contohItem = [
  { items: [{ nama: "Kopi Susu", qty: 2 }, { nama: "Roti Bakar", qty: 1 }] },
  { items: [{ nama: "kopi susu ", qty: 3 }, { nama: "Croissant", qty: 1 }] },
  { items: "bukan-array" },
  { items: [{ nama: "", qty: 4 }, { nama: "Rusak", qty: "x" }, null] },
];
const menu = menuTeratas(contohItem);
cek("menu: normalisasi nama menyatukan 'Kopi Susu' dan 'kopi susu '", menu.daftar[0]?.qty === 5 && menu.daftar[0]?.nama === "Kopi Susu");
cek("menu: item rusak dan items bukan array dilewati", menu.totalPorsi === 7);
cek("menu: porsi tertinggi = 1", menu.daftar[0]?.porsi === 1);
cek("menu: cukupData false di bawah ambang", menu.cukupData === false && AMBANG_MENU_DASHBOARD === 20);

// Metode bayar: transaksi tanpa metode harus jadi 'Belum tercatat', tidak dibuang.
const metode = komposisiMetode([
  { total: 1, diskon: 0, metode_bayar: "QRIS", created_at: "" },
  { total: 1, diskon: 0, metode_bayar: "Tunai", created_at: "" },
  { total: 1, diskon: 0, metode_bayar: "  ", created_at: "" },
  { total: 1, diskon: 0, metode_bayar: null, created_at: "" },
]);
const belum = metode.find((m) => m.belumTercatat);
cek("metode: transaksi kosong dan spasi jadi 'Belum tercatat' (2)", belum?.jumlah === 2);
cek("metode: total jumlah sama dengan transaksi (4)", metode.reduce((s, m) => s + m.jumlah, 0) === 4);
cek("metode: bagian dijumlah 1", Math.abs(metode.reduce((s, m) => s + m.bagian, 0) - 1) < 1e-9);

// Tren: hari tanpa transaksi harus berisi nol, dan diskon dikurangkan.
const tren = trenOmzet(
  [
    { nilai: 45000, hari: "2026-10-02" },
    { nilai: 18000, hari: "2026-10-03" },
  ],
  "2026-10-01",
  "2026-10-04",
);
cek("tren: 4 hari dari 1 s.d. 4 Okt", tren.length === 4);
cek("tren: hari kosong 1 Okt = 0", tren[0]?.nilai === 0);
cek("tren: omzet bersih 2 Okt = 45000 (setelah diskon)", tren[1]?.nilai === 45000);
cek("tren: 3 Okt = 18000", tren[2]?.nilai === 18000);
cek("tren: hari kosong 4 Okt = 0", tren[3]?.nilai === 0);

console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
if (gagal > 0) process.exit(1);
