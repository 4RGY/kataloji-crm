// ============================================================
// Logika tampilan Dashboard, Kataloji CRM
// Bagian dari monolit modular Next.js (bukan service terpisah).
//
// Isinya murni: hitungan, pengelompokan, dan penyusunan kalimat. Tidak ada
// akses jaringan dan tidak ada akses jam sistem secara langsung. Waktu
// "sekarang" selalu disuntikkan sebagai parameter supaya hasilnya bisa
// diuji dan tidak berubah sendiri saat bulan berganti.
// ============================================================

/**
 * Rentang jam operasional yang ditampilkan pada grafik jam ramai.
 *
 * 07 sampai 22 karena Kataloji buka pagi sampai malam. Jam di luar rentang
 * ini sengaja tetap dihitung ke jam terdekat, bukan dibuang, supaya
 * transaksi yang tercatat di luar jam operasional tidak hilang diam-diam.
 */
/**
 * Tipe baris buku besar yang MENAMBAH saldo dan karena itu punya `sisa`.
 *
 * Definisinya ada di `./poin` dan hanya diteruskan di sini supaya berkas yang
 * sudah mengimpor dari modul ini tidak perlu ikut berubah. Jangan tulis ulang
 * syaratnya di sini: satu aturan, satu tempat.
 */
import { bersaldo } from "./poin";

export { bersaldo, TIPE_BERSALDO } from "./poin";

export const JAM_MULAI = 7;
export const JAM_SELESAI = 22;

/** Jumlah jam yang ditampilkan: 07 sampai 22 inklusif. */
export const JUMLAH_JAM = JAM_SELESAI - JAM_MULAI + 1;

/** Rentang hari yang dianggap "mendekati hangus" pada papan loyalitas. */
export const BATAS_HANGUS_HARI = 60;

/** Baris transaksi seperlunya untuk hitungan dashboard. */
export interface BarisTransaksi {
  id: string;
  total: number;
  diskon: number;
  poin_dipakai: number;
  poin_didapat: number;
  created_at: string;
  pelanggan_id: string | null;
}

/** Baris buku besar poin seperlunya. */
export interface BarisLedger {
  pelanggan_id: string;
  tipe: string;
  poin_masuk: number;
  poin_keluar: number;
  sisa: number;
  kedaluwarsa_pada: string | null;
}

/**
 * Jam lokal dari stempel waktu.
 *
 * Sengaja memakai getHours (jam lokal) dan bukan getUTCHours. Kedai beroperasi
 * di WIB, dan "jam ramai" yang ditampilkan ke pemilik harus jam di dinding
 * kedai, bukan jam UTC. Kalau memakai UTC, transaksi pukul 19.00 WIB akan
 * tampil sebagai pukul 12.00 dan kesimpulannya salah.
 */
export function jamLokal(waktu: string | Date): number {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  const h = d.getHours();
  return Number.isFinite(h) ? h : 0;
}

/** Satu batang grafik jam ramai. */
export interface BatangJam {
  jam: number;
  /** Label sumbu, misalnya "18". */
  label: string;
  jumlah: number;
  /** 0..1 terhadap jam paling ramai, untuk menentukan tinggi batang. */
  porsi: number;
  /** true untuk jam dengan jumlah transaksi tertinggi. */
  puncak: boolean;
}

/**
 * Sumber yang JAM kedatangannya benar-benar diketahui (kasir mencatat saat itu).
 */
const SUMBER_JAM_DIKETAHUI = new Set(["crm_manual", "majoo_parallel", "crm_pos"]);

/**
 * Apakah jam sebuah transaksi berarti jam kedatangan pelanggan.
 *
 * Transaksi hasil impor laporan hanya membawa TANGGAL, sehingga created_at-nya
 * adalah jam impor: struk yang diimpor sekaligus berstempel jam yang sama.
 * Kalau ikut dihitung, grafik "jam ramai" menggambarkan jam kerja admin
 * mengimpor, bukan jam kedai ramai. Transaksi tanpa `source` (data lama)
 * dianggap tidak diketahui: lebih jujur daripada menebaknya.
 */
