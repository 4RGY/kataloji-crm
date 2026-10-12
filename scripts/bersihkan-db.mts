// Script cepat: hapus semua pelanggan + transaksi lama, reset ledger
import "./muat-env.mts";
import { getKlienAdmin } from "../src/lib/supabase/admin.ts";

const admin = getKlienAdmin();

console.log("=== Probe data lama ===");
const { data: pelanggan } = await admin.from('pelanggan').select('*');
const { data: transaksi } = await admin.from('transaksi').select('*');
const { data: ledger } = await admin.from('point_ledger').select('*');
const { data: campaign } = await admin.from('campaign_kirim').select('*');

console.log(`Pelanggan: ${pelanggan?.length ?? 0}`);
console.log(`Transaksi: ${transaksi?.length ?? 0}`);
console.log(`Ledger: ${ledger?.length ?? 0}`);
console.log(`Campaign: ${campaign?.length ?? 0}`);

// Ambil semua ID
const pelangganIds = pelanggan?.map(p => p.id) ?? [];
const transaksiIds = transaksi?.map(t => t.id) ?? [];
const ledgerIds = ledger?.map(l => l.id) ?? [];
const campaignIds = campaign?.map(c => c.id) ?? [];

console.log("\n=== Menghapus campaign dulu (FK ke pelanggan) ===");
for (const id of campaignIds) {
  const { error } = await admin.from('campaign_kirim').delete().eq('id', id);
  if (error) console.log("GAGAL hapus campaign", id, ":", error.message);
}
console.log(`Terhapus ${campaignIds.length} campaign`);

console.log("=== Menghapus ledger ===");
for (const id of ledgerIds) {
  const { error } = await admin.from('point_ledger').delete().eq('id', id);
  if (error) console.log("GAGAL hapus ledger", id, ":", error.message);
}
console.log(`Terhapus ${ledgerIds.length} ledger`);

console.log("=== Menghapus transaksi ===");
for (const id of transaksiIds) {
  const { error } = await admin.from('transaksi').delete().eq('id', id);
  if (error) console.log("GAGAL hapus transaksi", id, ":", error.message);
}
console.log(`Terhapus ${transaksiIds.length} transaksi`);

console.log("=== Menghapus pelanggan ===");
for (const id of pelangganIds) {
  const { error } = await admin.from('pelanggan').delete().eq('id', id);
  if (error) console.log("GAGAL hapus pelanggan", id, ":", error.message);
}
console.log(`Terhapus ${pelangganIds.length} pelanggan`);

console.log("\n=== Verifikasi kosong ===");
const { data: cekPelanggan } = await admin.from('pelanggan').select('id');
const { data: cekTransaksi } = await admin.from('transaksi').select('id');
const { data: cekLedger } = await admin.from('point_ledger').select('id');
const { data: cekCampaign } = await admin.from('campaign_kirim').select('id');

console.log(`Pelanggan setelah: ${(cekPelanggan?.length ?? 0)}`);
console.log(`Transaksi setelah: ${(cekTransaksi?.length ?? 0)}`);
console.log(`Ledger setelah: ${(cekLedger?.length ?? 0)}`);
console.log(`Campaign setelah: ${(cekCampaign?.length ?? 0)}`);
console.log("\nSelesai.");
