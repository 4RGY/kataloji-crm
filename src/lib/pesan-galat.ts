/**
 * Penerjemah pesan galat menjadi kalimat yang bisa dibaca pengguna toko.
 *
 * MASALAH YANG DIPERBAIKI
 * Pesan galat mentah dari Supabase berbahasa Inggris dan berisi istilah
 * teknis. Pesan seperti "Invalid login credentials" atau "new row violates
 * row-level security policy" muncul langsung di notifikasi aplikasi.
 *
 * Bagi kasir yang sedang melayani antrean, pesan itu tidak memberi tahu
 * apa yang harus dilakukan. Yang lebih buruk: pesan teknis bisa
 * membocorkan susunan internal database, misalnya nama constraint.
 *
 * CARA KERJA
 * Pesan dicocokkan ke daftar pola. Pola yang cocok menghasilkan kalimat
 * Indonesia yang menjelaskan keadaan sekaligus langkah berikutnya.
 * Pesan yang tidak dikenali TIDAK ditampilkan mentah: yang tampil adalah
 * pesan cadangan berbahasa Indonesia dari pemanggil, sementara pesan asli
 * dicatat ke konsol supaya pengembang tetap bisa melacaknya.
 */

/** Galat bentuk apa pun: Error, objek berpesan, atau nilai lain. */
export type GalatApapun =
  | { message?: string | null; code?: string | null; details?: string | null }
  | string
  | null
  | undefined
  | unknown;

/** Ubah galat bentuk apa pun menjadi satu kalimat. */
export function teksGalat(galat: GalatApapun): string {
  if (!galat) return "";
  if (typeof galat === "string") return galat;
  if (typeof galat === "object") {
    const g = galat as { message?: unknown; error_description?: unknown };
    if (typeof g.message === "string") return g.message;
    if (typeof g.error_description === "string") return g.error_description;
  }
  return String(galat);
}

/**
 * Label Indonesia untuk kolom database yang mungkin disebut di pesan
 * galat. Dipakai supaya "null value in column \"whatsapp\"" berubah
 * menjadi "Nomor WhatsApp wajib diisi."
 */
const LABEL_KOLOM: Record<string, string> = {
  nama: "Nama",
  whatsapp: "Nomor WhatsApp",
  tanggal_lahir: "Tanggal lahir",
  email: "Email",
  password: "Kata sandi",
  role: "Peran",
  total: "Total belanja",
  pelanggan_id: "Pelanggan",
};

function labelKolom(nama: string): string {
  return LABEL_KOLOM[nama] ?? nama;
}

/**
 * Daftar pola. Urutan penting: pola yang lebih khusus diletakkan lebih
 * dulu supaya tidak tertelan pola yang lebih umum.
 */
