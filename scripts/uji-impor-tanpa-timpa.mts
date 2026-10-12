// Uji impor tanpa timpa, HANYA data "QA Buangan" (aman untuk DB produksi).
// Membuktikan: (1) baru dibuat, (2) impor ulang TIDAK menimpa nilai,
// (3) impor ulang TIDAK menggandakan. Hanya baris uji yang dibuat skrip ini
// yang dihapus di akhir, dilacak lewat ID.
const { getKlienAdmin } = await import("../src/lib/supabase/admin.ts");
const { parseMajoo } = await import("../src/lib/impor-majoo.ts");
const { tulisImporMajoo } = await import("../src/lib/tulis-impor-majoo.ts");

const KODE = "QA-IMP-KODE-1";
const REF = "QA-IMP-TRX-1";
const WA = "0812" + String(Date.now()).slice(-6) + "77";
const admin = getKlienAdmin();
const dibuatPelangganIds: string[] = [];
const dibuatTrxIds: string[] = [];
let lulus = 0;
let gagal = 0;
const cek = (nama: string, ok: boolean) => {
  console.log((ok ? "LULUS " : "GAGAL ") + nama);
  if (ok) lulus++;
  else gagal++;
};

const pelRaw = [
  ["Data Pelanggan", "", ""], ["Pencarian", "", ""], ["Date Generated: 19/09/2026", "", ""],
  ["", "", ""], ["", "", ""], ["", "", ""],
  ["Kode Pelanggan", "Nama Pelanggan", "No Telepon", "Tanggal Lahir", "Jenis Kelamin", "Email", "Alamat"],
  [KODE, "QA Buangan Impor", WA, "19/09/2000", "L", "qa@example.com", "Jl. QA 1"],
];
const trxRaw = [
  ["No", "Total Penjualan", "Metode Pembayaran", "Produk"],
  [REF, "75.900", "QRIS", "Kopi Uji"],
];
const trxRaw2 = [
  ["No", "Total Penjualan", "Metode Pembayaran", "Produk"],
  [REF, "99.000", "TUNAI", "Menu Beda"],
];

try {
  const p1 = parseMajoo(pelRaw).pelanggan;
  const t1 = parseMajoo(trxRaw).transaksi;

  // (1) Tulis pertama: harus dibuat
  const r1 = await tulisImporMajoo(admin, p1, t1);
  cek("tulis pertama membuat 1 pelanggan", r1.pelanggan.dibuat === 1);
  cek("tulis pertama membuat 1 transaksi", r1.transaksi.dibuat === 1);

  const { data: pel } = await admin.from("pelanggan").select("id,nama,whatsapp").eq("kode_majoo", KODE);
  const { data: trx } = await admin.from("transaksi").select("id,total,metode_bayar").eq("external_ref", REF);
  (pel ?? []).forEach((x) => dibuatPelangganIds.push(x.id));
  (trx ?? []).forEach((x) => dibuatTrxIds.push(x.id));
  cek("pelanggan tersimpan dengan nama awal", pel?.[0]?.nama === "QA Buangan Impor");
  cek("transaksi tersimpan dengan total awal 75900", Number(trx?.[0]?.total) === 75900);

  // (2) Impor ulang dengan nilai BEDA: nilai lama harus tetap
  const p2 = parseMajoo(pelRaw.map((r, i) => (i === 7 ? [KODE, "NAMA DIUBAH", WA, "01/01/1990", "P", "x@x.com", "Alamat lain"] : r))).pelanggan;
  const t2 = parseMajoo(trxRaw2).transaksi;
  const r2 = await tulisImporMajoo(admin, p2, t2);
  cek("impor ulang: pelanggan dilewati, tidak diperbarui", r2.pelanggan.diperbarui === 0 && r2.pelanggan.dilewati >= 1);
  cek("impor ulang: transaksi dilewati, tidak diperbarui", r2.transaksi.diperbarui === 0 && r2.transaksi.dilewati >= 1);

  const { data: pel2 } = await admin.from("pelanggan").select("nama").eq("kode_majoo", KODE);
  const { data: trx2 } = await admin.from("transaksi").select("total,metode_bayar").eq("external_ref", REF);
  cek("nama pelanggan TIDAK berubah ke NAMA DIUBAH", pel2?.[0]?.nama === "QA Buangan Impor");
  cek("total transaksi TIDAK berubah dari 75900 ke 99000", Number(trx2?.[0]?.total) === 75900);
  cek("metode TIDAK berubah dari QRIS", trx2?.[0]?.metode_bayar === "QRIS");

  // (3) Tidak menggandakan
  cek("tidak ada pelanggan ganda", (pel2 ?? []).length === 1);
  cek("tidak ada transaksi ganda", (trx2 ?? []).length === 1);
} finally {
  // Bersihkan HANYA baris yang dibuat skrip ini (dilacak ID).
  if (dibuatTrxIds.length) await admin.from("transaksi").delete().in("id", dibuatTrxIds);
  if (dibuatPelangganIds.length) await admin.from("pelanggan").delete().in("id", dibuatPelangganIds);
  console.log(`bersih: ${dibuatTrxIds.length} transaksi, ${dibuatPelangganIds.length} pelanggan uji dihapus`);
}
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exit(gagal ? 1 : 0);
