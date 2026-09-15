// ============================================================
// Logika halaman Loyalitas.
//
// Semua angka di halaman ini dihitung dari `point_ledger`, bukan dari kolom
// `pelanggan.poin`. Kolom itu hanya salinan saldo yang disegarkan trigger,
// sedangkan buku besar menyimpan tiap peristiwa poin satu per satu. Kalau
// keduanya suatu saat berbeda, buku besar yang benar karena dialah yang
// dipakai saat kasir menukar poin.
//
// ATURAN HANGUS YANG WAJIB DIIKUTI SELURUH BERKAS INI:
//   saldo_poin() di database berbunyi `kedaluwarsa_pada > current_date`.
//   Artinya poin yang tanggal hangusnya jatuh TEPAT HARI INI sudah tidak
//   terhitung. Menulis `>=` membuat layar menampilkan saldo lebih besar
//   daripada saldo resmi, dan kasir akan menjanjikan potongan yang ditolak
//   database. Sudah pernah terjadi, jangan diulang.
// ============================================================

/** Satu baris buku besar poin, seperlunya untuk halaman ini. */
export interface BarisLedgerLoyalitas {
  id: string;
  pelanggan_id: string | null;
  transaksi_id: string | null;
  tipe: string;
  poin_masuk: number;
  poin_keluar: number;
  sisa: number;
  kedaluwarsa_pada: string | null;
  keterangan: string | null;
  created_at: string;
}

/** Data pelanggan seperlunya untuk menamai baris buku besar. */
export interface PelangganRingkas {
  id: string;
  nama: string;
  whatsapp: string;
}

/** Tenggat yang ditawarkan pada penyaring poin akan hangus. */
export const TENGGAT_HANGUS = [30, 60, 90] as const;

/** Batas bawah jumlah poin sebelum penukaran diizinkan (BR-LOY-20). */
export const MIN_TUKAR = 5;

/**
 * Awal hari dari sebuah tanggal, supaya perbandingan tidak terpengaruh jam.
 * Tanpa ini, poin yang hangus hari ini kadang terhitung kadang tidak,
 * tergantung jam berapa halaman dibuka.
 */
export function awalHari(d: Date): Date {
  const h = new Date(d);
  h.setHours(0, 0, 0, 0);
  return h;
}

