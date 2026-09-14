/**
 * Pengambil data yang menembus batas 1000 baris PostgREST.
 *
 * MASALAH YANG DIPERBAIKI
 * Supabase/PostgREST membatasi setiap respons REST maksimum 1000 baris.
 * Batas ini TIDAK memunculkan error: server hanya mengirim 1000 baris
 * pertama dan klien mengira itu seluruh data.
 *
 * Terbukti dengan 1005 baris di database:
 *   Content-Range: 0-999/1005   <- server tahu ada 1005
 *   baris diterima klien: 1000  <- 5 baris hilang tanpa pesan
 *
 * Akibatnya halaman Pelanggan menulis "Total pelanggan: 1000" padahal
 * isinya 1005. Poin pelanggan di luar halaman pertama juga tidak ikut
 * terhitung di dashboard. Tidak ada galat di layar, jadi salahnya
 * sangat sulit disadari.
 *
 * CARA KERJA
 * Ambil per halaman memakai `.range()`, lalu ulangi sampai halaman yang
 * diterima lebih sedikit dari ukuran halaman (tanda sudah habis).
 * Pola ini yang disarankan dokumentasi Supabase: batas 1000 tidak bisa
 * dinaikkan dari sisi klien, jadi harus dipecah menjadi beberapa
 * permintaan.
 */

import { pesanGalat } from "@/lib/pesan-galat";

/** Ukuran satu halaman permintaan. 1000 adalah batas maksimum PostgREST. */
export const UKURAN_HALAMAN = 1000;

/**
 * Batas aman jumlah baris yang mau ditarik. Mencegah satu halaman
 * menarik data tanpa henti. Bila terlampaui, pemanggil diberi tahu
 * lewat `terpotong` supaya bisa menampilkan peringatan jujur.
 */
export const BATAS_AMAN = 20000;

type Hasil<T> = {
  data: T[];
  error: string | null;
  /** true bila BATAS_AMAN tercapai sehingga data mungkin belum lengkap */
  terpotong: boolean;
};

/**
 * Jalankan sebuah query berhalaman sampai habis.
 *
 * @param buatQuery fungsi yang menerima rentang `[dari, sampai]` dan
 *   mengembalikan query Supabase yang sudah di-`order()`. Urutan wajib
 *   tetap sama di setiap halaman, kalau tidak baris bisa terlewat atau
 *   terbaca dua kali.
 */
export async function ambilSemua<T>(
  buatQuery: (dari: number, sampai: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
): Promise<Hasil<T>> {
  const kumpulan: T[] = [];

  for (let dari = 0; dari < BATAS_AMAN; dari += UKURAN_HALAMAN) {
    const sampai = dari + UKURAN_HALAMAN - 1;
    const { data, error } = await buatQuery(dari, sampai);

    if (error) {
      // Pesan teknis dari PostgREST dicatat ke konsol untuk pengembang,
      // sedangkan yang dikembalikan ke pemanggil selalu berbahasa Indonesia.
      // Pemanggil tetap boleh menimpanya dengan pesan yang lebih spesifik.
      console.error("[ambil semua]", error.message);
      return {
        data: kumpulan,
        error: pesanGalat(error, "Gagal memuat data dari server."),
        terpotong: false,
      };
    }

    const baris = (data ?? []) as T[];
    kumpulan.push(...baris);

    // Halaman terakhir selalu lebih pendek (atau tepat kosong).
    if (baris.length < UKURAN_HALAMAN) {
      return { data: kumpulan, error: null, terpotong: false };
    }
  }

  return { data: kumpulan, error: null, terpotong: true };
}