export function jamKedatanganDiketahui(t: { source?: string | null }): boolean {
  return SUMBER_JAM_DIKETAHUI.has((t.source ?? "").trim());
}

/**
 * Susun sebaran transaksi per jam untuk grafik jam ramai.
 *
 * Mengembalikan SATU batang untuk setiap jam pada rentang operasional,
 * termasuk jam yang nol transaksi. Jam kosong sengaja tetap dikembalikan
 * supaya sumbu waktunya utuh: kalau jam kosong dibuang, batang jam 18 dan 22
 * akan tampak bersebelahan dan grafiknya berbohong soal jarak waktu.
 *
 * Hanya transaksi yang jam kedatangannya diketahui yang dihitung; transaksi
 * impor laporan dilewati supaya jam impor tidak tampil sebagai jam ramai.
 */
export function sebaranJam(
  transaksi: { created_at: string; source?: string | null }[],
  mulai = JAM_MULAI,
  selesai = JAM_SELESAI,
): BatangJam[] {
  const hitung = new Map<number, number>();
  for (const t of transaksi) {
    if (!jamKedatanganDiketahui(t)) continue;
    const j = jamLokal(t.created_at);
    // Jam di luar rentang dilipat ke ujung terdekat, bukan dibuang. Data yang
    // ada tidak boleh hilang hanya karena di luar jam yang biasa ditampilkan.
    const terjepit = Math.min(Math.max(j, mulai), selesai);
    hitung.set(terjepit, (hitung.get(terjepit) ?? 0) + 1);
  }

  let tertinggi = 0;
  for (const n of hitung.values()) tertinggi = Math.max(tertinggi, n);

  const hasil: BatangJam[] = [];
  for (let j = mulai; j <= selesai; j++) {
    const jumlah = hitung.get(j) ?? 0;
    hasil.push({
      jam: j,
      label: String(j),
      jumlah,
      porsi: tertinggi > 0 ? jumlah / tertinggi : 0,
      puncak: jumlah > 0 && jumlah === tertinggi,
    });
  }

  // Kalau ada beberapa jam dengan jumlah sama, hanya yang pertama dianggap
  // puncak supaya penanda "paling ramai" tidak muncul berkali-kali.
  const idxPuncak = hasil.findIndex((b) => b.puncak);
  hasil.forEach((b, i) => {
    b.puncak = i === idxPuncak && b.jumlah > 0;
  });

  return hasil;
}

/** Jam paling ramai, atau null kalau belum ada transaksi. */
export function jamTeramai(batang: BatangJam[]): BatangJam | null {
  let terbaik: BatangJam | null = null;
  for (const b of batang) {
    if (b.jumlah > 0 && (terbaik === null || b.jumlah > terbaik.jumlah)) {
      terbaik = b;
    }
  }
  return terbaik;
}

/**
 * Kalimat ringkas untuk kepala kartu jam ramai.
 *
 * Mengembalikan kalimat yang menyatakan ketiadaan data secara jujur, bukan
 * angka nol yang bisa disalahartikan sebagai "sepi".
 */
export function ringkasJamTeramai(batang: BatangJam[]): string {
  const puncak = jamTeramai(batang);
  if (!puncak) return "Belum ada transaksi pada periode ini";
  const jam = String(puncak.jam).padStart(2, "0");
  return `Paling ramai ${jam}.00, ${puncak.jumlah} transaksi`;
}

/** Angka-angka papan loyalitas. */
export interface PapanLoyalitas {
  poinBeredar: number;
  nilaiPoinBeredar: number;
  pelangganTerdaftar: number;
  pelangganUlang: number;
  akanHangus: number;
  nilaiAkanHangus: number;
}

