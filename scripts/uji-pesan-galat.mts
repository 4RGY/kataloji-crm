/**
 * Uji penerjemah pesan galat (src/lib/pesan-galat.ts).
 *
 * Dua hal yang dibuktikan:
 *   1. pesan dikenal -> diterjemahkan tepat
 *   2. pesan TIDAK dikenal -> tidak pernah bocor mentah; selalu memakai
 *      pesan cadangan berbahasa Indonesia
 *
 * Poin 2 yang paling penting. Kalau hanya menguji pesan yang dikenal,
 * bug "pesan Inggris muncul di layar" bisa lolos tanpa terdeteksi.
 *
 * Jalankan: npx tsx scripts/uji-pesan-galat.mts
 */
import {
  mengandungInggrisMentah,
  pesanGalat,
  teksGalat,
} from "../src/lib/pesan-galat.ts";

let lulus = 0;
let gagal = 0;

function sama(label: string, dapat: unknown, harus: unknown) {
  if (JSON.stringify(dapat) === JSON.stringify(harus)) {
    lulus++;
  } else {
    gagal++;
    console.log(
      "FAIL  " + label +
      "\n      dapat : " + JSON.stringify(dapat) +
      "\n      harus : " + JSON.stringify(harus),
    );
  }
}

const CADANGAN = "Gagal menyimpan. Coba lagi.";

// ---------- teksGalat: berbagai bentuk galat ----------
sama("teksGalat dari Error", teksGalat(new Error("boom")), "boom");
sama("teksGalat dari objek message", teksGalat({ message: "pesan" }), "pesan");
sama(
  "teksGalat dari error_description",
  teksGalat({ error_description: "deskripsi" }),
  "deskripsi",
);
sama("teksGalat dari string", teksGalat("teks"), "teks");
sama("teksGalat dari null", teksGalat(null), "");
sama("teksGalat dari undefined", teksGalat(undefined), "");
sama("teksGalat dari angka", teksGalat(42), "42");
sama(
  "teksGalat lebih suka message daripada error_description",
  teksGalat({ message: "m", error_description: "d" }),
  "m",
);

// ---------- autentikasi ----------
sama(
  "kredensial salah",
  pesanGalat({ message: "Invalid login credentials" }, CADANGAN),
  "Email atau kata sandi tidak cocok.",
);
sama(
  "huruf besar/kecil bebas",
  pesanGalat({ message: "INVALID LOGIN CREDENTIALS" }, CADANGAN),
  "Email atau kata sandi tidak cocok.",
);
sama(
  "email belum dikonfirmasi",
  pesanGalat({ message: "Email not confirmed" }, CADANGAN),
  "Email ini belum dikonfirmasi. Hubungi admin untuk mengaktifkannya.",
);
sama(
  "email sudah terdaftar",
  pesanGalat({ message: "User already registered" }, CADANGAN),
  "Email itu sudah terdaftar.",
);
sama(
  "sandi terlalu pendek, ambil angkanya",
  pesanGalat({ message: "Password should be at least 6 characters" }, CADANGAN),
  "Kata sandi minimal 6 karakter.",
);
sama(
  "sandi harus beda",
  pesanGalat({ message: "New password should be different from the old password" }, CADANGAN),
  "Kata sandi baru harus berbeda dari yang sekarang.",
);
sama(
  "email tidak sah",
  pesanGalat({ message: "Unable to validate email address: invalid format" }, CADANGAN),
  "Format email tidak dikenali.",
);
sama(
  "kena batas percobaan",
  pesanGalat({ message: "Email rate limit exceeded" }, CADANGAN),
  "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
);
sama(
  "for security purposes (bentuk lain batas percobaan)",
  pesanGalat(
    { message: "For security purposes, you can only request this after 43 seconds" },
    CADANGAN,
  ),
  "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
);
sama(
  "pendaftaran ditutup",
  pesanGalat({ message: "Signups not allowed for this instance" }, CADANGAN),
  "Pendaftaran akun baru sedang ditutup. Hubungi admin.",
);

// ---------- sesi ----------
sama(
  "token kedaluwarsa",
  pesanGalat({ message: "JWT expired" }, CADANGAN),
  "Sesi Anda sudah berakhir. Silakan masuk ulang.",
);
sama(
  "refresh token hilang",
  pesanGalat({ message: "Invalid Refresh Token: Refresh Token Not Found" }, CADANGAN),
  "Sesi Anda tidak berlaku lagi. Silakan masuk ulang.",
);

// ---------- izin ----------
sama(
  "ditolak RLS",
  pesanGalat(
    { message: 'new row violates row-level security policy for table "pelanggan"' },
    CADANGAN,
  ),
  "Anda tidak punya izin untuk menyimpan data ini.",
);
sama(
  "permission denied",
  pesanGalat({ message: "permission denied for function saldo_poin" }, CADANGAN),
  "Anda tidak punya izin untuk tindakan ini.",
);

// ---------- keunikan ----------
sama(
  "nomor WhatsApp kembar",
  pesanGalat(
    { message: 'duplicate key value violates unique constraint "pelanggan_whatsapp_key"' },
    CADANGAN,
  ),
  "Nomor WhatsApp itu sudah terdaftar.",
);
sama(
  "email kembar",
  pesanGalat(
    { message: 'duplicate key value violates unique constraint "profile_email_key"' },
    CADANGAN,
  ),
  "Email itu sudah terdaftar.",
);
sama(
  "constraint tak dikenal tetap masuk akal",
  pesanGalat(
    { message: 'duplicate key value violates unique constraint "transaksi_ref_key"' },
    CADANGAN,
  ),
  "Data itu sudah ada.",
);

