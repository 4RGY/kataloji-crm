// ============================================================
// Modul Impor Majoo, Kataloji CRM
// ============================================================
// Logika murni (tanpa React, tanpa Supabase) untuk membaca file
// ekspor Majoo dan mengubahnya menjadi baris siap-import.
//
// Arah integrasi: CRM diisi H+1 via impor (bukan paralel realtime).
// Poin tetap dihitung CRM; kolom "Jumlah Poin Reward" dari Majoo
// sengaja TIDAK diimpor agar CRM tetap jadi sumber kebenaran poin.
//
// File Majoo yang didukung:
//   - Data Pelanggan (.xlsx/.xls/.csv)  -> baris pelanggan
//   - Detail Penjualan (.xlsx/.xls/.csv) -> baris transaksi
//
// Catatan: ekspor Majoo menaruh header tabel TIDAK di baris pertama,
// melainkan setelah beberapa baris judul/metadata ("Data Pelanggan",
// "Pencarian", "Date Generated", ...). Parser mendeteksi baris header
// secara dinamis, bukan mengasumsikan posisi tetap.
// ============================================================

import { normalisasiWhatsapp } from "./pelanggan";

// ---------- Tipe baris hasil impor ----------

export interface BarisPelangganMajoo {
  /** Kode Pelanggan dari Majoo (kunci dedup). Kosong = skip. */
  kode_majoo: string;
  nama: string;
  whatsapp: string;
  tgl_lahir: string;
  jenis_kelamin: string;
  email: string;
  alamat: string;
  /** Baris sumber (1-based) di file, untuk laporan galat. */
  baris: number;
}

export interface BarisTransaksiMajoo {
  /** Nomor transaksi dari Majoo (kunci dedup, isi ke external_ref). */
  external_ref: string;
  total: number;
  metode_bayar: string;
  items: { nama: string; qty: number }[];
  /** Tanggal/jam transaksi bila terbaca. */
  waktu: string;
  baris: number;
}

export interface HasilParse {
  pelanggan: BarisPelangganMajoo[];
  transaksi: BarisTransaksiMajoo[];
  /** Baris yang dilewati karena tidak punya kunci dedup / rusak. */
  dilewati: { baris: number; alasan: string }[];
}

// ---------- Nama kolom Majoo -> field internal ----------

const KOLOM_PELANGGAN: Record<string, keyof BarisPelangganMajoo | "abaikan"> = {
  "Kode Pelanggan": "kode_majoo",
  "Nama Pelanggan": "nama",
  "No Telepon": "whatsapp",
  "No. Telepon": "whatsapp",
  "Nomor Telepon": "whatsapp",
  "Tanggal Lahir": "tgl_lahir",
  "Jenis Kelamin": "jenis_kelamin",
  Email: "email",
  Alamat: "alamat",
  Kota: "abaikan",
  "Jumlah Poin Reward": "abaikan", // poin = CRM, bukan Majoo
  "Saldo Deposit (Rp)": "abaikan",
  "Grup Pelanggan": "abaikan",
};

const KOLOM_TRANSAKSI: Record<string, keyof BarisTransaksiMajoo | "abaikan"> = {
  No: "external_ref",
  "No Transaksi": "external_ref",
  "No. Transaksi": "external_ref",
  Nomor: "external_ref",
  "Total Penjualan": "total",
  "Grand Total": "total",
  Total: "total",
  "Metode Pembayaran": "metode_bayar",
  "Metode Bayar": "metode_bayar",
  Pembayaran: "metode_bayar",
  Produk: "items",
  "Nama Produk": "items",
  Item: "items",
  Waktu: "waktu",
  Tanggal: "waktu",
};

// ---------- Bantuan deteksi header ----------

