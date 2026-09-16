// ============================================================
// Modul Staf, Kataloji CRM
// Bagian dari monolit modular Next.js (bukan service terpisah).
//
// Berisi logika murni (tanpa React, tanpa Supabase) supaya bisa diuji
// langsung, pola sama seperti src/lib/poin.ts dan src/lib/pelanggan.ts.
//
// Aturan bisnis terkait (docs/BUSINESS_RULES.md):
// - BR-STF-01: hanya admin yang boleh menambah, mengubah, dan
//   menonaktifkan akun staf.
// - BR-STF-02: peran yang dikenali ada tiga: admin, manager, kasir.
// - BR-STF-03: akun baru dibuat dengan peran paling rendah (kasir)
//   kecuali admin memilih peran lain secara sadar.
// ============================================================

export const ROLE_VALID = ["admin", "manager", "kasir"] as const;
export type Role = (typeof ROLE_VALID)[number];

export const LABEL_ROLE: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  kasir: "Kasir",
};

/** Keterangan singkat tiap peran, dipakai di halaman Staf. */
export const KETERANGAN_ROLE: Record<string, string> = {
  admin: "Akses penuh, termasuk mengelola akun staf dan menghapus data.",
  manager: "Bisa mengubah data pelanggan dan transaksi, tidak bisa mengelola staf.",
  kasir: "Hanya mencatat transaksi dan menambah pelanggan baru.",
};

export interface InputStafBaru {
  nama: string;
  email: string;
  role: string;
  password: string;
}

export function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLE_VALID as readonly string[]).includes(x);
}

/**
 * Pola email yang sengaja longgar. Tujuan penyaring ini hanya menangkap
 * salah ketik yang jelas (tanpa "@", tanpa domain). Validasi ketat
 * diserahkan ke Supabase Auth, karena hanya dia yang tahu aturan akhirnya.
 */
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validasi data staf baru. Mengembalikan daftar pesan error dalam bahasa
 * Indonesia. Daftar kosong berarti data valid.
 *
 * Aturan kata sandi disamakan dengan pengaturan bawaan Supabase Auth
 * (minimal 8 karakter, memuat huruf dan angka). Kalau aplikasi meloloskan
 * sandi yang lebih lemah, akun akan gagal dibuat di tengah proses dan
 * admin melihat error teknis alih-alih arahan.
 */
export function validasiStafBaru(input: InputStafBaru): string[] {
  const errors: string[] = [];

  const nama = (input.nama || "").trim();
  if (!nama) {
    errors.push("Nama staf wajib diisi.");
  } else if (nama.length < 2) {
    errors.push("Nama staf minimal 2 karakter.");
  } else if (nama.length > 80) {
    errors.push("Nama staf maksimal 80 karakter.");
  }

  const email = (input.email || "").trim();
  if (!email) {
    errors.push("Email wajib diisi.");
  } else if (!POLA_EMAIL.test(email)) {
    errors.push("Format email tidak dikenali.");
  } else if (email.length > 160) {
    errors.push("Email maksimal 160 karakter.");
  }

  if (!isRole(input.role)) {
    errors.push("Peran staf tidak dikenali.");
  }

  const sandi = input.password || "";
  if (!sandi) {
    errors.push("Kata sandi wajib diisi.");
  } else if (sandi.length < 8) {
    errors.push("Kata sandi minimal 8 karakter.");
  } else if (!/[a-zA-Z]/.test(sandi) || !/[0-9]/.test(sandi)) {
    errors.push("Kata sandi harus memuat huruf dan angka.");
  }

  return errors;
}

/**
 * Validasi perubahan data staf (tanpa kata sandi).
 * Dipakai untuk mengubah nama tampilan dan peran.
 */
export function validasiUbahStaf(input: {
  nama: string;
  role: string;
}): string[] {
  const errors: string[] = [];

  const nama = (input.nama || "").trim();
  if (!nama) {
    errors.push("Nama staf wajib diisi.");
  } else if (nama.length < 2) {
    errors.push("Nama staf minimal 2 karakter.");
  } else if (nama.length > 80) {
    errors.push("Nama staf maksimal 80 karakter.");
  }

  if (!isRole(input.role)) {
    errors.push("Peran staf tidak dikenali.");
  }

  return errors;
}

/**
 * Ambil nama panggilan dari identitas yang sedang login.
 * Urutan prioritas: kolom `profile.nama` (nama staf asli), lalu bagian
 * sebelum "@" dari email, terakhir "Staf".
 *
 * Dipakai supaya sapaan di dashboard tidak menampilkan nama orang lain.
 * `profile.nama` diisi email oleh trigger pendaftaran, jadi nilai yang
 * mengandung "@" tidak lebih baik daripada emailnya sendiri.
 */
