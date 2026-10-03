import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const folder = 'contoh-majoo-dummy';

// Buat folder jika belum ada
if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder, { recursive: true });
}

// Data pelanggan
const pelangganData = [
  ['Kode Pelanggan', 'Nama Pelanggan', 'Jenis Kelamin', 'Alamat', 'Tanggal Lahir', 'Kota', 'Email', 'No Telepon', 'Jumlah Poin Reward', 'Saldo Deposit(Rp)', 'Grup Pelanggan'],
  ['KA001', 'Budi Santoso', 'L', 'Jl. Merdeka No 12', '1990-05-15', 'Bandung', 'budi@email.com', '081234567890', '150', 'Rp0.00', 'Member'],
  ['KA002', 'Siti Nurhaliza', 'P', 'Jl. Cihampelas No 45', '1995-03-12', 'Bandung', 'siti@email.com', '081298765432', '80', 'Rp0.00', 'Member'],
  ['KA003', 'Andi Wijaya', 'L', 'Jl. Dago No 8', '1993-07-28', 'Bandung', 'andi@email.com', '081345678901', '200', 'Rp50.000', 'VIP'],
  ['KA004', 'Rina Kartika', 'P', 'Jl. Buah Batu No 77', '1998-11-20', 'Bandung', 'rina@email.com', '081456789012', '45', 'Rp0.00', 'Member'],
  ['KA005', 'Dedi Kurniawan', 'L', 'Jl. Sukabumi No 3', '1992-01-14', 'Bandung', 'dedi@email.com', '081567890123', '120', 'Rp0.00', 'Member'],
];

// Data transaksi
const transaksiData = [
  ['No', 'Waktu', 'Kode Pelanggan', 'Nama Pelanggan', 'Produk', 'Metode Pembayaran', 'Total Penjualan', 'Subtotal'],
  ['CS/23/261002/0001', '2026-10-02 10:15', 'KA001', 'Budi Santoso', 'Kopi Susu Gula Aren, Roti Bakar', 'Tunai', 'Rp45.000', '45.000'],
  ['CS/23/261002/0002', '2026-10-02 10:30', 'KA002', 'Siti Nurhaliza', 'Matcha Latte, Croissant', 'QRIS', 'Rp62.000', '62.000'],
  ['CS/23/261002/0003', '2026-10-02 11:00', 'KA003', 'Andi Wijaya', 'Americano', 'Tunai', 'Rp22.000', '22.000'],
  ['CS/23/261002/0004', '2026-10-02 11:15', 'KA001', 'Budi Santoso', 'Es Kopi Susu', 'QRIS', 'Rp28.000', '28.000'],
  ['CS/23/261002/0005', '2026-10-02 12:00', '', 'Walk-in Guest', 'Es Teh Manis', 'Tunai', 'Rp12.000', '12.000'],
  ['CS/23/261002/0006', '2026-10-02 13:30', 'KA004', 'Rina Kartika', 'Kopi Hitam, Pisang Goreng', 'Tunai', 'Rp35.000', '35.000'],
  ['CS/23/261002/0007', '2026-10-02 14:00', 'KA005', 'Dedi Kurniawan', 'Cappuccino', 'Debit', 'Rp25.000', '25.000'],
  ['CS/23/261002/0008', '2026-10-02 15:45', 'KA003', 'Andi Wijaya', 'Chai Latte, Donat', 'QRIS', 'Rp48.000', '48.000'],
  ['CS/23/261002/0009', '2026-10-02 16:20', '', 'Walk-in Guest', 'Es Jeruk', 'Tunai', 'Rp15.000', '15.000'],
  ['CS/23/261002/0010', '2026-10-02 17:00', 'KA002', 'Siti Nurhaliza', 'Mocha Frappe', 'QRIS', 'Rp38.000', '38.000'],
];

// Buat workbook pelanggan
const wbPelanggan = XLSX.utils.book_new();
const wsPelanggan = XLSX.utils.aoa_to_sheet(pelangganData);
XLSX.utils.book_append_sheet(wbPelanggan, wsPelanggan, 'Sheet1');

// Tulis file
const pathPelanggan = path.join(folder, 'data_pelanggan_2026_10_02.xlsx');
XLSX.writeFile(wbPelanggan, pathPelanggan);
console.log('✓ Dibuat:', pathPelanggan);

// Buat workbook transaksi
const wbTransaksi = XLSX.utils.book_new();
const wsTransaksi = XLSX.utils.aoa_to_sheet(transaksiData);
XLSX.utils.book_append_sheet(wbTransaksi, wsTransaksi, 'Sheet1');

const pathTransaksi = path.join(folder, 'detail_penjualan_2026_10_02.xlsx');
XLSX.writeFile(wbTransaksi, pathTransaksi);
console.log('✓ Dibuat:', pathTransaksi);

console.log('\n✅ Dummy files berhasil dibuat!');
console.log('Folder:', path.resolve(folder));
console.log('\nJumlah data:');
console.log(`- Pelanggan: ${pelangganData.length - 1} orang`);
console.log(`- Transaksi: ${transaksiData.length - 1} transaksi`);
console.log('\nSkenario testing:');
console.log('- 2 transaksi walk-in (tanpa pelanggan) -> status anonim');
console.log('- Budi 2x di hari sama -> repeat order (0 poin)');
console.log('- Andi 2x di hari sama -> repeat order (0 poin)');
console.log('- Siti 1x -> dapat 1 poin');
console.log('- Rina 1x -> dapat 1 poin');
console.log('- Dedi 1x -> dapat 1 poin');