// ---------- isian tidak sah ----------
sama(
  "kolom wajib kosong",
  pesanGalat({ message: 'null value in column "whatsapp" violates not-null constraint' }, CADANGAN),
  "Nomor WhatsApp wajib diisi.",
);
sama(
  "kolom wajib kosong (nama)",
  pesanGalat({ message: 'null value in column "nama" violates not-null constraint' }, CADANGAN),
  "Nama wajib diisi.",
);
sama(
  "kolom tak dikenal sebut namanya apa adanya",
  pesanGalat({ message: 'null value in column "catatan_khusus" violates not-null constraint' }, CADANGAN),
  "catatan_khusus wajib diisi.",
);
sama(
  "isian kepanjangan",
  pesanGalat({ message: "value too long for type character varying(120)" }, CADANGAN),
  "Isian terlalu panjang, maksimal 120 karakter.",
);
sama(
  "uuid tidak sah",
  pesanGalat({ message: 'invalid input syntax for type uuid: "bukan-uuid"' }, CADANGAN),
  "Data yang dikirim tidak dikenali. Muat ulang halaman lalu coba lagi.",
);
sama(
  "aturan check dilanggar",
  pesanGalat({ message: 'new row for relation "transaksi" violates check constraint "total_positif"' }, CADANGAN),
  "Isian tidak memenuhi aturan yang berlaku.",
);
sama(
  "relasi tidak ada",
  pesanGalat({ message: 'insert or update on table "transaksi" violates foreign key constraint "transaksi_pelanggan_id_fkey"' }, CADANGAN),
  "Data yang dirujuk tidak ditemukan. Muat ulang halaman lalu coba lagi.",
);

// ---------- jaringan ----------
sama(
  "jaringan putus",
  pesanGalat({ message: "TypeError: Failed to fetch" }, CADANGAN),
  "Tidak bisa menghubungi server. Periksa koneksi internet Anda.",
);
sama(
  "waktu habis",
  pesanGalat({ message: "Request timeout" }, CADANGAN),
  "Server tidak menjawab tepat waktu. Coba lagi.",
);
sama(
  "sambungan ditolak",
  pesanGalat({ message: "connect ECONNREFUSED 127.0.0.1:5432" }, CADANGAN),
  "Server menolak sambungan. Coba lagi sebentar lagi.",
);

// ---------- YANG PALING PENTING: pesan tak dikenal ----------
sama(
  "pesan asing jatuh ke cadangan",
  pesanGalat({ message: "SomeWeirdBackendGlitch at handler.go:412" }, CADANGAN),
  CADANGAN,
);
sama(
  "kode galat saja (tanpa pesan) jatuh ke cadangan",
  pesanGalat({ code: "42P01" }, CADANGAN),
  CADANGAN,
);
sama("galat kosong jatuh ke cadangan", pesanGalat(null, CADANGAN), CADANGAN);
sama("galat string kosong jatuh ke cadangan", pesanGalat("", CADANGAN), CADANGAN);
sama(
  "galat spasi saja jatuh ke cadangan",
  pesanGalat({ message: "   " }, CADANGAN),
  CADANGAN,
);

// ---------- tidak ada hasil terjemahan yang mengandung Inggris mentah ----------
const CONTOH_MENTAH = [
  "Invalid login credentials",
  "Email not confirmed",
  "User already registered",
  "Password should be at least 6 characters",
  'new row violates row-level security policy for table "pelanggan"',
  "permission denied for function saldo_poin",
  'duplicate key value violates unique constraint "pelanggan_whatsapp_key"',
  'null value in column "whatsapp" violates not-null constraint',
  "value too long for type character varying(120)",
  'invalid input syntax for type uuid: "x"',
  'violates check constraint "total_positif"',
  'violates foreign key constraint "transaksi_pelanggan_id_fkey"',
  "TypeError: Failed to fetch",
  "Request timeout",
  "connect ECONNREFUSED 127.0.0.1:5432",
  "JWT expired",
  "Invalid Refresh Token: Refresh Token Not Found",
  "SomeWeirdBackendGlitch at handler.go:412",
  "Signups not allowed for this instance",
  "For security purposes, you can only request this after 43 seconds",
];

let bocor = 0;
for (const mentah of CONTOH_MENTAH) {
  const hasil = pesanGalat({ message: mentah }, CADANGAN);
  if (mengandungInggrisMentah(hasil)) {
    bocor++;
    console.log("FAIL  masih ada Inggris mentah -> " + hasil);
  }
  if (hasil === mentah) {
    bocor++;
    console.log("FAIL  pesan mentah diteruskan apa adanya -> " + hasil);
  }
}
sama("tidak ada satupun terjemahan yang membocorkan pesan mentah", bocor, 0);

// ---------- bantu pemeriksaan mandiri ----------
sama(
  "pendeteksi menandai pesan mentah",
  mengandungInggrisMentah("Invalid login credentials"),
  true,
);
sama(
  "pendeteksi tidak menandai pesan Indonesia",
  mengandungInggrisMentah("Email atau kata sandi tidak cocok."),
  false,
);
sama(
  'kata "constraint" saja sudah ditandai',
  mengandungInggrisMentah("pelanggan_whatsapp_key constraint"),
  true,
);

console.log("");
console.log(`=== ${lulus} LULUS, ${gagal} GAGAL ===`);
process.exitCode = gagal === 0 ? 0 : 1;
