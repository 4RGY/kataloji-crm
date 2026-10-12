// ============================================================
// Logika halaman Analitik.
//
// Masalah utama halaman ini bukan menghitung, tapi menahan diri. Dengan lima
// transaksi, hampir semua angka terlihat meyakinkan padahal tidak berarti
// apa-apa: "hari teramai Senin" dari dua hari data, "pelanggan naik 400%"
// dari satu orang jadi lima. Karena itu tiap bagian punya ambang minimum,
// dan di bawah ambang itu yang ditampilkan adalah berapa data lagi yang
// dibutuhkan, bukan grafiknya.
// ============================================================

import { hariLaporanAtauNull } from "./hari-laporan";

export interface TransaksiAnalitik {
  total: number;
  diskon: number;
  poin_dipakai: number;
  pelanggan_id: string | null;
  created_at: string;
  /** Tanggal transaksi di Majoo (H+1), null untuk transaksi manual. */
  tanggal_majoo?: string | null;
  /** Daftar item `{nama, qty}`, dipakai untuk ranking menu. */
  items?: unknown;
  /** Asal transaksi: crm_manual | majoo_import | majoo_parallel | csv_import. */
  source?: string | null;
}

/**
 * Sumber yang JAM transaksinya benar-benar diketahui.
 *
 * Kasir yang mencatat saat pelanggan membayar (crm_manual, majoo_parallel)
 * menghasilkan created_at yang berarti jam kedatangan. Impor Majoo dan CSV
 * hanya membawa TANGGAL laporan, sehingga created_at-nya adalah jam impor:
 * sembilan struk yang diimpor sekaligus semuanya berstempel jam yang sama.
 * Jam itu bukan jam ramai, jadi tidak boleh ikut dihitung.
 */
const SUMBER_JAM_DIKETAHUI = new Set(["crm_manual", "majoo_parallel"]);

/**
 * Apakah jam sebuah transaksi benar-benar jam kedatangan pelanggan.
 *
 * Transaksi lama tanpa `source` dianggap TIDAK diketahui: menebaknya sebagai
 * jam kedatangan berarti menampilkan jam impor sebagai jam ramai.
 */
export function jamTransaksiDiketahui(t: TransaksiAnalitik): boolean {
  const s = (t.source ?? "").trim();
  return SUMBER_JAM_DIKETAHUI.has(s);
}

export interface PelangganAnalitik {
  id: string;
  nama: string;
  tgl_lahir: string | null;
  created_at: string;
}

/** Berapa transaksi sebelum sebuah pola layak dibaca. */
export const AMBANG_POLA = 20;
/** Berapa hari operasional sebelum perbandingan antar hari layak dibaca. */
export const AMBANG_HARI = 7;

export const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Jam buka yang dipakai sebagai sumbu, bukan 0 sampai 23 yang mayoritas kosong. */
export const JAM_BUKA = { mulai: 7, selesai: 22 };

