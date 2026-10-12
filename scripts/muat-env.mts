/**
 * Memuat `.env.local` ke process.env untuk skrip yang dijalankan dengan tsx.
 *
 * KENAPA INI PERLU
 * `next dev` memuat `.env.local` sendiri, tetapi `npx tsx scripts/...` TIDAK.
 * Skrip yang memanggil `getKlienAdmin()` karena itu bergantung pada kebetulan
 * lingkungan shell-nya. Kalau shell sudah membawa `NEXT_PUBLIC_SUPABASE_URL`
 * dari proyek lain, skrip akan menembak database proyek itu: tabelnya tidak
 * ketemu, atau lebih buruk, datanya tertulis di sana.
 *
 * Ini bukan kemungkinan teoretis. Terjadi pada 12 Okt 2026: satu skrip uji
 * membaca host proyek lain dan sebelas asersinya gagal dengan pesan
 * "Could not find the table 'public.pelanggan' in the schema cache", padahal
 * database yang benar sehat. Sisa skrip lain bisa saja MENULIS ke proyek salah
 * tanpa ada yang menyadari.
 *
 * CARA PAKAI
 * Taruh sebagai salah satu baris import paling atas:
 *
 *     import "./muat-env.mts";
 *
 * Import bersifat statis dan dieksekusi sebelum isi skrip berjalan, jadi
 * nilainya sudah siap sebelum `getKlienAdmin()` dipanggil.
 *
 * ATURAN BENTROK
 * Nilai dari `.env.local` MENANG, karena berkas itu sumber kebenaran proyek
 * ini. Kalau process.env sudah punya nilai BERBEDA, perbedaannya dicetak
 * sebagai peringatan, bukan didiamkan. Diam-diam memakai salah satu nilai
 * adalah persis jenis kesalahan yang berkas ini dibuat untuk mencegah.
 */

import fs from "node:fs";
import path from "node:path";

const berkas = path.resolve(process.cwd(), ".env.local");

if (!fs.existsSync(berkas)) {
  console.warn(`[muat-env] .env.local tidak ditemukan di ${berkas}`);
} else {
  for (const baris of fs.readFileSync(berkas, "utf8").split("\n")) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;

    const pisah = bersih.indexOf("=");
    if (pisah < 1) continue;

    const kunci = bersih.slice(0, pisah).trim();
    // Buang kutip pembungkus, tapi sisakan karakter lain apa adanya supaya
    // sandi yang memuat tanda kutip atau tanda hubung tidak ikut terpotong.
    let nilai = bersih.slice(pisah + 1).trim();
    if (
      (nilai.startsWith('"') && nilai.endsWith('"')) ||
      (nilai.startsWith("'") && nilai.endsWith("'"))
    ) {
      nilai = nilai.slice(1, -1);
    }

    const sebelumnya = process.env[kunci];
    if (sebelumnya !== undefined && sebelumnya !== nilai) {
      // Hanya sebut nama kunci dan nilai yang AMAN ditampilkan.
      const rahasia = /KEY|SANDI|SECRET|TOKEN|PASSWORD/i.test(kunci);
      const tampil = (v: string) => (rahasia ? `<${v.length} karakter>` : v);
      console.warn(
        `[muat-env] ${kunci} berbeda. process.env=${tampil(sebelumnya)} ` +
          `dipakai .env.local=${tampil(nilai)}. .env.local yang menang.`,
      );
    }

    process.env[kunci] = nilai;
  }
}
