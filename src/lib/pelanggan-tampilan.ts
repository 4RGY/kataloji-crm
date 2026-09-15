// ============================================================
// Logika tampilan halaman Pelanggan, Kataloji CRM
// Bagian dari monolit modular Next.js (bukan service terpisah).
//
// Isinya murni: menerima data baris, mengembalikan teks atau angka siap
// tampil. Tidak ada React, tidak ada jaringan, tidak ada keadaan. Tujuannya
// supaya aturan seperti "kapan pelanggan disebut sudah lama tidak datang"
// bisa diuji langsung tanpa merender halaman.
//
// ANGKA YANG DITAMPILKAN DIHITUNG DARI DATA YANG SUDAH ADA
// Tidak ada tabel atau kolom baru untuk fitur ini. Kunjungan, total belanja,
// dan tanggal kunjungan terakhir semuanya dihitung dari tabel `transaksi`.
// Alasannya: kalau angka-angka ini disimpan sebagai kolom terpisah, nilainya
// bisa melenceng dari transaksi aslinya dan tidak ada yang tahu mana yang
// benar. Menghitung ulang selalu konsisten dengan sumbernya.
// ============================================================

/** Batas hari untuk menyebut pelanggan masih aktif. */
export const BATAS_AKTIF_HARI = 30;

/**
 * Batas hari untuk menyebut pelanggan sudah lama tidak datang.
 * Sengaja lebih longgar dari BATAS_AKTIF_HARI supaya ada jeda abu-abu dan
 * lencananya tidak berkedip bolak-balik di sekitar satu titik.
 */
export const BATAS_SEPI_HARI = 45;

/** Warna avatar yang tersedia. Dipilih stabil supaya tidak berubah tiap muat. */
export const WARNA_AVATAR = ["terra", "sage", "mustard", "espresso"] as const;
export type WarnaAvatar = (typeof WARNA_AVATAR)[number];