function waktuLokal(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Hari sebuah transaksi (untuk pengelompokan per hari / hari minggu).
 *
 * Basisnya `hariLaporan`: transaksi impor Majoo H+1 mengikuti tanggal
 * transaksinya (`tanggal_majoo`), bukan waktu catat (`created_at`),
 * supaya Omzet per hari tidak menggeser satu hari ke depan.
 */
function hariTransaksi(t: TransaksiAnalitik): Date | null {
  return hariLaporanAtauNull(t);
}

/**
 * Nilai yang benar-benar masuk laci: total dikurangi diskon dan potongan poin.
 *
 * Dipakai bersama oleh Dashboard, Analitik, dan Laporan penjualan supaya
 * ketiganya selalu menyebut angka yang sama.
 */
export function nilaiBersih(
  t: { total: number; diskon: number | null; poin_dipakai: number | null },
  nilaiPoin: number,
): number {
  const total = Math.max(0, Number(t.total) || 0);
  const diskon = Math.max(0, Number(t.diskon) || 0);
  const potongan = Math.max(0, Number(t.poin_dipakai) || 0) * (Number(nilaiPoin) || 0);
  return Math.max(0, total - diskon - potongan);
}

export interface Keyakinan {
  cukup: boolean;
  jumlah: number;
  ambang: number;
  /** Kalimat yang menjelaskan kenapa bagian ini belum bisa dibaca. */
  pesan: string;
}

/**
 * Apakah sebuah pola sudah layak dibaca.
 *
 * Ditulis sebagai fungsi terpisah supaya tiap bagian halaman memakai ambang
 * yang sama, dan supaya kalimatnya bisa diuji. Pesannya menyebut angka nyata
 * ("butuh 15 transaksi lagi") karena "data belum cukup" tidak memberi tahu
 * pemilik kapan halaman ini mulai berguna.
 */
export function periksaKeyakinan(
  jumlah: number,
  ambang: number,
  satuan = "transaksi",
): Keyakinan {
  const n = Math.max(0, Number(jumlah) || 0);
  const kurang = Math.max(0, ambang - n);
  return {
    cukup: n >= ambang,
    jumlah: n,
    ambang,
    pesan:
      kurang === 0
        ? ""
        : `Butuh ${kurang} ${satuan} lagi sebelum pola ini bisa dipercaya.`,
  };
}

export interface BarisJam {
  jam: number;
  jumlah: number;
  omzet: number;
}

export interface SebaranJamHasil {
  baris: BarisJam[];
  /** Jumlah transaksi yang jamnya diketahui dan ikut dihitung. */
  dihitung: number;
  /** Jumlah transaksi yang jamnya tidak diketahui, sengaja dilewati. */
  dilewati: number;
}

/**
 * Sebaran transaksi per jam, hanya pada rentang jam buka.
 *
 * Hanya transaksi yang jam kedatangannya diketahui yang dihitung (lihat
 * `jamTransaksiDiketahui`). Sisanya dilaporkan lewat `dilewati`, bukan
 * dibuang diam-diam dan bukan ditebak sebagai jam kedatangan.
 */
export function sebaranJam(
  transaksi: TransaksiAnalitik[],
  nilaiPoin: number,
): SebaranJamHasil {
  const baris: BarisJam[] = [];
  for (let j = JAM_BUKA.mulai; j <= JAM_BUKA.selesai; j++) {
    baris.push({ jam: j, jumlah: 0, omzet: 0 });
  }
  let dihitung = 0;
  let dilewati = 0;
  for (const t of transaksi || []) {
    if (!jamTransaksiDiketahui(t)) {
      dilewati += 1;
      continue;
    }
    const d = waktuLokal(t.created_at);
    if (!d) {
      dilewati += 1;
      continue;
    }
    const j = d.getHours();
    if (j < JAM_BUKA.mulai || j > JAM_BUKA.selesai) continue;
    const barisJam = baris[j - JAM_BUKA.mulai];
    barisJam.jumlah += 1;
    barisJam.omzet += nilaiBersih(t, nilaiPoin);
    dihitung += 1;
  }
  return { baris, dihitung, dilewati };
}

export interface BarisHari {
  hari: number;
  nama: string;
  jumlah: number;
  omzet: number;
}

/** Sebaran transaksi per hari dalam seminggu, Senin lebih dulu. */
export function sebaranHari(
  transaksi: TransaksiAnalitik[],
  nilaiPoin: number,
): BarisHari[] {
  const urut = [1, 2, 3, 4, 5, 6, 0]; // Senin sampai Minggu
  const peta = new Map<number, BarisHari>();
  for (const h of urut) {
    peta.set(h, { hari: h, nama: NAMA_HARI[h], jumlah: 0, omzet: 0 });
  }
  for (const t of transaksi || []) {
    const d = hariTransaksi(t);
    if (!d) continue;
    const baris = peta.get(d.getDay());
    if (!baris) continue;
    baris.jumlah += 1;
    baris.omzet += nilaiBersih(t, nilaiPoin);
  }
  return urut.map((h) => peta.get(h)!);
}

export interface Kelompok {
  label: string;
  bawah: number;
  atas: number | null;
  jumlah: number;
  omzet: number;
}

/**
 * Sebaran nilai belanja.
 *
 * Batas kelompok dipatok pada angka yang masuk akal untuk kedai kopi, bukan
 * dibagi rata dari nilai terkecil ke terbesar. Pembagian rata terlihat rapi
 * di grafik tetapi menghasilkan batas aneh seperti "Rp 31.400 sampai
 * Rp 54.200" yang tidak bisa dipakai menyusun paket harga.
 */
export const BATAS_KELOMPOK: { label: string; bawah: number; atas: number | null }[] = [
  { label: "di bawah 25rb", bawah: 0, atas: 25_000 },
  { label: "25rb sampai 50rb", bawah: 25_000, atas: 50_000 },
  { label: "50rb sampai 100rb", bawah: 50_000, atas: 100_000 },
  { label: "100rb ke atas", bawah: 100_000, atas: null },
];

export function sebaranBelanja(
  transaksi: TransaksiAnalitik[],
  nilaiPoin: number,
): Kelompok[] {
  const hasil: Kelompok[] = BATAS_KELOMPOK.map((b) => ({ ...b, jumlah: 0, omzet: 0 }));
  for (const t of transaksi || []) {
    const n = nilaiBersih(t, nilaiPoin);
    const k = hasil.find((x) => n >= x.bawah && (x.atas === null || n < x.atas));
    if (!k) continue;
    k.jumlah += 1;
    k.omzet += n;
  }
  return hasil;
}

export interface RingkasPelanggan {
  totalTransaksi: number;
  berpelanggan: number;
  tanpaPelanggan: number;
  /** Persen transaksi yang tertaut ke pelanggan, 0 sampai 100. */
  persenTertaut: number;
  omzetBerpelanggan: number;
  omzetTanpaPelanggan: number;
}

/**
 * Seberapa banyak transaksi yang berhasil ditautkan ke pelanggan.
 *
 * Ini ukuran paling penting di halaman ini. Program loyalitas hanya bekerja
 * pada transaksi yang tertaut; sisanya tidak menghasilkan data apa pun
 * tentang siapa yang datang.
 */
export function ringkasPelanggan(
  transaksi: TransaksiAnalitik[],
  nilaiPoin: number,
): RingkasPelanggan {
  let berpelanggan = 0;
  let omzetB = 0;
  let omzetT = 0;

  for (const t of transaksi || []) {
    const n = nilaiBersih(t, nilaiPoin);
    if (t.pelanggan_id) {
      berpelanggan += 1;
      omzetB += n;
    } else {
      omzetT += n;
    }
  }

  const total = (transaksi || []).length;
  return {
    totalTransaksi: total,
    berpelanggan,
    tanpaPelanggan: total - berpelanggan,
    persenTertaut: total > 0 ? Math.round((berpelanggan / total) * 100) : 0,
    omzetBerpelanggan: omzetB,
    omzetTanpaPelanggan: omzetT,
  };
}

/** Pelanggan yang berulang tahun pada bulan tertentu. */
export function ultahBulanIni(
  pelanggan: PelangganAnalitik[],
  sekarang: Date,
): { nama: string; tanggal: number }[] {
  const bulan = sekarang.getMonth();
  const hasil: { nama: string; tanggal: number }[] = [];
  for (const p of pelanggan || []) {
    if (!p.tgl_lahir) continue;
    const d = new Date(p.tgl_lahir + "T00:00:00");
    if (!Number.isFinite(d.getTime())) continue;
    if (d.getMonth() !== bulan) continue;
    hasil.push({ nama: p.nama, tanggal: d.getDate() });
  }
  return hasil.sort((a, b) => a.tanggal - b.tanggal);
}

/** Banyaknya hari berbeda yang punya transaksi. */
export function hariBeroperasi(transaksi: TransaksiAnalitik[]): number {
  const hari = new Set<string>();
  for (const t of transaksi || []) {
    const d = hariTransaksi(t);
    if (!d) continue;
    hari.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return hari.size;
}

/**
 * Jam teramai, hanya kalau ada pemenang yang jelas.
 *
 * Mengembalikan null saat terjadi seri, karena menyebut satu jam sebagai
 * "teramai" padahal ada jam lain dengan jumlah sama akan dipakai menyusun
 * jadwal staf, dan itu keputusan yang mahal untuk ditebak.
 */
export function jamTeramai(baris: BarisJam[]): BarisJam | null {
  const terisi = (baris || []).filter((b) => b.jumlah > 0);
  if (terisi.length === 0) return null;
  const maks = Math.max(...terisi.map((b) => b.jumlah));
  const juara = terisi.filter((b) => b.jumlah === maks);
  return juara.length === 1 ? juara[0] : null;
}

export interface ItemTransaksi {
  nama: string;
  qty: number;
}

export interface TransaksiMenu {
  items?: unknown;
}

export interface BarisMenu {
  nama: string;
  qty: number;
  /** Bagian dari seluruh item terjual, 0 sampai 100. */
  persen: number;
}

/** Ambang minimum item terjual sebelum ranking menu layak dibaca. */
export const AMBANG_MENU = 20;

/**
 * Menu terlaris berdasarkan jumlah item terjual (qty).
 *
 * Item dibaca dari kolom `items` (array `{nama, qty}`). Baris yang bentuknya
 * tidak sesuai dilewati, bukan ditebak. Nama dinormalkan (huruf kecil dan
 * spasi dirapikan) supaya "Kopi Susu" dan "kopi susu " dihitung satu menu.
 */
export function menuTerlaris(
  transaksi: TransaksiMenu[],
  batas = 5,
): BarisMenu[] {
  const peta = new Map<string, { nama: string; qty: number }>();
  let totalQty = 0;

  for (const t of transaksi || []) {
    if (!Array.isArray(t.items)) continue;
    for (const raw of t.items as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as Partial<ItemTransaksi>;
      const nama = typeof it.nama === "string" ? it.nama.trim().replace(/\s+/g, " ") : "";
      const qty = Number(it.qty);
      if (!nama || !Number.isFinite(qty) || qty <= 0) continue;
      const kunci = nama.toLowerCase();
      const ada = peta.get(kunci);
      if (ada) {
        ada.qty += qty;
      } else {
        peta.set(kunci, { nama, qty });
      }
      totalQty += qty;
    }
  }

  return [...peta.values()]
    .sort((a, b) => b.qty - a.qty || a.nama.localeCompare(b.nama, "id"))
    .slice(0, batas)
    .map((m) => ({
      nama: m.nama,
      qty: m.qty,
      persen: totalQty > 0 ? Math.round((m.qty / totalQty) * 100) : 0,
    }));
}

export interface PelangganSetia {
  pelangganId: string;
  /** Jumlah hari berbeda pelanggan ini datang. Ini yang dihitung sebagai kunjungan. */
  kunjungan: number;
  omzet: number;
}

/**
 * Pelanggan paling sering datang.
 *
 * Kunjungan dihitung sebagai hari berbeda, sejalan dengan aturan poin
 * `per_kunjungan`: dua struk di hari yang sama tetap satu kunjungan.
 * Transaksi tanpa pelanggan diabaikan.
 */
export function pelangganSetia(
  transaksi: TransaksiAnalitik[],
  nilaiPoin: number,
  batas = 5,
): PelangganSetia[] {
  const hari = new Map<string, Set<string>>();
  const omzet = new Map<string, number>();

  for (const t of transaksi || []) {
    if (!t.pelanggan_id) continue;
    const d = hariTransaksi(t);
    if (!d) continue;
    const kunciHari = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const set = hari.get(t.pelanggan_id) ?? new Set<string>();
    set.add(kunciHari);
    hari.set(t.pelanggan_id, set);
    omzet.set(t.pelanggan_id, (omzet.get(t.pelanggan_id) ?? 0) + nilaiBersih(t, nilaiPoin));
  }

  return [...hari.entries()]
    .map(([pelangganId, set]) => ({
      pelangganId,
      kunjungan: set.size,
      omzet: omzet.get(pelangganId) ?? 0,
    }))
    .sort((a, b) => b.kunjungan - a.kunjungan || b.omzet - a.omzet)
    .slice(0, batas);
}

/** Format jam menjadi "18.00". */
export function labelJam(jam: number): string {
  return `${String(jam).padStart(2, "0")}.00`;
}

/** Tinggi batang dalam persen terhadap nilai tertinggi pada deret itu. */
export function tinggiBatang(nilai: number, tertinggi: number): number {
  const t = Number(tertinggi) || 0;
  if (t <= 0) return 0;
  const n = Math.max(0, Number(nilai) || 0);
  return Math.min(100, Math.round((n / t) * 100));
}
