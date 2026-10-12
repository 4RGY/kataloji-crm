// Bersih-bersih data test yang tersisa
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

console.log("=== Cek sisa data ===");
const { data: pelanggan } = await admin.from('pelanggan').select('*');
const { data: transaksi } = await admin.from('transaksi').select('*');
const { data: ledger } = await admin.from('point_ledger').select('*');

console.log(`Pelanggan: ${pelanggan?.length ?? 0}`);
console.log(`Transaksi: ${transaksi?.length ?? 0}`);
console.log(`Ledger: ${ledger?.length ?? 0}`);

if (pelanggan?.length || transaksi?.length || ledger?.length) {
  console.log("\n=== Membersihkan ===");
  await admin.from('point_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('transaksi').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await admin.from('pelanggan').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Dibersihkan');
} else {
  console.log('DB sudah bersih');
}

console.log("\n=== Status akhir ===");
const { count: p } = await admin.from('pelanggan').select('*', { count: 'exact', head: true });
const { count: t } = await admin.from('transaksi').select('*', { count: 'exact', head: true });
const { count: l } = await admin.from('point_ledger').select('*', { count: 'exact', head: true });
console.log(`Pelanggan: ${p}, Transaksi: ${t}, Ledger: ${l}`);