/**
 * Hitung papan loyalitas dari buku besar poin dan daftar transaksi.
 *
 * Poin beredar = jumlah kolom `sisa` pada baris earn yang belum kedaluwarsa.
 * Ini mengikuti cara kerja saldo di database (fungsi saldo_poin), bukan
 * menjumlahkan poin_masuk mentah, karena poin yang sudah dipakai atau sudah
 * hangus tetap tercatat di baris asalnya.
 *
 * Poin yang akan hangus dihitung dari tanggal kedaluwarsa terhadap `sekarang`,
 * bukan dari umur baris, supaya angkanya sama dengan yang dihitung database.
 */
export function hitungPapanLoyalitas(
  ledger: BarisLedger[],
  transaksi: { pelanggan_id: string | null }[],
  jumlahPelanggan: number,
  nilaiPoin: number,
  sekarang: Date,
  batasHari = BATAS_HANGUS_HARI,
): PapanLoyalitas {
  const batas = new Date(sekarang);
  batas.setHours(0, 0, 0, 0);
  batas.setDate(batas.getDate() + batasHari);
  const hariIni = new Date(sekarang);
  hariIni.setHours(0, 0, 0, 0);

  let poinBeredar = 0;
  let akanHangus = 0;

  for (const b of ledger) {
    if (!bersaldo(b.tipe) || b.sisa <= 0) continue;

    // Tanpa tanggal kedaluwarsa, poin tidak pernah hangus, jadi selalu
    // dihitung sebagai beredar.
    if (!b.kedaluwarsa_pada) {
      poinBeredar += b.sisa;
      continue;
    }

    const ed = new Date(b.kedaluwarsa_pada + "T00:00:00");
    if (!Number.isFinite(ed.getTime())) {
      poinBeredar += b.sisa;
      continue;
    }

    // Aturan ini WAJIB sama dengan fungsi saldo_poin() di database, yang
    // berbunyi: kedaluwarsa_pada > current_date. Poin yang tanggal hangusnya
    // sudah lewat (termasuk yang jatuh tepat hari ini) TIDAK dihitung.
    //
    // Sempat ditulis >= dan itu salah: dashboard menampilkan saldo lebih besar
    // daripada saldo resmi database. Angka poin di layar tidak boleh berbeda
    // dari yang nanti dipakai kasir saat menukar poin.
    if (ed > hariIni) poinBeredar += b.sisa;
    if (ed > hariIni && ed <= batas) akanHangus += b.sisa;
  }

  // Pelanggan ulang = pelanggan dengan lebih dari satu transaksi. Dihitung
  // per pelanggan, bukan jumlah transaksi, supaya angkanya bisa dibaca
  // sebagai "berapa orang yang balik".
  const perPelanggan = new Map<string, number>();
  for (const t of transaksi) {
    if (!t.pelanggan_id) continue;
    perPelanggan.set(t.pelanggan_id, (perPelanggan.get(t.pelanggan_id) ?? 0) + 1);
  }
  let pelangganUlang = 0;
  for (const n of perPelanggan.values()) if (n > 1) pelangganUlang++;

  return {
    poinBeredar,
    nilaiPoinBeredar: poinBeredar * nilaiPoin,
    pelangganTerdaftar: jumlahPelanggan,
    pelangganUlang,
    akanHangus,
    nilaiAkanHangus: akanHangus * nilaiPoin,
  };
}

/**
 * Total poin yang benar-benar diberikan pada sekumpulan transaksi.
 *
 * HANYA transaksi yang punya pelanggan yang dihitung. Aturan Kataloji:
 * poin adalah bonus otomatis kalau transaksi nyangkut ke seseorang. Pada
 * transaksi tanpa pelanggan, trigger database memang berhenti lebih dulu dan
 * tidak pernah menulis baris poin ke buku besar.
 *
 * Kolom poin_didapat pada baris tanpa pelanggan tetap berisi angka hasil
 * hitungan, dan itulah jebakannya: menjumlahkannya mentah membuat kartu
 * "Poin diberikan" menampilkan angka lebih besar daripada poin yang benar
 * benar masuk ke buku besar. Data pemilik sempat menunjukkan 9 di kartu
 * sementara buku besarnya hanya berisi 8.
 */