/** Ubah "2027-09-14" menjadi Date tengah malam waktu setempat. */
export function tanggalDari(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Selisih hari menuju sebuah tanggal. Positif berarti masih di depan,
 * nol berarti hari ini, negatif berarti sudah lewat.
 */
export function hariMenuju(iso: string | null, sekarang: Date): number | null {
  const d = tanggalDari(iso);
  if (!d) return null;
  const beda = d.getTime() - awalHari(sekarang).getTime();
  return Math.round(beda / 86_400_000);
}

/**
 * Apakah sebuah baris masih menyimpan poin yang bisa dipakai hari ini.
 * Hanya baris bertipe "earn" yang menyimpan sisa; baris "redeem" mencatat
 * pengeluaran sehingga sisanya memang nol.
 */
export function masihBerlaku(
  b: BarisLedgerLoyalitas,
  sekarang: Date,
): boolean {
  if (b.tipe !== "earn") return false;
  if ((b.sisa ?? 0) <= 0) return false;
  if (!b.kedaluwarsa_pada) return true; // tanpa tanggal hangus, tidak pernah hangus
  const d = tanggalDari(b.kedaluwarsa_pada);
  if (!d) return true;
  return d > awalHari(sekarang);
}

export interface RingkasLoyalitas {
  poinBeredar: number;
  nilaiRupiah: number;
  poinDiterbitkan: number;
  poinDitukar: number;
  poinHangus: number;
  /** Persentase poin terbit yang akhirnya ditebus, 0 sampai 100. */
  tingkatPenukaran: number;
  pemilikPoin: number;
  /**
   * Selisih yang tidak bisa dijelaskan antara aritmetika sederhana
   * (diterbitkan - ditukar - hangus) dan saldo yang benar-benar tersisa.
   * Nol berarti buku besarnya konsisten.
   */
  selisihTakDikenal: number;
}

/**
 * Ringkasan pokok halaman Loyalitas.
 *
 * `poinDitukar` diambil dari kolom poin_keluar pada baris redeem, bukan dari
 * pengurangan saldo. Alasannya penukaran dan penghangusan sama-sama
 * mengurangi saldo, sehingga menghitung dari selisih saldo akan mencampur
 * keduanya dan membuat tingkat penukaran terlihat lebih besar daripada
 * kenyataannya.
 */
export function ringkasLoyalitas(
  ledger: BarisLedgerLoyalitas[],
  nilaiPoin: number,
  sekarang: Date,
): RingkasLoyalitas {
  let poinBeredar = 0;
  let poinDiterbitkan = 0;
  let poinDitukar = 0;
  let poinHangus = 0;
  const pemilik = new Set<string>();

  for (const b of ledger || []) {
    if (b.tipe === "earn") {
      poinDiterbitkan += Math.max(0, b.poin_masuk ?? 0);
      if (masihBerlaku(b, sekarang)) {
        poinBeredar += b.sisa;
        if (b.pelanggan_id) pemilik.add(b.pelanggan_id);
      } else if ((b.sisa ?? 0) > 0) {
        // Masih ada sisa tetapi tanggalnya sudah lewat: itu poin hangus.
        poinHangus += b.sisa;
      }
    } else if (b.tipe === "redeem") {
      poinDitukar += Math.max(0, b.poin_keluar ?? 0);
    } else if (b.tipe === "expire") {
      poinHangus += Math.max(0, b.poin_keluar ?? 0);
    }
  }

  const tingkat =
    poinDiterbitkan > 0
      ? Math.round((poinDitukar / poinDiterbitkan) * 100)
      : 0;

  // Pemeriksaan kejujuran angka.
  //
  // Secara aritmetika, poin yang tersisa seharusnya sama dengan poin terbit
  // dikurangi yang ditukar dan yang hangus. Kalau tidak sama, ada peristiwa
  // yang tidak tercatat di buku besar, misalnya sisa batch dinolkan tanpa
  // baris penukaran pendampingnya. Itu pernah benar-benar terjadi pada data
  // eksperimen awal proyek ini.
  //
  // Selisihnya DITAMPILKAN, bukan disembunyikan atau ditebak penyebabnya.
  // Menyembunyikannya membuat pemilik percaya pada angka yang tidak bisa
  // dipertanggungjawabkan saat diaudit.
  const harusnyaSisa = poinDiterbitkan - poinDitukar - poinHangus;
  const selisihTakDikenal = harusnyaSisa - poinBeredar;

  return {
    poinBeredar,
    nilaiRupiah: poinBeredar * (Number(nilaiPoin) || 0),
    poinDiterbitkan,
    poinDitukar,
    poinHangus,
    tingkatPenukaran: Math.min(100, Math.max(0, tingkat)),
    pemilikPoin: pemilik.size,
    selisihTakDikenal,
  };
}

export interface BarisHangus {
  pelanggan_id: string;
  nama: string;
  whatsapp: string;
  poin: number;
  nilaiRupiah: number;
  tanggal: string;
  sisaHari: number;
}

/**
 * Daftar poin yang akan hangus dalam sekian hari ke depan, sudah
 * dikelompokkan per pelanggan dan diurutkan dari yang paling mendesak.
 *
 * Ini daftar kerja, bukan laporan: yang paling dekat hangus harus muncul
 * lebih dulu supaya pemilik tahu siapa yang perlu dihubungi hari ini. Poin
 * yang tanggalnya sudah lewat TIDAK dimasukkan karena sudah tidak bisa
 * diselamatkan, dan menampilkannya hanya membuat daftar penuh nama yang
 * percuma dihubungi.
 */
export function daftarAkanHangus(
  ledger: BarisLedgerLoyalitas[],
  pelanggan: PelangganRingkas[],
  dalamHari: number,
  nilaiPoin: number,
  sekarang: Date,
): BarisHangus[] {
  const namaDari = new Map(pelanggan.map((p) => [p.id, p]));
  const kumpul = new Map<string, { poin: number; tanggal: string; sisaHari: number }>();

  for (const b of ledger || []) {
    if (!masihBerlaku(b, sekarang)) continue;
    if (!b.pelanggan_id || !b.kedaluwarsa_pada) continue;

    const sisaHari = hariMenuju(b.kedaluwarsa_pada, sekarang);
    if (sisaHari === null || sisaHari > dalamHari) continue;

    const ada = kumpul.get(b.pelanggan_id);
    if (ada) {
      ada.poin += b.sisa;
      // Simpan tanggal paling dekat, karena itu tenggat sebenarnya.
      if (sisaHari < ada.sisaHari) {
        ada.sisaHari = sisaHari;
        ada.tanggal = b.kedaluwarsa_pada;
      }
    } else {
      kumpul.set(b.pelanggan_id, {
        poin: b.sisa,
        tanggal: b.kedaluwarsa_pada,
        sisaHari,
      });
    }
  }

  const hasil: BarisHangus[] = [];
  for (const [id, v] of kumpul) {
    const p = namaDari.get(id);
    hasil.push({
      pelanggan_id: id,
      nama: p?.nama ?? "Pelanggan tidak dikenal",
      whatsapp: p?.whatsapp ?? "",
      poin: v.poin,
      nilaiRupiah: v.poin * (Number(nilaiPoin) || 0),
      tanggal: v.tanggal,
      sisaHari: v.sisaHari,
    });
  }

  // Paling mendesak dulu; kalau tenggatnya sama, poin terbesar dulu karena
  // itu yang paling rugi kalau sampai hangus.
  hasil.sort((a, b) => a.sisaHari - b.sisaHari || b.poin - a.poin);
  return hasil;
}

export interface BarisRiwayat {
  id: string;
  nama: string;
  tipe: string;
  label: string;
  poin: number;
  arah: "masuk" | "keluar";
  keterangan: string;
  waktu: string;
  kedaluwarsa_pada: string | null;
}

/** Ubah tipe teknis buku besar menjadi kalimat yang dimengerti pemilik. */
export function labelTipe(tipe: string): string {
  if (tipe === "earn") return "Poin masuk";
  if (tipe === "redeem") return "Poin dipakai";
  if (tipe === "expire") return "Poin hangus";
  if (tipe === "adjust") return "Penyesuaian";
  return "Pergerakan poin";
}

/**
 * Riwayat seluruh pergerakan poin, terbaru lebih dulu.
 *
 * Nama pelanggan disisipkan di sini, bukan diambil lewat sambungan tabel,
 * supaya baris milik pelanggan yang sudah dihapus tetap terbaca sebagai
 * riwayat dan tidak lenyap diam-diam dari catatan.
 */
export function riwayatLoyalitas(
  ledger: BarisLedgerLoyalitas[],
  pelanggan: PelangganRingkas[],
): BarisRiwayat[] {
  const namaDari = new Map(pelanggan.map((p) => [p.id, p.nama]));

  return (ledger || [])
    .map((b) => {
      const masuk = (b.poin_masuk ?? 0) > 0;
      return {
        id: b.id,
        nama: b.pelanggan_id
          ? (namaDari.get(b.pelanggan_id) ?? "Pelanggan sudah dihapus")
          : "Tanpa pelanggan",
        tipe: b.tipe,
        label: labelTipe(b.tipe),
        poin: masuk ? (b.poin_masuk ?? 0) : (b.poin_keluar ?? 0),
        arah: masuk ? ("masuk" as const) : ("keluar" as const),
        keterangan: b.keterangan ?? "",
        waktu: b.created_at,
        kedaluwarsa_pada: b.kedaluwarsa_pada,
      };
    })
    .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime());
}