const POLA: Array<{ cocok: RegExp; pesan: (m: RegExpMatchArray) => string }> = [
  // ---------- Masuk (autentikasi) ----------
  {
    cocok: /invalid login credentials/i,
    pesan: () => "Email atau kata sandi tidak cocok.",
  },
  {
    cocok: /email not confirmed/i,
    pesan: () => "Email ini belum dikonfirmasi. Hubungi admin untuk mengaktifkannya.",
  },
  {
    cocok: /user already registered|already been registered/i,
    pesan: () => "Email itu sudah terdaftar.",
  },
  {
    cocok: /password should be at least (\d+)/i,
    pesan: (m) => `Kata sandi minimal ${m[1]} karakter.`,
  },
  {
    cocok: /new password should be different/i,
    pesan: () => "Kata sandi baru harus berbeda dari yang sekarang.",
  },
  {
    cocok: /unable to validate email address|invalid email/i,
    pesan: () => "Format email tidak dikenali.",
  },
  {
    cocok: /rate limit|too many requests|for security purposes/i,
    pesan: () => "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
  },
  {
    cocok: /signups not allowed|signup is disabled/i,
    pesan: () => "Pendaftaran akun baru sedang ditutup. Hubungi admin.",
  },

  // ---------- Sesi ----------
  {
    cocok: /jwt expired|invalid jwt|invalid claim|token has expired/i,
    pesan: () => "Sesi Anda sudah berakhir. Silakan masuk ulang.",
  },
  {
    cocok: /refresh token not found|invalid refresh token/i,
    pesan: () => "Sesi Anda tidak berlaku lagi. Silakan masuk ulang.",
  },

  // ---------- Izin (RLS) ----------
  {
    cocok: /row-level security policy/i,
    pesan: () => "Anda tidak punya izin untuk menyimpan data ini.",
  },
  {
    cocok: /permission denied/i,
    pesan: () => "Anda tidak punya izin untuk tindakan ini.",
  },

  // ---------- Keunikan data ----------
  {
    // Nama constraint disebut supaya pesannya bisa spesifik.
    cocok: /duplicate key value violates unique constraint/i,
    pesan: (m) => {
      const teks = m.input ?? "";
      if (/whatsapp/i.test(teks)) return "Nomor WhatsApp itu sudah terdaftar.";
      if (/email/i.test(teks)) return "Email itu sudah terdaftar.";
      if (/nama/i.test(teks)) return "Nama itu sudah terdaftar.";
      return "Data itu sudah ada.";
    },
  },

  // ---------- Isian kosong / tidak sah ----------
  {
    cocok: /null value in column "([^"]+)"/i,
    pesan: (m) => `${labelKolom(m[1])} wajib diisi.`,
  },
  {
    cocok: /value too long for type character varying\((\d+)\)/i,
    pesan: (m) => `Isian terlalu panjang, maksimal ${m[1]} karakter.`,
  },
  {
    cocok: /invalid input syntax for type (uuid|timestamp|date|integer|numeric)/i,
    pesan: () => "Data yang dikirim tidak dikenali. Muat ulang halaman lalu coba lagi.",
  },
  {
    cocok: /violates check constraint/i,
    pesan: () => "Isian tidak memenuhi aturan yang berlaku.",
  },
  {
    cocok: /violates foreign key constraint/i,
    pesan: () => "Data yang dirujuk tidak ditemukan. Muat ulang halaman lalu coba lagi.",
  },
  {
    cocok: /division by zero/i,
    pesan: () => "Hitungan tidak bisa diselesaikan karena pembaginya nol.",
  },

  // ---------- Koneksi ----------
  {
    cocok: /failed to fetch|networkerror|load failed|network request failed/i,
    pesan: () => "Tidak bisa menghubungi server. Periksa koneksi internet Anda.",
  },
  {
    cocok: /timeout|timed out|etimedout/i,
    pesan: () => "Server tidak menjawab tepat waktu. Coba lagi.",
  },
  {
    cocok: /econnrefused|connection refused/i,
    pesan: () => "Server menolak sambungan. Coba lagi sebentar lagi.",
  },
];

/**
 * Terjemahkan pesan galat menjadi kalimat Indonesia.
 *
 * @param galat galat dari Supabase, jaringan, atau kode sendiri
 * @param cadangan pesan Indonesia yang dipakai bila polanya tidak dikenali
 * @returns kalimat siap tampil; tidak pernah berisi pesan Inggris mentah
 */
export function pesanGalat(galat: GalatApapun, cadangan: string): string {
  const teks = teksGalat(galat).trim();
  if (!teks) return cadangan;

  for (const p of POLA) {
    const m = teks.match(p.cocok);
    if (m) return p.pesan(m);
  }

  return cadangan;
}

/**
 * Catat pesan asli ke konsol supaya pengembang tetap bisa melacak.
 * Dipisah dari `pesanGalat` supaya pemanggil memutuskan kapan mencatat,
 * dan supaya pengujian tidak memenuhi konsol.
 */
export function catatGalat(konteks: string, galat: GalatApapun): void {
  const teks = teksGalat(galat).trim();
  if (!teks) return;
  // Sengaja console.error: ini jejak untuk pengembang, bukan untuk pengguna.
  console.error(`[${konteks}]`, teks);
}

/**
 * Apakah sebuah pesan masih mengandung kalimat Inggris mentah yang
 * seharusnya tidak pernah tampil ke pengguna. Dipakai oleh pengujian dan
 * pemeriksaan mandiri, bukan oleh alur aplikasi.
 */
export function mengandungInggrisMentah(teks: string): boolean {
  const penanda = [
    "invalid login credentials",
    "email not confirmed",
    "already registered",
    "row-level security",
    "permission denied",
    "duplicate key",
    "null value in column",
    "value too long",
    "invalid input syntax",
    "failed to fetch",
    "network error",
    "jwt expired",
    "violates ",
    "constraint",
    "should be at least",
    "unable to validate",
  ];
  const rendah = teks.toLowerCase();
  return penanda.some((p) => rendah.includes(p));
}
