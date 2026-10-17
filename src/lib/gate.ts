/**
 * Gerbang sandi sederhana di depan seluruh aplikasi.
 *
 * Dipakai supaya deployment publik tidak terbuka untuk siapa pun yang
 * menebak URL-nya. Berjalan di middleware (Edge), jadi memakai Web Crypto,
 * bukan modul `crypto` Node.
 *
 * Cara kerja: sandi gerbang dibaca dari GATE_PASSWORD. Setelah sandi benar,
 * server memberi cookie berisi hash (SHA-256) dari sandi, bukan sandi itu
 * sendiri. Cookie tidak bisa dibaca skrip (httpOnly), dan kalau sandi diganti,
 * semua cookie lama otomatis tidak berlaku lagi.
 *
 * Gagal tertutup: kalau GATE_PASSWORD kosong, semua akses ditolak. Lebih baik
 * terkunci daripada diam-diam terbuka karena env lupa diisi.
 */

export const NAMA_COOKIE_GATE = "kataloji_gerbang";

const PANJANG_MIN_SANDI = 8;

async function sha256Hex(teks: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Nilai cookie yang sah untuk sandi tertentu. */
export async function tokenGerbang(sandi: string): Promise<string> {
  return sha256Hex(`kataloji-gerbang-v1|${sandi}`);
}

/** Sandi gerbang dari env, atau null kalau belum diisi / terlalu pendek. */
export function sandiGerbang(): string | null {
  const s = process.env.GATE_PASSWORD;
  if (!s || s.length < PANJANG_MIN_SANDI) return null;
  return s;
}

/** Bandingkan dua string dengan waktu konstan (anti timing attack). */
export function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) {
    selisih |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return selisih === 0;
}

/** Apakah cookie yang dibawa permintaan sudah sah. */
export async function gerbangTerbuka(nilaiCookie: string | undefined): Promise<boolean> {
  const sandi = sandiGerbang();
  if (!sandi || !nilaiCookie) return false;
  return samaAman(nilaiCookie, await tokenGerbang(sandi));
}
