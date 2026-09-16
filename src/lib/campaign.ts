/**
 * Logika campaign: memilih siapa yang dihubungi dan menyusun pesannya.
 *
 * Kataloji tidak punya WhatsApp Business API (butuh verifikasi bisnis Meta,
 * nomor terdaftar, dan biaya per pesan). Karena itu pengiriman dilakukan
 * lewat tautan wa.me yang dibuka kasir satu per satu. Konsekuensinya jujur:
 * pesan terkirim dari nomor kedai yang asli, tetapi kasir harus menekan
 * kirim sendiri di setiap orang.
 *
 * Seluruh berkas ini murni: tidak menyentuh jaringan, database, atau DOM,
 * sehingga bisa diuji lewat scripts/uji-campaign.mts.
 */

import { normalisasiWhatsapp } from "./pelanggan";
import { lencanaPelanggan, selisihHari, type DataLencana } from "./pelanggan-tampilan";

/** Pelanggan seperlunya untuk campaign. */
export interface TargetCampaign extends DataLencana {
  id: string;
  nama: string;
  whatsapp: string;
  poin: number;
  /** Tanggal poin terdekat hangus, kalau ada. */
  hangusPada?: string | null;
}

export type KodeSegmen = "sepi" | "ultah" | "hangus" | "baru" | "semua";

export interface Segmen {
  kode: KodeSegmen;
  nama: string;
  /** Kalimat yang menjelaskan siapa yang masuk, dipakai langsung di layar. */
  alasan: string;
}

/**
 * Segmen diurutkan dari yang paling mendesak.
 *
 * "Poin akan hangus" ditaruh pertama karena punya tenggat: lewat tanggalnya,
 * poin pelanggan benar-benar hilang dan kesempatan menghubungi sudah lewat.
 * Segmen lain tidak punya batas waktu sekeras itu.
 */
export const SEGMEN: Segmen[] = [
  {
    kode: "hangus",
    nama: "Poin akan hangus",
    alasan: "Punya poin yang hangus dalam 30 hari ke depan.",
  },
  {
    kode: "sepi",
    nama: "Sudah lama tidak datang",
    alasan: "Terakhir datang lebih dari 45 hari lalu.",
  },
  {
    kode: "ultah",
    nama: "Ulang tahun bulan ini",
    alasan: "Tanggal lahirnya jatuh di bulan ini.",
  },
  {
    kode: "baru",
    nama: "Baru sekali datang",
    alasan: "Baru satu kali transaksi, belum tentu kembali.",
  },
  { kode: "semua", nama: "Semua pelanggan", alasan: "Seluruh pelanggan terdaftar." },
];

/** Batas hari sebuah poin dianggap "sudah dekat hangus". */
export const AMBANG_HANGUS_HARI = 30;

/**
 * Pilih pelanggan yang masuk sebuah segmen.
 *
 * Segmen dihitung ulang dari data mentah, bukan dibaca dari nilai tersimpan,
 * karena semuanya bergantung pada tanggal hari ini.
 */
export function pilihSegmen<T extends TargetCampaign>(
  daftar: T[],
  kode: KodeSegmen,
  hariIni: Date,
): T[] {
  if (kode === "semua") return [...daftar];

  if (kode === "hangus") {
    return daftar.filter((p) => {
      if (!p.hangusPada || p.poin <= 0) return false;
      const hari = selisihHari(p.hangusPada, hariIni);
      // selisihHari mengembalikan hariIni dikurangi tanggal, jadi tanggal
      // yang masih di depan bernilai negatif. Yang sudah lewat dilewati:
      // poinnya sudah hangus, tidak ada lagi yang bisa diselamatkan.
      if (hari === null || hari >= 0) return false;
      return Math.abs(hari) <= AMBANG_HANGUS_HARI;
    });
  }

  return daftar.filter((p) => lencanaPelanggan(p, hariIni).jenis === kode);
}

/**
 * Pelanggan tanpa nomor WhatsApp yang sah tidak bisa dihubungi.
 * Dipisah, bukan dibuang diam-diam, supaya jumlahnya bisa ditampilkan.
 */
export function pisahkanTanpaNomor<T extends TargetCampaign>(
  daftar: T[],
): { siap: T[]; tanpaNomor: T[] } {
  const siap: T[] = [];
  const tanpaNomor: T[] = [];
  for (const p of daftar) {
    const nomor = normalisasiWhatsapp(p.whatsapp || "");
    // Nomor Indonesia terpendek yang masuk akal: 62 diikuti 9 digit.
    if (nomor.length >= 11) siap.push(p);
    else tanpaNomor.push(p);
  }
  return { siap, tanpaNomor };
}

