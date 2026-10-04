// Pulihkan DB produksi ke data user setelah residue uji-import-e2e.
// HAPUS HANYA item residue (created 10-04): pelanggan KA001, transaksi
// CS/23/261002/*, ledger yang menunjuk mereka. Data user (created 10-03)
// TIDAK DISENTUH. Jalan dua fase: --dry-run (cetak yang akan dihapus,
// tidak menghapus) lalu eksekusi.
const { getKlienAdmin } = await import("../src/lib/supabase/admin.ts");
const admin = getKlienAdmin();

const DRY = process.argv.includes("--dry-run");
const CUT = "2026-10-03T23:59:59Z"; // residue = created ATAS ini

// 1. Kumpulkan residue transaksi (ref uji 261002 + created 10-04).
const { data: trxResid } = await admin
  .from("transaksi")
  .select("id, external_ref, pelanggan_id, created_at")
  .or(`external_ref.like.cs/23/261002/%,created_at.gt.${CUT}`)
  .order("created_at");
const trxIds = trxResid.map((t) => t.id);
console.log(`\nResidue transaksi (${trxIds.length}):`);
for (const t of trxResid)
  console.log(`   ${t.external_ref}  t=${t.created_at?.slice(0,16)}  pel=${t.pelanggan_id ?? "(anonim)"}`);

// 2. Residue pelanggan: created 10-04 (data user all created 10-03).
const { data: pelAll } = await admin
  .from("pelanggan")
  .select("id, nama, kode_majoo, created_at")
  .gt("created_at", CUT);
const pelResidIds = pelAll.map((p) => p.id);
console.log(`\nResidue pelanggan (${pelResidIds.length}):`);
for (const p of pelAll)
  console.log(`   ${p.id.slice(0,8)} ${p.nama} kode=${p.kode_majoo} t=${p.created_at?.slice(0,16)}`);

// 3. Residue ledger: created 10-04.
const { data: ledAll } = await admin
  .from("point_ledger")
  .select("id, transaksi_id, pelanggan_id, created_at")
  .gt("created_at", CUT);
console.log(`\nResidue ledger (${ledAll.length}):`);
for (const l of ledAll)
  console.log(`   ${l.id.slice(0,8)} trx=${l.transaksi_id?.slice(0,8)} pel=${l.pelanggan_id?.slice(0,8)} t=${l.created_at?.slice(0,16)}`);

if (DRY) {
  console.log(`\n[DRY-RUN] Tidak ada yang dihapus. Jalankan tanpa --dry-run utk pulihkan.`);
  console.log(
    `Estimasi akhir setelah hapus: pelanggan ${"6 - " + pelResidIds.length}, ` +
      `transaksi ${"19 - " + trxIds.length}, ledger ${"8 - " + ledAll.length}`,
  );
  process.exit(0);
}

// 4. Eksekusi hapus dalam urutan FK: ledger -> transaksi -> pelanggan.
if (ledAll.length) {
  const { error: eLed } = await admin
    .from("point_ledger")
    .delete()
    .in("id", ledAll.map((l) => l.id));
  if (eLed) throw new Error("hapus ledger gagal: " + eLed.message);
}
if (trxIds.length) {
  const { error: eTrx } = await admin.from("transaksi").delete().in("id", trxIds);
  if (eTrx) throw new Error("hapus transaksi gagal: " + eTrx.message);
}
if (pelResidIds.length) {
  const { error: ePel } = await admin
    .from("pelanggan")
    .delete()
    .in("id", pelResidIds);
  if (ePel) throw new Error("hapus pelanggan gagal: " + ePel.message);
}
console.log(`\n=== DIHAPUS: ${ledAll.length} ledger, ${trxIds.length} transaksi, ${pelResidIds.length} pelanggan ===`);

// 5. Verifikasi akhir: harus balik ke 5/9/7 dan TIDAK ada lagi residue 10-04.
const { count: cPel } = await admin.from("pelanggan").select("id", { count: "exact", head: true });
const { count: cTrx } = await admin.from("transaksi").select("id", { count: "exact", head: true });
const { count: cLed } = await admin.from("point_ledger").select("id", { count: "exact", head: true });
const { data: residSisa } = await admin.from("transaksi").select("id").gt("created_at", CUT);
const { data: residSisaPel } = await admin.from("pelanggan").select("id").gt("created_at", CUT);
console.log(`Sisa setelah hapus: pelanggan=${cPel} transaksi=${cTrx} ledger=${cLed}`);
console.log(`Residue 10-04 tersisa: transaksi=${residSisa.length} pelanggan=${residSisaPel.length}`);
const ok = cPel === 5 && cTrx === 9 && cLed === 7 && residSisa.length === 0 && residSisaPel.length === 0;
console.log(ok ? `\n=== LULUS: DB kembali ke data user (5/9/7), residue bersih ===` : `\n!!! PERHATIAN: hitungan tidak sesuai 5/9/7, periksa manual !!!`);
process.exit(ok ? 0 : 1);