/** 1995-05-20 -> "20 Mei 1995" */
export function tanggalIndonesia(iso: string | null): string {
  if (!iso) return "Belum diisi";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** timestamp ISO -> "14 Sep 2026" */
export function tanggalSingkat(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "Budi Santoso" -> "BS"; satu kata -> dua huruf pertama */
export function inisialPelanggan(nama: string): string {
  const bagian = (nama || "").trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

/**
 * Pilih warna avatar dari nama pelanggan.
 *
 * Stabil: nama yang sama selalu dapat warna yang sama, jadi warna tidak
 * berkedip setiap halaman dimuat ulang. Bukan pengelompokan apa pun, hanya
 * supaya daftar tidak tampak seragam satu warna.
 */
export function warnaAvatar(nama: string): WarnaAvatar {
  const bersih = (nama || "").trim().toLowerCase();
  if (!bersih) return WARNA_AVATAR[0];
  let jumlah = 0;
  for (let i = 0; i < bersih.length; i++) {
    jumlah = (jumlah + bersih.charCodeAt(i)) % 9973;
  }
  return WARNA_AVATAR[jumlah % WARNA_AVATAR.length];
}

/** Awal hari setempat, supaya selisih hari tidak terpengaruh jam. */
function awalHari(d: Date): Date {
  const salinan = new Date(d);
  salinan.setHours(0, 0, 0, 0);
  return salinan;
}

/**
 * Selisih hari antara `iso` dan `hariIni`, dihitung dari awal hari setempat.
 * Mengembalikan null kalau tanggalnya tidak dikenali.
 */
export function selisihHari(iso: string, hariIni: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const selisih = awalHari(hariIni).getTime() - awalHari(d).getTime();
  return Math.round(selisih / 86_400_000);
}

/**
 * Tampilan kapan terakhir datang: "hari ini", "kemarin", "5 hari lalu",
 * lalu jatuh ke tanggal penuh kalau sudah lebih dari dua minggu.
 */
export function terakhirDatang(iso: string | null, hariIni: Date): string {
  if (!iso) return "Belum pernah";
  const hari = selisihHari(iso, hariIni);
  if (hari === null) return "Belum pernah";
  if (hari < 0) return "Tanggal tidak wajar";
  if (hari === 0) return "hari ini";
  if (hari === 1) return "kemarin";
  if (hari <= 13) return `${hari} hari lalu`;
  return tanggalSingkat(iso);
}

/** 179000 -> "179rb"; 1_250_000 -> "1,3jt"; 500 -> "500" */
export function rupiahRingkas(nilai: number): string {
  const n = Number.isFinite(nilai) ? Math.max(0, nilai) : 0;
  if (n < 1_000) return String(Math.round(n));
  if (n < 1_000_000) return `${Math.round(n / 1_000)}rb`;
  const juta = n / 1_000_000;
  const teks = juta < 10 ? juta.toFixed(1).replace(".", ",") : String(Math.round(juta));
  return `${teks}jt`;
}

/**
 * Rupiah dengan tanda lengkap: 7000 -> "Rp 7.000".
 *
 * Dipakai di tempat yang punya ruang, misalnya kartu poin, supaya nominalnya
 * tidak perlu ditebak. `rupiahRingkas` tetap dipakai di sel tabel yang sempit.
 */
export function rupiahPenuh(nilai: number): string {
  const n = Number.isFinite(nilai) ? Math.max(0, nilai) : 0;
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
}

/** Baris transaksi seperlunya untuk menghitung ringkasan. */
export interface BarisTransaksi {
  id: string;
  total: number;
  created_at: string;
  dicatat_oleh_nama: string | null;
  external_ref: string | null;
}

/** Ringkasan belanja satu pelanggan, dihitung dari transaksinya. */
export interface RingkasanPelanggan {
  kunjungan: number;
  totalBelanja: number;
  rataRata: number;
  terakhirIso: string | null;
  /** Transaksi terbaru lebih dulu, dipakai panel detail. */
  riwayat: BarisTransaksi[];
}

/**
 * Hitung ringkasan dari daftar transaksi milik satu pelanggan.
 *
 * Basis "total belanja" adalah kolom `total` (nilai tagihan), bukan nilai
 * setelah potongan poin. Ini disamakan dengan basis perhitungan poin
 * (BR-TRX-05) supaya angka di halaman ini tidak berbeda dari angka yang
 * dipakai kasir saat mencatat.
 */
export function hitungRingkasan(transaksi: BarisTransaksi[]): RingkasanPelanggan {
  const sah = (transaksi || []).filter((t) => t && typeof t.total === "number");
  const riwayat = [...sah].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const totalBelanja = sah.reduce((n, t) => n + t.total, 0);
  const kunjungan = sah.length;
  return {
    kunjungan,
    totalBelanja,
    rataRata: kunjungan > 0 ? Math.round(totalBelanja / kunjungan) : 0,
    terakhirIso: riwayat.length > 0 ? riwayat[0].created_at : null,
    riwayat,
  };
}

/** Gabungkan transaksi per pelanggan_id. */
export function kelompokkanPerPelanggan(
  transaksi: (BarisTransaksi & { pelanggan_id: string | null })[],
): Map<string, BarisTransaksi[]> {
  const peta = new Map<string, BarisTransaksi[]>();
  for (const t of transaksi || []) {
    if (!t || !t.pelanggan_id) continue;
    const isi = peta.get(t.pelanggan_id);
    if (isi) isi.push(t);
    else peta.set(t.pelanggan_id, [t]);
  }
  return peta;
}

/** Jenis lencana. Dipakai komponen untuk memilih warna. */
export type JenisLencana = "aktif" | "baru" | "sepi" | "ultah" | "belum";

export interface Lencana {
  teks: string;
  jenis: JenisLencana;
}

/** Data pelanggan seperlunya untuk menentukan lencana. */
export interface DataLencana {
  tgl_lahir: string | null;
  kunjungan: number;
  terakhirIso: string | null;
}

/**
 * Tentukan satu lencana status untuk pelanggan.
 *
 * URUTAN PRIORITAS (penting, jangan diacak tanpa alasan):
 *   1. Belum pernah transaksi
 *   2. Sudah lama tidak datang (paling perlu ditindak, jadi didahulukan
 *      daripada lencana lain supaya tidak tertutupi)
 *   3. Baru (baru sekali datang)
 *   4. Ulang tahun bulan ini
 *   5. Aktif
 *
 * Alasan urutan ini: lencana dipakai sebagai daftar kerja, bukan hiasan.
 * Orang yang perlu dihubungi harus muncul di depan, dan orang yang ulang
 * tahunnya bulan ini tetap terlihat meski dia rutin datang.
 */
export function lencanaPelanggan(data: DataLencana, hariIni: Date): Lencana {
  const kunjungan = Math.max(0, data.kunjungan || 0);

  if (kunjungan === 0) {
    return { teks: "Belum transaksi", jenis: "belum" };
  }

  const hari = data.terakhirIso ? selisihHari(data.terakhirIso, hariIni) : null;
  if (hari !== null && hari >= BATAS_SEPI_HARI) {
    const bulan = Math.floor(hari / 30);
    const teks = bulan >= 2 ? `Sudah ${bulan} bulan` : `Sudah ${hari} hari`;
    return { teks, jenis: "sepi" };
  }

  if (kunjungan === 1) {
    return { teks: "Baru", jenis: "baru" };
  }

  if (ultahBulanIni(data.tgl_lahir, hariIni)) {
    return { teks: "Ultah bulan ini", jenis: "ultah" };
  }

  if (hari !== null && hari <= BATAS_AKTIF_HARI) {
    return { teks: "Aktif", jenis: "aktif" };
  }

  // Kunjungan lebih dari satu tetapi tanggal terakhir tidak diketahui.
  return { teks: "Aktif", jenis: "aktif" };
}

/**
 * Apakah ulang tahunnya jatuh di bulan yang sama dengan `hariIni`.
 *
 * Hanya bulan yang dibandingkan, bukan tanggalnya: yang dipakai untuk
 * penawaran ulang tahun adalah "bulan ini", dan tanggal persisnya bisa
 * ditampilkan terpisah. Tanggal lahir kosong atau tidak dikenali
 * mengembalikan false, bukan menebak.
 */
export function ultahBulanIni(tglLahir: string | null, hariIni: Date): boolean {
  if (!tglLahir) return false;
  const d = new Date(tglLahir + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return d.getMonth() === hariIni.getMonth();
}

/** Tanggal ulang tahun dalam bulan ini, mis. 21. null kalau tidak relevan. */
export function tanggalUltah(tglLahir: string | null, hariIni: Date): number | null {
  if (!ultahBulanIni(tglLahir, hariIni)) return null;
  const d = new Date((tglLahir as string) + "T00:00:00");
  return d.getDate();
}

/** Ringkasan kepala halaman: berapa pelanggan, berapa yang perlu disapa. */
export interface RingkasanHalaman {
  total: number;
  perluDisapa: number;
  ultahBulanIni: number;
  poinBeredar: number;
  teks: string;
}

/**
 * Susun kalimat kepala halaman.
 *
 * Sengaja menyebut "perlu disapa" hanya kalau ada, supaya kalimatnya tidak
 * berbunyi mengkhawatirkan saat semua pelanggan sehat. Kalau tidak ada satu
 * pun pelanggan, kalimatnya jujur menyebut belum ada data.
 */
export function ringkasHalaman(
  baris: { tgl_lahir: string | null; kunjungan: number; terakhirIso: string | null; poin: number }[],
  hariIni: Date,
): RingkasanHalaman {
  const daftar = baris || [];
  const total = daftar.length;
  const perluDisapa = daftar.filter(
    (p) => lencanaPelanggan(p, hariIni).jenis === "sepi",
  ).length;
  const jumlahUltah = daftar.filter((p) => ultahBulanIni(p.tgl_lahir, hariIni)).length;
  const poinBeredar = daftar.reduce((n, p) => n + (p.poin || 0), 0);

  if (total === 0) {
    return {
      total: 0,
      perluDisapa: 0,
      ultahBulanIni: 0,
      poinBeredar: 0,
      teks: "Belum ada pelanggan tercatat",
    };
  }

  const bagian = [`${total} pelanggan terdaftar`];
  if (perluDisapa > 0) bagian.push(`${perluDisapa} perlu disapa`);
  if (jumlahUltah > 0) bagian.push(`${jumlahUltah} ultah bulan ini`);

  return {
    total,
    perluDisapa,
    ultahBulanIni: jumlahUltah,
    poinBeredar,
    teks: bagian.join(", "),
  };
}

/** Satu baris riwayat poin untuk panel detail. */
export interface BarisLedger {
  id: string;
  tipe: string;
  poin_masuk: number;
  poin_keluar: number;
  sisa: number;
  kedaluwarsa_pada: string | null;
  keterangan: string | null;
  created_at: string;
}

/** Baris ledger yang sudah diterjemahkan untuk ditampilkan. */
export interface LedgerTampil {
  judul: string;
  jumlah: string;
  keterangan: string;
  masuk: boolean;
  waktu: string;
}

/** 2027-03-14 -> "Mar 2027" */
function bulanTahun(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(d);
}

/**
 * Terjemahkan baris buku besar poin jadi kalimat yang bisa dibaca kasir.
 * Istilah `earn`, `redeem`, `expire`, `adjust` adalah istilah database dan
 * tidak boleh tampil apa adanya ke pengguna.
 */
export function terjemahLedger(b: BarisLedger): LedgerTampil {
  const waktu = tanggalSingkat(b.created_at);
  switch (b.tipe) {
    case "earn":
      return {
        judul: "Poin masuk",
        jumlah: `+${b.poin_masuk}`,
        keterangan: b.kedaluwarsa_pada
          ? `Hangus ${bulanTahun(b.kedaluwarsa_pada)} kalau tidak dipakai`
          : "Tanpa masa hangus",
        masuk: true,
        waktu,
      };
    case "redeem":
      return {
        judul: "Poin dipakai",
        jumlah: `-${b.poin_keluar}`,
        keterangan: "Ditukar jadi potongan tagihan",
        masuk: false,
        waktu,
      };
    case "expire":
      return {
        judul: "Poin hangus",
        jumlah: `-${b.poin_keluar}`,
        keterangan: "Kedaluwarsa karena lewat 12 bulan",
        masuk: false,
        waktu,
      };
    case "adjust":
      return {
        judul: "Penyesuaian poin",
        jumlah: b.poin_masuk > 0 ? `+${b.poin_masuk}` : `-${b.poin_keluar}`,
        keterangan: b.keterangan || "Disesuaikan admin",
        masuk: b.poin_masuk > 0,
        waktu,
      };
    default:
      // Jenis yang tidak dikenali tidak ditebak, ditulis apa adanya.
      return {
        judul: "Perubahan poin",
        jumlah: `${b.poin_masuk > 0 ? "+" : "-"}${b.poin_masuk || b.poin_keluar}`,
        keterangan: b.keterangan || "Jenis catatan tidak dikenali",
        masuk: b.poin_masuk > 0,
        waktu,
      };
  }
}

/**
 * Cari kapan poin paling cepat hangus dari daftar ledger, untuk keterangan
 * di kartu poin. Mengembalikan null kalau tidak ada yang punya masa hangus.
 *
 * HANYA masa hangus yang MASIH BERLAKU yang dihitung. Tanggal hangus yang
 * sudah lewat dilewati, bukan dianggap paling dekat: yang ditanyakan
 * pelanggan adalah "poin saya hangus kapan", bukan "kapan poin saya dulu
 * hangus". Karena `selisihHari` mengembalikan `hariIni - tanggal`, tanggal
 * yang masih di depan bernilai NEGATIF.
 */
export function hangusTerdekat(ledger: BarisLedger[], hariIni: Date): string | null {
  let terdekat: string | null = null;
  for (const b of ledger || []) {
    if (b.tipe !== "earn" || b.sisa <= 0 || !b.kedaluwarsa_pada) continue;
    const hari = selisihHari(b.kedaluwarsa_pada, hariIni);
    if (hari === null || hari >= 0) continue;
    if (!terdekat || new Date(b.kedaluwarsa_pada) < new Date(terdekat)) {
      terdekat = b.kedaluwarsa_pada;
    }
  }
  return terdekat;
}

/**
 * Daftar penyaring yang tersedia untuk halaman Pelanggan.
 *
 * Lencana pada daftar hanya berguna kalau bisa dipakai menyaring. Tanpa ini,
 * menjawab pertanyaan seperti "siapa yang sudah lama tidak datang" berarti
 * membaca satu per satu seluruh daftar, padahal lencananya sudah menghitung
 * hal itu. Urutan tetap sama dengan urutan prioritas lencana supaya yang
 * paling perlu disapa muncul lebih dulu di daftar tombol.
 */
export const SARINGAN_PELANGGAN: { jenis: JenisLencana; label: string }[] = [
  { jenis: "sepi", label: "Perlu disapa" },
  { jenis: "belum", label: "Belum transaksi" },
  { jenis: "baru", label: "Baru" },
  { jenis: "ultah", label: "Ultah bulan ini" },
  { jenis: "aktif", label: "Aktif" },
];

/**
 * Saring daftar pelanggan berdasarkan lencana, dihitung ulang dari data.
 *
 * Lencana TIDAK dibaca dari nilai yang tersimpan, melainkan dihitung lagi di
 * sini dengan rumus yang sama. Alasannya lencana bergantung pada tanggal hari
 * ini: lencana yang dihitung kemarin bisa berbeda jenisnya hari ini, sehingga
 * menyaring dari nilai lama akan menampilkan orang yang salah.
 */
export function saringLencana<T extends DataLencana>(
  daftar: T[],
  jenis: JenisLencana | null,
  hariIni: Date,
): T[] {
  if (!jenis) return daftar;
  return daftar.filter((p) => lencanaPelanggan(p, hariIni).jenis === jenis);
}

/**
 * Hitung banyaknya pelanggan per jenis lencana, untuk ditampilkan sebagai
 * angka pada tombol penyaring. Tanpa angka, pengguna harus menebak tombol
 * mana yang ada isinya, dan tombol kosong terasa seperti kesalahan.
 */
export function hitungPerLencana<T extends DataLencana>(
  daftar: T[],
  hariIni: Date,
): Record<JenisLencana, number> {
  const hasil: Record<JenisLencana, number> = {
    aktif: 0,
    baru: 0,
    sepi: 0,
    ultah: 0,
    belum: 0,
  };
  for (const p of daftar) {
    hasil[lencanaPelanggan(p, hariIni).jenis] += 1;
  }
  return hasil;
}

/**
 * Tinggi baris daftar pelanggan dalam piksel.
 *
 * Sebelumnya 76px sehingga satu layar hanya memuat sekitar lima pelanggan.
 * Angka ini dipakai sebagai acuan pengujian supaya alasan di baliknya tidak
 * hilang saat tampilan diubah lagi.
 */
export const TINGGI_BARIS_PX = 56;

/**
 * Ambang jumlah pelanggan sebelum pengelompokan huruf awal ditampilkan.
 * Di bawah ambang ini daftar masih bisa dipindai dengan mata, sehingga
 * huruf awal hanya menambah baris tanpa manfaat.
 */
export const AMBANG_KELOMPOK = 30;

/** Huruf awal untuk pengelompokan daftar. Bukan huruf = "#". */
export function hurufAwal(nama: string): string {
  const bersih = (nama || "").trim();
  if (!bersih) return "#";
  const c = bersih[0].toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

/**
 * Kelompokkan pelanggan menurut huruf awal namanya, urut A sampai Z dengan
 * "#" di akhir. Dipakai hanya saat jumlah pelanggan melewati AMBANG_KELOMPOK
 * supaya daftar panjang tetap bisa dipindai tanpa membaca semuanya.
 */
export function kelompokkanHuruf<T extends { nama: string }>(
  daftar: T[],
): { huruf: string; isi: T[] }[] {
  const peta = new Map<string, T[]>();
  for (const p of daftar) {
    const h = hurufAwal(p.nama);
    const isi = peta.get(h);
    if (isi) isi.push(p);
    else peta.set(h, [p]);
  }
  return [...peta.entries()]
    .sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    })
    .map(([huruf, isi]) => ({ huruf, isi }));
}