/**
 * Kalimat pembuka halaman, menyesuaikan keadaan.
 *
 * Kalimat berubah mengikuti apa yang paling perlu diketahui saat itu:
 * kalau ada poin yang segera hangus, itu yang disebut lebih dulu, karena
 * itulah satu-satunya keadaan yang menuntut tindakan hari ini.
 */
export function kalimatLoyalitas(
  ringkas: RingkasLoyalitas,
  jumlahAkanHangus: number,
  dalamHari: number,
): string {
  if (ringkas.poinDiterbitkan === 0) {
    return "Belum ada poin yang diterbitkan. Angka terisi otomatis setelah transaksi pertama dengan pelanggan dicatat.";
  }
  if (jumlahAkanHangus > 0) {
    return `${jumlahAkanHangus} pelanggan punya poin yang hangus dalam ${dalamHari} hari ke depan. Hubungi mereka sebelum poinnya terbuang.`;
  }
  if (ringkas.poinBeredar === 0) {
    return "Tidak ada poin yang beredar saat ini. Semua poin sudah dipakai atau hangus.";
  }
  return `${ringkas.poinBeredar} poin sedang beredar di tangan ${ringkas.pemilikPoin} pelanggan. Tidak ada yang mendesak dalam ${dalamHari} hari ke depan.`;
}

/**
 * Tautan WhatsApp untuk mengingatkan poin yang akan hangus.
 *
 * Pesannya dibuat di sini, bukan di komponen, supaya kalimatnya bisa diuji
 * dan tidak berubah tanpa sengaja saat tampilan dirapikan. Nomor yang kosong
 * menghasilkan null supaya tombolnya tidak ditampilkan sebagai tautan mati.
 */
export function tautanPengingat(
  baris: BarisHangus,
  namaKedai = "Kataloji Coffee and Eatery",
): string | null {
  const nomor = (baris.whatsapp || "").replace(/\D/g, "");
  if (!nomor) return null;

  const tgl = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(baris.tanggal + "T00:00:00"));

  const pesan =
    `Halo ${baris.nama}, ini dari ${namaKedai}. ` +
    `Poin kamu ada ${baris.poin} dan berlaku sampai ${tgl}. ` +
    `Bisa dipakai jadi potongan sampai Rp ${baris.nilaiRupiah.toLocaleString("id-ID")} ` +
    `di kunjungan berikutnya. Sampai jumpa!`;

  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
}