export function namaPanggilan(
  nama: string | null,
  email: string | null,
): string {
  const bersih = (nama ?? "").trim();

  const rapikan = (t: string) => {
    const kata = t.split(/\s+/)[0] ?? "";
    // Nama yang diambil dari email biasanya huruf kecil semua
    // ("wahyu@kataloji.id"), jadi huruf pertamanya dibesarkan supaya
    // sapaan tidak terlihat seperti nama pengguna mentah.
    return kata ? kata.charAt(0).toUpperCase() + kata.slice(1) : "";
  };

  if (bersih && !bersih.includes("@")) return rapikan(bersih);

  // Diambil dari email: buang bagian domain dulu, kalau tidak sapaan
  // akan berbunyi "wahyu@kataloji.id" alih-alih "Wahyu".
  const surel = (email ?? "").trim();
  const dariEmail = surel.includes("@") ? surel.split("@")[0] : surel;
  return rapikan(dariEmail) || rapikan(bersih) || "Staf";
}

/**
 * Inisial untuk avatar, maksimal dua huruf.
 * "Budi Santoso" -> "BS", "wahyu@kataloji.id" -> "WA".
 *
 * Bagian domain dibuang lebih dulu untuk nilai yang berupa email. Tanpa
 * itu, "wahyu@kataloji.id" akan dipecah menjadi "wahyu@kataloji" dan "id"
 * sehingga avatarnya berbunyi "WI", bukan "WA".
 */
export function inisial(nama: string): string {
  const bersih = (nama || "").trim();
  if (!bersih) return "?";

  const tanpaDomain = bersih.includes("@") ? bersih.split("@")[0] : bersih;

  const kata = tanpaDomain
    .split(/[\s._-]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  if (kata.length === 0) return "?";
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[1][0]).toUpperCase();
}

/**
 * Menu yang boleh dilihat sebuah peran.
 *
 * Dipisah dari komponen supaya bisa diuji tanpa merender apa pun, dan
 * supaya aturannya cuma hidup di satu tempat. Sebelum ini syaratnya ditulis
 * langsung di dalam komponen, dan akibatnya manajer tidak melihat menu
 * "Rekap kasir" padahal halamannya mengizinkan dia masuk dan menampilkan
 * datanya. Menu yang hilang untuk halaman yang sebenarnya boleh dibuka
 * membuat fiturnya seperti tidak ada.
 *
 * Aturannya:
 *   admin     semua menu
 *   manager   rekap kasir dan pemasaran, TIDAK boleh kelola akun staf
 *   kasir     tidak satu pun
 *
 * Campaign dan Analitik dikeluarkan dari kasir sejak pemeriksaan 16 Sep 2026.
 * Alasannya bukan soal kerahasiaan, keduanya tidak menampilkan data yang
 * lebih sensitif daripada halaman Pelanggan yang memang boleh dia buka.
 * Alasannya beban perhatian: kasir memakai layar ini sambil menghadapi
 * antrean, dan menu yang tidak pernah dia pakai memperpanjang daftar yang
 * harus dilewati untuk mencapai Transaksi. Mengirim pesan promosi juga
 * bukan keputusan yang diambil di tengah melayani pembeli.
 */
export interface MenuKhusus {
  rekap: boolean;
  staf: boolean;
  /** Campaign dan Analitik, keputusan tingkat pengelola. */
  pemasaran: boolean;
}

export function menuUntukPeran(role: string | null | undefined): MenuKhusus {
  if (role === "admin") return { rekap: true, staf: true, pemasaran: true };
  if (role === "manager") return { rekap: true, staf: false, pemasaran: true };
  return { rekap: false, staf: false, pemasaran: false };
}

/**
 * Boleh tidaknya membuka halaman Campaign dan Analitik.
 *
 * WAJIB sama dengan menuUntukPeran().pemasaran, dengan alasan yang sama
 * seperti bolehLihatRekap: menu dan halaman tidak boleh berbeda pendapat.
 */
export function bolehLihatPemasaran(role: string | null | undefined): boolean {
  return menuUntukPeran(role).pemasaran;
}

/**
 * Boleh tidaknya membuka halaman Rekap kasir.
 *
 * WAJIB sama dengan menuUntukPeran().rekap. Kalau halaman mengizinkan
 * sementara menunya disembunyikan, fiturnya jadi tidak bisa ditemukan; kalau
 * menunya muncul sementara halaman menolak, pengguna menekan pintu yang
 * terkunci.
 */
export function bolehLihatRekap(role: string | null | undefined): boolean {
  return menuUntukPeran(role).rekap;
}
