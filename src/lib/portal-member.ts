/**
 * Alamat portal member publik (situs company profile milik Reyhan).
 *
 * Dipakai CRM untuk membuka kartu digital pelanggan dan mengirim tautannya
 * lewat WhatsApp. Dibuat sebagai satu konstanta supaya perpindahan domain
 * cukup diubah di sini, bukan dicari ke seluruh kode.
 *
 * Nilai bisa ditimpa lewat NEXT_PUBLIC_PORTAL_MEMBER tanpa mengubah kode,
 * jadi alamat sementara (localhost atau domain Vercel) dan alamat resmi
 * (domain sendiri) memakai jalur yang sama.
 */
export const URL_PORTAL_MEMBER =
  process.env.NEXT_PUBLIC_PORTAL_MEMBER?.replace(/\/+$/, "") ||
  "https://kataloji-web.vercel.app";
