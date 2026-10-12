/**
 * Filter periode untuk laporan analitik.
 *
 * Murni: tidak menyentuh DB atau DOM. Hari transaksi memakai aturan terpusat
 * `hariLaporanAtauNull` (tanggal_majoo untuk impor H+1, created_at untuk
 * transaksi manual), jadi laporan tidak menggeser satu hari.
 */
import { hariLaporanAtauNull, type BasisHariLaporan } from "./hari-laporan";

export type JenisPeriode = "hari_ini" | "kemarin" | "minggu_ini" | "bulan_ini" | "tanggal";

export interface Periode {
  jenis: JenisPeriode;
  /** Wajib untuk jenis "tanggal", format YYYY-MM-DD. */
  tanggal?: string;
}

export interface RentangPeriode {
  /** Awal hari (inklusif), waktu lokal. */
  dari: Date;
  /** Awal hari setelah rentang (eksklusif), waktu lokal. */
  sampai: Date;
  label: string;
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function awalHari(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function tambahHari(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatTanggal(d: Date): string {
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ubah YYYY-MM-DD menjadi Date lokal, atau null bila tidak valid. */
export function parseTanggal(teks: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Tolak tanggal yang bergeser sendiri, misalnya 2026-02-31.
  if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

/** Hitung rentang periode dari waktu acuan (biasanya sekarang). */
export function rentangPeriode(periode: Periode, kini: Date): RentangPeriode | null {
  const hariIni = awalHari(kini);

  switch (periode.jenis) {
    case "hari_ini":
      return { dari: hariIni, sampai: tambahHari(hariIni, 1), label: `Hari ini, ${formatTanggal(hariIni)}` };

    case "kemarin": {
      const k = tambahHari(hariIni, -1);
      return { dari: k, sampai: hariIni, label: `Kemarin, ${formatTanggal(k)}` };
    }

    case "minggu_ini": {
      // Minggu dimulai Senin. getDay: 0 = Minggu.
      const selisih = (hariIni.getDay() + 6) % 7;
      const senin = tambahHari(hariIni, -selisih);
      return {
        dari: senin,
        sampai: tambahHari(senin, 7),
        label: `Minggu ini, ${formatTanggal(senin)} sampai ${formatTanggal(tambahHari(senin, 6))}`,
      };
    }

    case "bulan_ini": {
      const awal = new Date(kini.getFullYear(), kini.getMonth(), 1);
      const akhir = new Date(kini.getFullYear(), kini.getMonth() + 1, 1);
      return {
        dari: awal,
        sampai: akhir,
        label: `Bulan ini, ${NAMA_BULAN[kini.getMonth()]} ${kini.getFullYear()}`,
      };
    }

    case "tanggal": {
      const d = periode.tanggal ? parseTanggal(periode.tanggal) : null;
      if (!d) return null;
      return { dari: d, sampai: tambahHari(d, 1), label: formatTanggal(d) };
    }
  }
}

/** Saring transaksi yang hari laporannya jatuh di dalam rentang. */
export function saringPeriode<T extends BasisHariLaporan>(
  transaksi: T[],
  rentang: RentangPeriode,
): T[] {
  return transaksi.filter((t) => {
    const hari = hariLaporanAtauNull(t);
    if (!hari) return false;
    return hari.getTime() >= rentang.dari.getTime() && hari.getTime() < rentang.sampai.getTime();
  });
}

/**
 * Rentang periode sebelumnya, untuk dibandingkan dengan periode berjalan.
 *
 * Dihitung per jenis, BUKAN dengan menggeser mundur sebanyak panjang rentang.
 * Alasannya: Oktober punya 31 hari, jadi menggeser 1 Oktober mundur 31 hari
 * mendarat di 31 Agustus, bukan 1 September. Pergeseran per jenis selalu benar
 * berapa pun panjang bulannya.
 */
export function rentangSebelumnya(periode: Periode, kini: Date): RentangPeriode | null {
  const hariIni = awalHari(kini);

  switch (periode.jenis) {
    case "hari_ini": {
      const k = tambahHari(hariIni, -1);
      return { dari: k, sampai: hariIni, label: `Kemarin, ${formatTanggal(k)}` };
    }

    case "kemarin": {
      const k = tambahHari(hariIni, -2);
      return {
        dari: k,
        sampai: tambahHari(hariIni, -1),
        label: `Sehari sebelum kemarin, ${formatTanggal(k)}`,
      };
    }

    case "minggu_ini": {
      const selisih = (hariIni.getDay() + 6) % 7;
      const senin = tambahHari(hariIni, -selisih - 7);
      return {
        dari: senin,
        sampai: tambahHari(senin, 7),
        label: `Minggu lalu, ${formatTanggal(senin)} sampai ${formatTanggal(tambahHari(senin, 6))}`,
      };
    }

    case "bulan_ini": {
      const awal = new Date(kini.getFullYear(), kini.getMonth() - 1, 1);
      const akhir = new Date(kini.getFullYear(), kini.getMonth(), 1);
      return {
        dari: awal,
        sampai: akhir,
        label: `Bulan lalu, ${NAMA_BULAN[awal.getMonth()]} ${awal.getFullYear()}`,
      };
    }

    case "tanggal": {
      const d = periode.tanggal ? parseTanggal(periode.tanggal) : null;
      if (!d) return null;
      const k = tambahHari(d, -1);
      return { dari: k, sampai: d, label: `Sehari sebelumnya, ${formatTanggal(k)}` };
    }
  }
}

/**
 * Apakah periode ini masih berjalan (belum selesai)?
 *
 * Penting untuk perbandingan yang jujur: "bulan ini" yang baru jalan 12 hari
 * selalu tampak turun dibanding bulan lalu yang sudah penuh 30 hari. Menyebut
 * penurunan seperti itu sebagai fakta akan menyesatkan pembaca laporan.
 */
export function periodeMasihBerjalan(periode: Periode, kini: Date): boolean {
  if (periode.jenis === "hari_ini" || periode.jenis === "minggu_ini" || periode.jenis === "bulan_ini") {
    return true;
  }
  if (periode.jenis === "tanggal") {
    const d = periode.tanggal ? parseTanggal(periode.tanggal) : null;
    if (!d) return false;
    return d.getTime() >= awalHari(kini).getTime();
  }
  return false;
}
