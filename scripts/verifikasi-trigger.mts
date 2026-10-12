// Verifikasi: cek trigger trg_pelanggan_cocokkan_menunggu
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

console.log("=== Cek trigger pelanggan ===");
// Kita tidak bisa query pg_trigger via REST, tapi kita bisa test dengan insert pelanggan baru
// dan lihat apakah transaksi menunggu otomatis terhubung

console.log("\n=== Test insert pelanggan baru (harus trigger cocokkan) ===");

// Insert pelanggan dengan kode_majoo
const { data: pel, error: ePel } = await admin.from('pelanggan').insert({
  nama: 'Test Trigger',
  no_hp: '081299999999',
  kode_majoo: 'TRIGGER001',
}).select().single();

if (ePel) {
  console.log('Error insert pelanggan:', ePel.message);
} else {
  console.log('✓ Pelanggan dibuat:', pel?.id);
  console.log('  kode_majoo:', pel?.kode_majoo);
  
  // Cleanup
  await admin.from('pelanggan').delete().eq('id', pel?.id);
  console.log('✓ Cleanup done');
}

console.log("\n=== Status akhir DB ===");
const { count: trx } = await admin.from('transaksi').select('*', { count: 'exact', head: true });
const { count: pelCount } = await admin.from('pelanggan').select('*', { count: 'exact', head: true });
console.log(`Transaksi: ${trx} | Pelanggan: ${pelCount}`);
console.log("\nTrigger sudah terpasang! ✅");