export function hitungPoinDiberikan(
  transaksi: { pelanggan_id: string | null; poin_didapat: number }[],
): number {
  return transaksi.reduce(
    (s, t) => s + (t.pelanggan_id ? (t.poin_didapat ?? 0) : 0),
    0,
  );
}

/**
 * Omzet rata-rata per struk.
 *
 * Dipisahkan dari "rata-rata harian" karena keduanya menjawab pertanyaan
 * berbeda: rata-rata harian menunjukkan ramai tidaknya hari, sedangkan
 * rata-rata per struk menunjukkan besar belanja tiap orang. Pemilik memakai
 * angka kedua untuk menilai apakah penawaran paket layak dinaikkan.
 *
 * Pembagi memakai jumlah transaksi, bukan jumlah pelanggan, supaya transaksi
 * tanpa data pelanggan tetap terhitung. Kalau dibagi jumlah pelanggan,
 * angkanya akan melambung pada hari yang banyak pembeli tanpa data.
 */
export function rataPerStruk(omzet: number, jumlahTransaksi: number): number {
  if (!jumlahTransaksi || jumlahTransaksi <= 0) return 0;
  return Math.round(omzet / jumlahTransaksi);
}

/** Satu kartu pada papan angka kunci (dipakai varian B, tetap diuji). */
export interface KartuAngka {
  label: string;
  nilai: string;
  keterangan: string;
  /** Nilai mentah untuk keperluan urutan atau pengujian. */
  mentah: number;
}

/**
 * Empat angka kunci dashboard.
 *
 * `hariAdaTransaksi` dihitung dari banyaknya tanggal unik yang punya
 * transaksi, bukan dari rentang hari, supaya hari yang kosong tidak
 * terhitung sebagai hari berjualan.
 */
export function angkaKunci(
  transaksi: BarisTransaksi[],
  papan: PapanLoyalitas,
  jumlahHariPeriode: number,
  nilaiPoin: number,
  rupiahPenuh: (n: number) => string,
): KartuAngka[] {
  const jumlah = transaksi.length;
  // Nilai poin disuntikkan, tidak ditulis tetap. Kalau nilainya ditulis
  // 1.000 di sini sementara aturan bisnis berubah jadi 2.000, omzet bersih
  // di kartu ini akan berbeda dari omzet di kartu utama tanpa ada yang tahu.
  const omzetBersih = transaksi.reduce(
    (s, t) => s + Math.max(0, t.total - (t.diskon ?? 0) - (t.poin_dipakai ?? 0) * nilaiPoin),
    0,
  );
  const perTransaksi = jumlah > 0 ? Math.round(omzetBersih / jumlah) : 0;
  const terbesar = transaksi.reduce((m, t) => Math.max(m, t.total), 0);

  const hariUnik = new Set(
    transaksi.map((t) => {
      const d = new Date(t.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  return [
    {
      label: "Per transaksi",
      nilai: rupiahPenuh(perTransaksi),
      keterangan: `${jumlah} transaksi`,
      mentah: perTransaksi,
    },
    {
      label: "Transaksi terbesar",
      nilai: rupiahPenuh(terbesar),
      keterangan: "pada periode ini",
      mentah: terbesar,
    },
    {
      label: "Poin beredar",
      nilai: String(papan.poinBeredar),
      keterangan: `senilai ${rupiahPenuh(papan.nilaiPoinBeredar)}`,
      mentah: papan.poinBeredar,
    },
    {
      label: "Hari ada transaksi",
      nilai: String(hariUnik.size),
      keterangan: `dari ${jumlahHariPeriode} hari`,
      mentah: hariUnik.size,
    },
  ];
}