/** Bersihkan teks sel: trim + normalisasi spasi ganda. */
function bersih(sel: unknown): string {
  return String(sel ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Cari baris header: baris pertama yang memuat setidaknya satu nama kolom
 * yang kita kenali. Melewati baris judul/metadata di atasnya.
 */
function cariBarisHeader(baris: unknown[][]): { index: number; peta: Map<string, string> } {
  for (let i = 0; i < baris.length; i++) {
    const sel = baris[i].map(bersih);
    const cocok = sel.filter((s) => KOLOM_PELANGGAN[s] !== undefined || KOLOM_TRANSAKSI[s] !== undefined);
    if (cocok.length >= 2) {
      const peta = new Map<string, string>();
      sel.forEach((s, j) => {
        if (KOLOM_PELANGGAN[s] !== undefined || KOLOM_TRANSAKSI[s] !== undefined) {
          peta.set(s, String(j));
        }
      });
      return { index: i, peta };
    }
  }
  return { index: -1, peta: new Map() };
}

/** Ambil nilai sel dari satu baris berdasarkan nama kolom (via peta). */
function ambil(baris: unknown[], peta: Map<string, string>, nama: string): string {
  const j = peta.get(nama);
  if (j === undefined) return "";
  return bersih(baris[Number(j)]);
}

// ---------- Normalisasi tanggal ----------

/**
 * Ubah tanggal Majoo (bisa "19/09/2026", "2026-09-19", teks lain) menjadi
 * "YYYY-MM-DD". Kosong bila tidak dikenali.
 */
function normalisasiTanggal(raw: string): string {
  const s = bersih(raw);
  if (!s) return "";
  // Excel serial number (angka) tidak didukung di sini; hanya teks.
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) {
    const y = t.getFullYear();
    const mo = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return "";
}

// ---------- Normalisasi angka ----------

/** "75.900" / "1.025.600" / "Rp75.900" -> 75900. 0 bila kosong/rusak. */
function normalisasiAngka(raw: string): number {
  const s = bersih(raw).replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // Asumsi format Indonesia: titik = pemisah ribuan, koma = desimal.
  // Buang titik ribuan, lalu koma -> titik desimal.
  const tanpaRibuan = s.replace(/\./g, "");
  const n = Number(tanpaRibuan.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// ---------- Parsing produk ----------

/**
 * Kolom "Produk" Majoo berisi beberapa produk dalam satu sel, dipisahkan
 * koma. Pecah menjadi item. Qty diisi 1 bila tidak terbaca.
 * Contoh: "Black Oranje, Kopsus Gula Aren, Matcha Latte" -> 3 item.
 */
function parseProduk(raw: string): { nama: string; qty: number }[] {
  const s = bersih(raw);
  if (!s) return [];
  const potongan = s.split(/[,\n]/).map((p) => bersih(p)).filter(Boolean);
  return potongan.map((nama) => ({ nama, qty: 1 }));
}

// ---------- Validasi WhatsApp untuk impor ----------

export interface HasilCekWhatsapp {
  ok: boolean;
  /** Nomor sudah dinormalisasi (62...). Kosong bila tidak valid. */
  normal: string;
  alasan?: string;
}

/**
 * Periksa apakah nomor WhatsApp dari Majoo layak disimpan.
 *
 * Berbeda dengan `validasiPelanggan()`: tanggal lahir di sini TIDAK wajib,
 * karena ekspor Majoo sering mengosongkannya. Yang wajib hanya nomor yang
 * lolos batasan kolom `whatsapp` (NOT NULL + CHECK 11–15 digit berawal 62).
 * Aturan panjangnya WAJIB sama dengan `validasiPelanggan()` dan dengan
 * constraint `pelanggan_whatsapp_isi` di database.
 */
export function cekWhatsappImpor(raw: string): HasilCekWhatsapp {
  const normal = normalisasiWhatsapp(raw);
  if (!normal) {
    return { ok: false, normal: "", alasan: "Nomor WhatsApp kosong atau tanpa angka." };
  }
  if (!normal.startsWith("62")) {
    return { ok: false, normal, alasan: "Nomor bukan Indonesia (harus awalan 08/62)." };
  }
  if (normal.length < 11 || normal.length > 15) {
    return {
      ok: false,
      normal,
      alasan: `Panjang nomor ${normal.length} digit (harus 11–15 digit).`,
    };
  }
  return { ok: true, normal };
}

// ---------- Parsing utama ----------

/**
 * Parse konten file Majoo (sudah menjadi array baris 2D, mis. hasil
 * sheet_to_json(header:1)) menjadi baris siap-import. Fungsi ini mendeteksi
 * sendiri apakah file berisi pelanggan atau transaksi dari nama kolomnya.
 */
export function parseMajoo(baris: unknown[][]): HasilParse {
  const hasil: HasilParse = { pelanggan: [], transaksi: [], dilewati: [] };
  if (!baris || baris.length === 0) return hasil;

  const { index, peta } = cariBarisHeader(baris);
  if (index < 0) {
    hasil.dilewati.push({ baris: 0, alasan: "Tidak ditemukan baris header yang dikenali." });
    return hasil;
  }

  const adaKolomPelanggan = Array.from(peta.keys()).some((k) => KOLOM_PELANGGAN[k] !== undefined);
  // Prioritas: bila kedua jenis kolom muncul, pilih yang jumlah kolomnya lebih banyak.
  const nPel = Array.from(peta.keys()).filter((k) => KOLOM_PELANGGAN[k] !== undefined).length;
  const nTrx = Array.from(peta.keys()).filter((k) => KOLOM_TRANSAKSI[k] !== undefined).length;
  const jenis: "pelanggan" | "transaksi" =
    nPel >= nTrx && adaKolomPelanggan ? "pelanggan" : "transaksi";

  for (let i = index + 1; i < baris.length; i++) {
    const barisAsli = baris[i];
    if (!barisAsli) continue;
    const nomor = i + 1; // 1-based, cocok dengan tampilan Excel

    // Lewati baris yang seluruhnya kosong.
    if (barisAsli.every((c) => bersih(c) === "")) continue;

    if (jenis === "pelanggan") {
      const kode = ambil(barisAsli, peta, "Kode Pelanggan");
      const nama = ambil(barisAsli, peta, "Nama Pelanggan");
      const wa = ambil(barisAsli, peta, "No Telepon");
      if (!kode || !nama) {
        hasil.dilewati.push({ baris: nomor, alasan: "Tidak ada Kode/Nama Pelanggan." });
        continue;
      }
      hasil.pelanggan.push({
        kode_majoo: kode,
        nama,
        whatsapp: normalisasiWhatsapp(wa),
        tgl_lahir: normalisasiTanggal(ambil(barisAsli, peta, "Tanggal Lahir")),
        jenis_kelamin: ambil(barisAsli, peta, "Jenis Kelamin"),
        email: ambil(barisAsli, peta, "Email"),
        alamat: ambil(barisAsli, peta, "Alamat"),
        baris: nomor,
      });
    } else {
      const ref = ambil(barisAsli, peta, "No");
      const total = normalisasiAngka(ambil(barisAsli, peta, "Total Penjualan"));
      if (!ref) {
        hasil.dilewati.push({ baris: nomor, alasan: "Tidak ada nomor transaksi." });
        continue;
      }
      hasil.transaksi.push({
        external_ref: ref,
        total,
        metode_bayar: ambil(barisAsli, peta, "Metode Pembayaran"),
        items: parseProduk(ambil(barisAsli, peta, "Produk")),
        waktu: ambil(barisAsli, peta, "Waktu"),
        baris: nomor,
      });
    }
  }

  return hasil;
}
