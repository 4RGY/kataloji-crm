// ============================================================
// Modul Pelanggan, Kataloji CRM
// Bagian dari monolit modular Next.js (bukan service terpisah).
//
// Berisi logika murni (tanpa React, tanpa Supabase) supaya bisa
// diuji langsung, pola sama seperti src/lib/poin.ts.
//
// Aturan bisnis terkait (docs/BUSINESS_RULES.md):
// - BR-CUS-01: 3 data standar wajib ditanyakan kasir:
//   nama, nomor WhatsApp, tanggal lahir.
// - BR-CUS-xx: satu nomor WhatsApp = satu pelanggan (deteksi duplikat).
// ============================================================

export interface InputPelanggan {
  nama: string;
  whatsapp: string;
  tgl_lahir: string;
}

/**
 * Rapikan nomor WhatsApp ke format penyimpanan: 62xxxxxxxxxx.
 * Terima variasi yang biasa diketik kasir:
 *   08123456789   -> 628123456789
 *   8123456789    -> 628123456789
 *   +62 812-3456-789 -> 628123456789
 *   62812 3456 789   -> 628123456789
 *   62 08123456789   -> 628123456789   (kasir mengetik 62 lalu 0)
 *
 * WAJIB SINKRON dengan `public.normalisasi_whatsapp()` di
 * `supabase/security-patch-3.sql`. Database adalah penentu akhir; fungsi
 * ini hanya supaya aplikasi bisa memberi pesan ramah lebih dulu. Kalau
 * keduanya berbeda, aplikasi akan mengizinkan nomor yang kemudian
 * ditolak database, dan kasir melihat error teknis alih-alih arahan.
 * Daftar kasus uji bersama ada di `scripts/verify-sql.mjs` (sisi SQL) dan
 * di test ad-hoc (sisi TypeScript). Ubah keduanya bersamaan.
 */
export function normalisasiWhatsapp(input: string): string {
  let digit = (input || "").replace(/\D/g, "");
  if (!digit) return "";

  // URUTAN INI MENIRU public.normalisasi_whatsapp() DI DATABASE PERSIS,
  // termasuk sifatnya yang menerapkan aturan secara berurutan (bukan saling
  // meniadakan). Database adalah penentu akhir karena indeks uniknya memakai
  // fungsi itu; kalau versi ini berbeda, aplikasi akan meloloskan nomor yang
  // kemudian ditolak database dan kasir melihat galat mentah.
  //
  // Contoh yang dulu berbeda: "0087654321" (nol tertekan dua kali).
  //   versi lama di sini -> 62087654321
  //   database           -> 6287654321
  // Kasus itu sekarang ada di scripts/uji-pelanggan-tampilan.mts.

  // 0 di depan menjadi 62 (nomor Indonesia).
  if (digit.startsWith("0")) digit = "62" + digit.slice(1);
  // 8 di depan (ditulis tanpa 0) juga dianggap 62.
  if (digit.startsWith("8")) digit = "62" + digit;
  // 620... (salah tulis 0 setelah 62) dirapikan.
  if (digit.startsWith("620")) digit = "62" + digit.slice(3);

  return digit;
}

/**
 * Tampilkan nomor untuk dibaca manusia: +62 812-3456-789.
 * Kalau nomornya tidak dikenali, kembalikan apa adanya.
 */
export function formatWhatsapp(input: string): string {
  const digit = normalisasiWhatsapp(input);
  if (!digit.startsWith("62") || digit.length < 10) return input || "";
  const sisa = digit.slice(2);
  const bagian = [sisa.slice(0, 3), sisa.slice(3, 7), sisa.slice(7)].filter(
    (b) => b.length > 0,
  );
  return "+62 " + bagian.join("-");
}

/**
 * Validasi data pelanggan. Mengembalikan daftar pesan error
 * dalam bahasa Indonesia. Daftar kosong berarti data valid.
 */
export function validasiPelanggan(input: InputPelanggan): string[] {
  const errors: string[] = [];

  const nama = (input.nama || "").trim();
  if (!nama) {
    errors.push("Nama pelanggan wajib diisi.");
  } else if (nama.length < 2) {
    errors.push("Nama pelanggan minimal 2 karakter.");
  } else if (nama.length > 80) {
    errors.push("Nama pelanggan maksimal 80 karakter.");
  }

  const wa = normalisasiWhatsapp(input.whatsapp);
  if (!wa) {
    errors.push("Nomor WhatsApp wajib diisi.");
  } else if (!wa.startsWith("62")) {
    errors.push("Nomor WhatsApp harus nomor Indonesia (awali 08 atau 62).");
  } else if (wa.length < 11 || wa.length > 15) {
    errors.push("Panjang nomor WhatsApp tidak wajar (11 sampai 15 angka).");
  }

  // Tanggal lahir: wajib (BR-CUS-01), tidak boleh masa depan,
  // dan tidak boleh lebih tua dari 120 tahun.
  if (!input.tgl_lahir) {
    errors.push("Tanggal lahir wajib diisi.");
  } else {
    const tgl = new Date(input.tgl_lahir + "T00:00:00");
    if (Number.isNaN(tgl.getTime())) {
      errors.push("Tanggal lahir tidak dikenali.");
    } else {
      const hariIni = new Date();
      hariIni.setHours(0, 0, 0, 0);
      if (tgl > hariIni) {
        errors.push("Tanggal lahir tidak boleh di masa depan.");
      } else {
        const batasTua = new Date(hariIni);
        batasTua.setFullYear(batasTua.getFullYear() - 120);
        if (tgl < batasTua) {
          errors.push("Tanggal lahir tidak wajar (lebih dari 120 tahun lalu).");
        }
      }
    }
  }

  return errors;
}

/**
 * Cari pelanggan berdasarkan kata kunci bebas.
 * Cocokkan ke nama (tanpa peduli besar-kecil huruf) DAN nomor WhatsApp.
 *
 * Nomor dicocokkan dalam dua bentuk supaya kasir bebas mengetik:
 * - angka mentah, mis. "789" atau "8123"
 * - setelah dinormalisasi, mis. "0812" dan "62812" sama-sama ketemu
 */
export function cocokCari(
  pelanggan: { nama: string; whatsapp: string },
  query: string,
): boolean {
  const q = (query || "").trim();
  if (!q) return true;

  const qHuruf = q.toLowerCase();
  if (pelanggan.nama.toLowerCase().includes(qHuruf)) return true;

  const qAngka = q.replace(/\D/g, "");
  if (!qAngka) return false;

  const nomorTersimpan = normalisasiWhatsapp(pelanggan.whatsapp);
  if (nomorTersimpan.includes(qAngka)) return true;

  // "0812" harus ketemu "62812...", jadi query ikut dinormalisasi.
  const qNormal = normalisasiWhatsapp(q);
  if (qNormal && nomorTersimpan.includes(qNormal)) return true;

  return false;
}