/** Kata kunci yang boleh dipakai di dalam pesan. */
export const SISIPAN: { kunci: string; arti: string }[] = [
  { kunci: "{nama}", arti: "Nama pelanggan" },
  { kunci: "{poin}", arti: "Sisa poin" },
  { kunci: "{nilai}", arti: "Nilai poin dalam rupiah" },
  { kunci: "{hangus}", arti: "Tanggal poin hangus" },
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function tanggalPendek(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
}

/**
 * Ganti sisipan dalam pesan dengan data pelanggan.
 *
 * Sisipan yang tidak punya isi (misalnya {hangus} untuk orang tanpa poin
 * kedaluwarsa) diganti string kosong, bukan dibiarkan sebagai "{hangus}".
 * Membiarkannya berarti pelanggan menerima pesan berisi kurung kurawal.
 */
export function susunPesan(
  template: string,
  p: TargetCampaign,
  nilaiPoin: number,
): string {
  return (template || "")
    .replaceAll("{nama}", p.nama || "")
    .replaceAll("{poin}", String(p.poin ?? 0))
    .replaceAll("{nilai}", rupiah.format((p.poin ?? 0) * nilaiPoin))
    .replaceAll("{hangus}", tanggalPendek(p.hangusPada))
    .trim();
}

/** Tautan wa.me untuk satu pelanggan. */
export function tautanWhatsapp(nomor: string, pesan: string): string {
  const bersih = normalisasiWhatsapp(nomor || "");
  if (!bersih) return "";
  return `https://wa.me/${bersih}?text=${encodeURIComponent(pesan)}`;
}

export interface MasalahPesan {
  berat: boolean;
  teks: string;
}

/**
 * Periksa pesan sebelum kasir mulai mengirim.
 *
 * Masalah "berat" mengunci tombol kirim, masalah ringan hanya peringatan.
 * Alasannya pesan campaign dikirim ke banyak orang sekaligus: salah ketik
 * yang lolos tidak bisa ditarik kembali satu per satu.
 */
export function periksaPesan(template: string): MasalahPesan[] {
  const masalah: MasalahPesan[] = [];
  const isi = (template || "").trim();

  if (isi.length === 0) {
    masalah.push({ berat: true, teks: "Pesan masih kosong." });
    return masalah;
  }

  // Kurung kurawal yang tidak dikenal akan terkirim apa adanya ke pelanggan.
  const dikenal = new Set(SISIPAN.map((s) => s.kunci));
  const dipakai = isi.match(/\{[^}]*\}/g) ?? [];
  const asing = [...new Set(dipakai.filter((k) => !dikenal.has(k)))];
  if (asing.length > 0) {
    masalah.push({
      berat: true,
      teks: `Kata kunci ${asing.join(", ")} tidak dikenali dan akan terkirim apa adanya.`,
    });
  }

  if (!isi.includes("{nama}")) {
    masalah.push({
      berat: false,
      teks: "Pesan tidak menyebut nama. Pesan tanpa nama lebih mudah diabaikan.",
    });
  }

  if (isi.length > 900) {
    masalah.push({
      berat: false,
      teks: `Pesan cukup panjang (${isi.length} huruf). Pesan pendek lebih mungkin dibaca.`,
    });
  }

  return masalah;
}

/** Ada masalah berat yang harus dibereskan sebelum kirim. */
export function adaMasalahBerat(masalah: MasalahPesan[]): boolean {
  return masalah.some((m) => m.berat);
}

/**
 * Contoh pesan siap pakai. Ditulis seperti orang kedai menulis, bukan
 * bahasa surat resmi, karena dikirim lewat WhatsApp pribadi.
 */
export const CONTOH_PESAN: { judul: string; untuk: KodeSegmen; isi: string }[] = [
  {
    judul: "Poin mau hangus",
    untuk: "hangus",
    isi:
      "Halo {nama}, poin Kataloji kamu ada {poin} (senilai {nilai}) dan hangus {hangus}. " +
      "Mampir sebelum tanggal itu ya, bisa langsung dipakai potong harga.",
  },
  {
    judul: "Sudah lama tidak datang",
    untuk: "sepi",
    isi:
      "Halo {nama}, sudah lama tidak ketemu di Kataloji. Poin kamu masih tersimpan {poin}. " +
      "Kalau mampir minggu ini, kami buatkan kopi favoritmu.",
  },
  {
    judul: "Ulang tahun",
    untuk: "ultah",
    isi:
      "Selamat ulang tahun, {nama}. Tunjukkan pesan ini di kasir Kataloji bulan ini " +
      "untuk satu minuman gratis.",
  },
  {
    judul: "Baru pertama datang",
    untuk: "baru",
    isi:
      "Halo {nama}, terima kasih sudah mampir ke Kataloji. Poin pertamamu sudah masuk, " +
      "sekarang {poin} poin. Sampai ketemu lagi.",
  },
];

/** Ringkasan untuk ditampilkan sebelum kasir mulai mengirim. */
export function ringkasKirim(
  siap: number,
  tanpaNomor: number,
  sudah: number,
): string {
  if (siap === 0 && tanpaNomor === 0) return "Tidak ada pelanggan pada segmen ini.";

  const bagian: string[] = [];
  bagian.push(`${siap} pelanggan siap dihubungi`);
  if (sudah > 0) bagian.push(`${sudah} sudah dikirim`);
  if (tanpaNomor > 0) bagian.push(`${tanpaNomor} dilewati karena nomornya tidak lengkap`);
  return bagian.join(", ") + ".";
}
